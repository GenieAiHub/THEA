import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { fetchWithJina } from "./serp";

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

interface BraveResult {
  url: string;
  title: string;
  description?: string;
  meta_url?: { hostname?: string };
}

interface BraveSearchResponse {
  web?: { results?: BraveResult[] };
}

/**
 * Brave Search is the default web-search collector: privacy-focused, server-friendly,
 * and works from any IP with a valid BRAVE_API_KEY. No Replit proxy required —
 * bring your own key and deploy anywhere.
 */
export async function collectBrave(keyword: string, category: string, apiKey: string): Promise<NormalizedItem[]> {
  if (!keyword || !apiKey) return [];

  try {
    const params = new URLSearchParams({
      q: keyword,
      count: "5",
      freshness: "pd",
      text_decorations: "false",
      search_lang: "en",
    });

    const resp = await fetch(`${BRAVE_SEARCH_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) {
      logger.warn({ status: resp.status, keyword }, "Brave Search returned non-200");
      return [];
    }

    const data = (await resp.json()) as BraveSearchResponse;
    const results = data.web?.results ?? [];

    if (!results.length) return [];

    const items: NormalizedItem[] = [];

    await Promise.allSettled(
      results.map(async (r) => {
        const url = r.url;
        if (!url) return;

        const body = (await fetchWithJina(url)) || r.description || r.title || "";

        items.push({
          platform: "brave",
          sourceUrl: url,
          title: r.title ?? null,
          body: body || r.description || r.title || "",
          author: r.meta_url?.hostname ?? null,
          publishedAt: null,
          language: "en",
          category,
          engagementMetrics: {},
          rawMetadata: { keyword },
        });
      }),
    );

    return items;
  } catch (err) {
    logger.warn({ err, keyword }, "Brave Search collection failed");
    return [];
  }
}
