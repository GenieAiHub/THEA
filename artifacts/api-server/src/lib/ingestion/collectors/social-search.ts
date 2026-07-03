import { SafeSearchType, SearchTimeType } from "duck-duck-scrape";
import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { extractHashtags, logTrending } from "./hashtags";
import { throttledDdgSearch } from "./ddg-throttle";

interface SocialPlatform {
  /** Stored `platform` label on the NormalizedItem. */
  label: string;
  /** Domains used both for the `site:` query and for host verification. */
  domains: string[];
}

/**
 * All platforms discovered via search. The first domain of each is used in the
 * `site:` query; every domain is used to verify a result really belongs to the
 * platform (search engines occasionally leak cross-domain results).
 */
const PLATFORMS: SocialPlatform[] = [
  { label: "instagram", domains: ["instagram.com"] },
  { label: "facebook", domains: ["facebook.com", "m.facebook.com"] },
  { label: "twitter", domains: ["twitter.com", "x.com"] },
  { label: "tiktok", domains: ["tiktok.com"] },
  { label: "reddit", domains: ["reddit.com"] },
  { label: "linkedin", domains: ["linkedin.com"] },
  { label: "youtube", domains: ["youtube.com", "youtu.be"] },
];

const RESULTS_PER_PLATFORM = 4;

/**
 * Keyless social-media discovery via web search. For each platform we run a
 * `site:`-scoped DuckDuckGo query (e.g. `site:instagram.com <keyword>`) and turn
 * the indexed public posts into NormalizedItems, tagging each with its real
 * platform and extracting hashtags from the snippet.
 *
 * Needs no API key, token, or session cookie — the trade-off is coverage: it
 * only finds posts public and indexed enough to appear in search results, and
 * it is not real-time (empty engagementMetrics / null publishedAt). It is the
 * reliable keyless path for platforms where direct/cookie scraping is blocked
 * (notably Facebook). All DDG queries are serialized via the shared throttle.
 */
export async function collectSocialSearch(keyword: string, category: string): Promise<NormalizedItem[]> {
  if (!keyword) return [];

  const items: NormalizedItem[] = [];
  let failures = 0;

  for (const platform of PLATFORMS) {
    const query = `site:${platform.domains[0]} ${keyword}`;

    try {
      const response = await throttledDdgSearch(
        query,
        { safeSearch: SafeSearchType.OFF, time: SearchTimeType.WEEK },
        { open_timeout: 15000, response_timeout: 20000 },
      );

      if (!response.noResults && response.results?.length) {
        for (const r of response.results.slice(0, RESULTS_PER_PLATFORM)) {
          const url = r.url;
          if (!url) continue;

          // Keep only results that actually live on this platform's domain(s).
          const host = r.hostname ?? url;
          if (!platform.domains.some((d) => host.includes(d))) continue;

          const body = (r.description || r.title || "").trim();
          // pipeline.ts drops bodies < 10 chars before hashing — skip early.
          if (body.length < 10) continue;

          items.push({
            platform: platform.label,
            sourceUrl: url,
            title: r.title ?? null,
            body,
            author: r.hostname ?? null,
            publishedAt: null,
            language: "en",
            category,
            engagementMetrics: {},
            rawMetadata: {
              keyword,
              engine: "social-search",
              hashtags: extractHashtags(`${r.title ?? ""} ${r.description ?? ""}`),
            },
          });
        }
      }
    } catch (err) {
      failures += 1;
      logger.warn({ err, platform: platform.label, keyword }, "Social search failed for platform");
    }
  }

  // A full sweep of failures usually means DuckDuckGo soft-blocked us — surface
  // it as one clear signal rather than only N per-platform warns.
  if (failures === PLATFORMS.length) {
    logger.warn({ keyword, category }, "Social search: all platform queries failed (possible DuckDuckGo rate-limit/block)");
  }

  if (items.length) logTrending("social-search", category, items);
  logger.info({ keyword, category, fetched: items.length }, "Social search (keyword) collection complete");

  return items;
}
