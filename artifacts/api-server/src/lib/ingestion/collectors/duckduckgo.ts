import { search, SafeSearchType, SearchTimeType } from "duck-duck-scrape";
import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { fetchWithJina } from "./serp";

/**
 * DuckDuckGo is the default web-search collector: it requires no API key, so
 * keyword-driven search ingestion works out of the box. SerpAPI and Bing News
 * remain available as optional enhancers when their keys are configured.
 */
export async function collectDuckDuckGo(keyword: string, category: string): Promise<NormalizedItem[]> {
  if (!keyword) return [];

  try {
    const response = await search(
      keyword,
      { safeSearch: SafeSearchType.OFF, time: SearchTimeType.DAY },
      { open_timeout: 15000, response_timeout: 20000 },
    );

    if (response.noResults || !response.results?.length) return [];

    const items: NormalizedItem[] = [];

    await Promise.allSettled(
      response.results.slice(0, 5).map(async (r) => {
        const url = r.url;
        if (!url) return;

        const body = (await fetchWithJina(url)) || r.description || r.title || "";

        items.push({
          platform: "duckduckgo",
          sourceUrl: url,
          title: r.title ?? null,
          body: body || r.description || r.title || "",
          author: r.hostname ?? null,
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
    logger.warn({ err, keyword }, "DuckDuckGo collection failed");
    return [];
  }
}
