import { logger } from "../../logger";
import type { NormalizedItem } from "../types";

// Unicode-aware hashtag matcher (supports non-Latin scripts).
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

/** Extract unique, lower-cased hashtags from a caption/post body. */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = text.match(HASHTAG_RE);
  if (!found) return [];
  return [...new Set(found.map((h) => h.toLowerCase()))];
}

export interface TrendingHashtag {
  tag: string;
  count: number;
  engagement: number;
  score: number;
}

/**
 * Rank hashtags across a batch of scraped posts by frequency weighted by
 * engagement. Reads per-item hashtags from `rawMetadata.hashtags` when present,
 * otherwise re-extracts them from the body.
 */
export function rankTrendingHashtags(items: NormalizedItem[], limit = 25): TrendingHashtag[] {
  const map = new Map<string, { count: number; engagement: number }>();

  for (const item of items) {
    const metaTags = item.rawMetadata?.hashtags;
    const tags = Array.isArray(metaTags) ? (metaTags as string[]) : extractHashtags(item.body);
    const em = item.engagementMetrics ?? {};
    const engagement =
      (em.likes ?? 0) + (em.comments ?? 0) + (em.shares ?? 0) + (em.views ?? 0) * 0.01;

    for (const rawTag of tags) {
      const tag = rawTag.toLowerCase();
      const cur = map.get(tag) ?? { count: 0, engagement: 0 };
      cur.count += 1;
      cur.engagement += engagement;
      map.set(tag, cur);
    }
  }

  return [...map.entries()]
    .map(([tag, v]) => ({
      tag,
      count: v.count,
      engagement: Math.round(v.engagement),
      score: Math.round(v.count * (1 + Math.log10(1 + v.engagement)) * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Compute and log the trending hashtags for a collector run (visibility for operators). */
export function logTrending(platform: string, category: string, items: NormalizedItem[]): TrendingHashtag[] {
  const trending = rankTrendingHashtags(items);
  if (trending.length) {
    logger.info(
      { platform, category, posts: items.length, top: trending.slice(0, 10).map((t) => `${t.tag}(${t.count})`) },
      "Trending hashtags computed",
    );
  }
  return trending;
}
