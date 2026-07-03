import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { getPlatformConfig } from "../../platform-config";
import { detectLanguage } from "../language";
import { runApifyActor } from "./apify";
import { extractHashtags, logTrending } from "./hashtags";

/**
 * Instagram collector — scrapes recent/top posts for seed hashtags per category
 * to surface trending content and hashtags.
 *
 * Two engines (both requested by the operator):
 *  1. Managed scraper (preferred): Apify actor `apify_instagram_actor`
 *     (default `apify/instagram-hashtag-scraper`) via `apify_token`.
 *  2. Direct scraping (fallback): Instagram's private web API using a logged-in
 *     `instagram_session_cookie` (the `sessionid` cookie).
 *
 * If neither credential is configured the collector logs a WARN and returns []
 * (no mock data, no silent fallback).
 */

const DEFAULT_ACTOR = "apify/instagram-hashtag-scraper";
const IG_APP_ID = "936619743392459";
const RESULTS_PER_TAG = 30;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HASHTAGS_BY_CATEGORY: Record<string, string[]> = {
  politics: ["politics", "news", "election"],
  technology: ["tech", "ai", "gadgets"],
  business: ["business", "finance", "economy"],
  society: ["culture", "lifestyle", "community"],
  "southeast-asia": ["malaysia", "singapore", "indonesia"],
  sports: ["sports", "football", "basketball"],
  entertainment: ["entertainment", "movies", "music"],
  health: ["health", "fitness", "wellness"],
  environment: ["climate", "sustainability", "environment"],
  crypto: ["crypto", "bitcoin", "blockchain"],
};

function sanitizeTag(t: string): string {
  return t.replace(/^#/, "").replace(/[^\p{L}\p{N}_]/gu, "").toLowerCase();
}

function seedTags(category: string): string[] {
  const base = HASHTAGS_BY_CATEGORY[category] ?? [category];
  return [...new Set(base.map(sanitizeTag).filter(Boolean))].slice(0, 3);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function collectViaApify(
  tags: string[],
  category: string,
  token: string,
  actor: string,
): Promise<NormalizedItem[]> {
  const raw = await runApifyActor<any>(
    actor,
    { hashtags: tags, resultsLimit: RESULTS_PER_TAG, resultsType: "top", addParentData: false },
    token,
  );

  const items: NormalizedItem[] = [];
  for (const p of raw) {
    const caption = typeof p.caption === "string" ? p.caption : (p.caption?.text ?? "");
    if (!caption || !caption.trim()) continue;

    const hashtags =
      Array.isArray(p.hashtags) && p.hashtags.length
        ? [...new Set(p.hashtags.map((h: string) => `#${sanitizeTag(String(h))}`).filter((h: string) => h.length > 1))]
        : extractHashtags(caption);

    const shortCode = p.shortCode ?? p.shortcode ?? null;
    items.push({
      platform: "instagram",
      sourceUrl: p.url ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : "https://www.instagram.com"),
      title: null,
      body: caption.slice(0, 2000),
      author: p.ownerUsername ?? p.ownerFullName ?? null,
      publishedAt: p.timestamp ? new Date(p.timestamp) : null,
      language: detectLanguage(caption),
      category,
      engagementMetrics: {
        likes: Number(p.likesCount ?? 0) || 0,
        comments: Number(p.commentsCount ?? 0) || 0,
        views: Number(p.videoViewCount ?? p.videoPlayCount ?? 0) || 0,
      },
      rawMetadata: { hashtags, source: "apify", shortCode },
    });
  }
  return items;
}

async function collectViaCookie(tags: string[], category: string, cookie: string): Promise<NormalizedItem[]> {
  const cookieHeader = cookie.includes("=") ? cookie : `sessionid=${cookie}`;
  const items: NormalizedItem[] = [];

  for (const tag of tags) {
    try {
      const res = await fetch(
        `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${encodeURIComponent(tag)}`,
        {
          headers: {
            "x-ig-app-id": IG_APP_ID,
            "User-Agent": UA,
            Accept: "application/json",
            Cookie: cookieHeader,
          },
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!res.ok) {
        logger.warn({ tag, status: res.status }, "Instagram web_info request failed — check INSTAGRAM_SESSION_COOKIE");
        continue;
      }

      const json: any = await res.json().catch(() => null);
      const sections = [
        ...(json?.data?.top?.sections ?? []),
        ...(json?.data?.recent?.sections ?? []),
      ];

      for (const section of sections) {
        const medias = section?.layout_content?.medias ?? section?.layout_content?.medias_bucket ?? [];
        for (const entry of medias) {
          const media = entry?.media ?? entry;
          const caption = media?.caption?.text ?? "";
          if (!caption || !caption.trim()) continue;

          const code = media?.code;
          items.push({
            platform: "instagram",
            sourceUrl: code ? `https://www.instagram.com/p/${code}/` : "https://www.instagram.com",
            title: null,
            body: caption.slice(0, 2000),
            author: media?.user?.username ?? null,
            publishedAt: media?.taken_at ? new Date(media.taken_at * 1000) : null,
            language: detectLanguage(caption),
            category,
            engagementMetrics: {
              likes: Number(media?.like_count ?? 0) || 0,
              comments: Number(media?.comment_count ?? 0) || 0,
              views: Number(media?.play_count ?? media?.view_count ?? 0) || 0,
            },
            rawMetadata: { hashtags: extractHashtags(caption), source: "cookie", seedTag: tag },
          });
        }
      }
    } catch (err) {
      logger.warn({ tag, err: (err as Error).message }, "Instagram cookie fetch failed");
    }
    // Politeness delay between hashtag requests.
    await new Promise((r) => setTimeout(r, 1500));
  }

  return items;
}

export async function collectInstagram(category: string): Promise<NormalizedItem[]> {
  const tags = seedTags(category);
  if (!tags.length) return [];

  const [apifyToken, actorOverride, igCookie] = await Promise.all([
    getPlatformConfig("apify_token"),
    getPlatformConfig("apify_instagram_actor"),
    getPlatformConfig("instagram_session_cookie"),
  ]);
  const actor = actorOverride || DEFAULT_ACTOR;

  let items: NormalizedItem[] = [];

  if (apifyToken) {
    try {
      items = await collectViaApify(tags, category, apifyToken, actor);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Instagram Apify collection failed — trying cookie fallback");
    }
    if (items.length) {
      logTrending("instagram", category, items);
      return items;
    }
  }

  if (igCookie) {
    try {
      items = await collectViaCookie(tags, category, igCookie);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Instagram cookie collection failed");
    }
    if (items.length) logTrending("instagram", category, items);
    return items;
  }

  if (!apifyToken) {
    logger.warn(
      "Instagram: neither APIFY_TOKEN nor INSTAGRAM_SESSION_COOKIE set — skipping Instagram collection",
    );
  }
  return items;
}
