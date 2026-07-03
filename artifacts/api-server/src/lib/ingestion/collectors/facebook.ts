import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { getPlatformConfig } from "../../platform-config";
import { detectLanguage } from "../language";
import { runApifyActor } from "./apify";
import { extractHashtags, logTrending } from "./hashtags";

/**
 * Facebook collector — scrapes public posts for seed hashtags per category to
 * surface trending content and hashtags.
 *
 * Two engines (both requested by the operator):
 *  1. Managed scraper (preferred): Apify actor `apify_facebook_actor`
 *     (default `apify/facebook-posts-scraper`) via `apify_token`, seeded with
 *     Facebook hashtag-page start URLs.
 *  2. Direct scraping (fallback): the lightweight mbasic.facebook.com hashtag
 *     pages parsed with cheerio, using a logged-in `facebook_session_cookie`.
 *
 * If neither credential is configured the collector logs a WARN and returns []
 * (no mock data, no silent fallback). Facebook is a weaker hashtag surface than
 * Instagram; operators may need to point `apify_facebook_actor` at an actor that
 * fits their needs.
 */

const DEFAULT_ACTOR = "apify/facebook-posts-scraper";
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

function num(...vals: any[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

async function collectViaApify(
  tags: string[],
  category: string,
  token: string,
  actor: string,
): Promise<NormalizedItem[]> {
  const startUrls = tags.map((t) => ({ url: `https://www.facebook.com/hashtag/${t}` }));
  const raw = await runApifyActor<any>(
    actor,
    { startUrls, resultsLimit: RESULTS_PER_TAG, maxPosts: RESULTS_PER_TAG },
    token,
  );

  const items: NormalizedItem[] = [];
  for (const p of raw) {
    const text = p.text ?? p.message ?? p.postText ?? p.caption ?? p.content ?? "";
    if (!text || !text.trim()) continue;

    items.push({
      platform: "facebook",
      sourceUrl: p.url ?? p.postUrl ?? p.link ?? "https://www.facebook.com",
      title: null,
      body: String(text).slice(0, 2000),
      author: p.pageName ?? p.user?.name ?? p.authorName ?? p.author ?? null,
      publishedAt: (() => {
        const t = p.time ?? p.timestamp ?? p.date ?? p.publishedAt;
        if (!t) return null;
        const d = new Date(typeof t === "number" ? t * (t < 1e12 ? 1000 : 1) : t);
        return isNaN(d.getTime()) ? null : d;
      })(),
      language: detectLanguage(String(text)),
      category,
      engagementMetrics: {
        likes: num(p.likes, p.likesCount, p.reactionsCount, p.reactions?.total),
        comments: num(p.comments, p.commentsCount),
        shares: num(p.shares, p.sharesCount),
      },
      rawMetadata: { hashtags: extractHashtags(String(text)), source: "apify" },
    });
  }
  return items;
}

async function collectViaCookie(tags: string[], category: string, cookie: string): Promise<NormalizedItem[]> {
  const cheerio = await import("cheerio");
  const items: NormalizedItem[] = [];

  for (const tag of tags) {
    try {
      const res = await fetch(`https://mbasic.facebook.com/hashtag/${encodeURIComponent(tag)}`, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: cookie,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        logger.warn({ tag, status: res.status }, "Facebook mbasic request failed — check FACEBOOK_SESSION_COOKIE");
        continue;
      }

      const html = await res.text();
      if (/log in|login|you must log in/i.test(html) && html.length < 5000) {
        logger.warn({ tag }, "Facebook returned a login wall — the session cookie is likely expired");
        continue;
      }

      const $ = cheerio.load(html);
      $("div[data-ft], article").each((_i, el) => {
        const $el = $(el);
        const text = $el.find("p").text().trim() || $el.text().trim();
        if (!text || text.length < 40) return;

        const href = $el.find("a[href*='/story.php'], a[href*='/permalink']").first().attr("href") ?? "";
        const url = href
          ? href.startsWith("http")
            ? href
            : `https://mbasic.facebook.com${href}`
          : `https://www.facebook.com/hashtag/${tag}`;

        items.push({
          platform: "facebook",
          sourceUrl: url,
          title: null,
          body: text.slice(0, 2000),
          author: $el.find("strong, h3").first().text().trim() || null,
          publishedAt: null,
          language: detectLanguage(text),
          category,
          engagementMetrics: {},
          rawMetadata: { hashtags: extractHashtags(text), source: "cookie", seedTag: tag },
        });
      });
    } catch (err) {
      logger.warn({ tag, err: (err as Error).message }, "Facebook cookie fetch failed");
    }
    // Politeness delay between hashtag requests.
    await new Promise((r) => setTimeout(r, 1500));
  }

  return items;
}

export async function collectFacebook(category: string): Promise<NormalizedItem[]> {
  const tags = seedTags(category);
  if (!tags.length) return [];

  const [apifyToken, actorOverride, fbCookie] = await Promise.all([
    getPlatformConfig("apify_token"),
    getPlatformConfig("apify_facebook_actor"),
    getPlatformConfig("facebook_session_cookie"),
  ]);
  const actor = actorOverride || DEFAULT_ACTOR;

  let items: NormalizedItem[] = [];

  if (apifyToken) {
    try {
      items = await collectViaApify(tags, category, apifyToken, actor);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Facebook Apify collection failed — trying cookie fallback");
    }
    if (items.length) {
      logTrending("facebook", category, items);
      return items;
    }
  }

  if (fbCookie) {
    try {
      items = await collectViaCookie(tags, category, fbCookie);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Facebook cookie collection failed");
    }
    if (items.length) logTrending("facebook", category, items);
    return items;
  }

  if (!apifyToken) {
    logger.warn(
      "Facebook: neither APIFY_TOKEN nor FACEBOOK_SESSION_COOKIE set — skipping Facebook collection",
    );
  }
  return items;
}
