import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const BASE_URL = "http://api.mediastack.com/v1/news";

interface MediaStackArticle {
  source?: string;
  author?: string;
  title?: string;
  description?: string;
  url?: string;
  category?: string;
  language?: string;
  country?: string;
  published_at?: string;
}

interface MediaStackResponse {
  data?: MediaStackArticle[];
  error?: { message: string };
}

export async function collectMediaStack(category: string, apiKey: string): Promise<NormalizedItem[]> {
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      access_key: apiKey,
      categories: mapCategory(category),
      languages: "en,ms",
      limit: "50",
      sort: "published_desc",
    });

    const res = await fetch(`${BASE_URL}?${params}`, { signal: AbortSignal.timeout(15000) });
    const data = await res.json() as MediaStackResponse;

    if (data.error) {
      logger.warn({ category, message: data.error.message }, "MediaStack returned error");
      return [];
    }

    return (data.data ?? []).map((a) => ({
      platform: "mediastack",
      sourceUrl: a.url ?? "",
      title: a.title ?? null,
      body: a.description || a.title || "",
      author: a.author || a.source || null,
      publishedAt: a.published_at ? new Date(a.published_at) : null,
      language: a.language ?? "en",
      category,
      engagementMetrics: {},
      rawMetadata: { source: a.source, country: a.country },
    }));
  } catch (err) {
    logger.warn({ err, category }, "MediaStack collection failed");
    return [];
  }
}

function mapCategory(category: string): string {
  const map: Record<string, string> = {
    politics: "general", business: "business", technology: "technology",
    sports: "sports", entertainment: "entertainment", health: "health",
    science: "science",
  };
  return map[category] ?? "general";
}
