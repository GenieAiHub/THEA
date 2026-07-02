import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const BASE_URL = "https://api.bing.microsoft.com/v7.0/news";

interface BingNewsArticle {
  name?: string;
  description?: string;
  url?: string;
  datePublished?: string;
  provider?: Array<{ name?: string }>;
  category?: string;
}

interface BingNewsResponse {
  value?: BingNewsArticle[];
  error?: { message: string };
}

export async function collectBingNews(keyword: string, apiKey: string, category: string): Promise<NormalizedItem[]> {
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      q: keyword,
      mkt: "en-US",
      count: "50",
      sortBy: "Date",
      freshness: "Day",
    });

    const res = await fetch(`${BASE_URL}/search?${params}`, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, keyword }, "Bing News request failed");
      return [];
    }

    const data = await res.json() as BingNewsResponse;

    return (data.value ?? []).map((a) => ({
      platform: "bing-news",
      sourceUrl: a.url ?? "",
      title: a.name ?? null,
      body: a.description || a.name || "",
      author: a.provider?.[0]?.name ?? null,
      publishedAt: a.datePublished ? new Date(a.datePublished) : null,
      language: "en",
      category,
      engagementMetrics: {},
      rawMetadata: { category: a.category },
    }));
  } catch (err) {
    logger.warn({ err, keyword }, "Bing News collection failed");
    return [];
  }
}
