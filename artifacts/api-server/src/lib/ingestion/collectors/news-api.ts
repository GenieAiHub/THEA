import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const BASE_URL = "https://newsapi.org/v2";

interface NewsApiArticle {
  source?: { name?: string };
  author?: string;
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  publishedAt?: string;
}

interface NewsApiResponse {
  status?: string;
  articles?: NewsApiArticle[];
  message?: string;
}

export async function collectNewsApi(category: string, apiKey: string): Promise<NormalizedItem[]> {
  if (!apiKey) return [];

  try {
    const topHeadlines = await fetchHeadlines(category, apiKey);
    return topHeadlines;
  } catch (err) {
    logger.warn({ err, category }, "NewsAPI collection failed");
    return [];
  }
}

async function fetchHeadlines(category: string, apiKey: string): Promise<NormalizedItem[]> {
  const newsCategory = mapCategory(category);
  const url = newsCategory
    ? `${BASE_URL}/top-headlines?category=${newsCategory}&language=en&pageSize=50&apiKey=${apiKey}`
    : `${BASE_URL}/everything?q=${encodeURIComponent(category)}&language=en&sortBy=publishedAt&pageSize=50&apiKey=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await res.json() as NewsApiResponse;

  if (data.status !== "ok" || !data.articles) {
    logger.warn({ category, message: data.message }, "NewsAPI returned error");
    return [];
  }

  return data.articles.map((a) => ({
    platform: "newsapi",
    sourceUrl: a.url ?? "",
    title: a.title ?? null,
    body: a.content || a.description || a.title || "",
    author: a.author || a.source?.name || null,
    publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
    language: "en",
    category,
    engagementMetrics: {},
    rawMetadata: { source: a.source },
  }));
}

function mapCategory(category: string): string | null {
  const map: Record<string, string> = {
    politics: "politics", business: "business", technology: "technology",
    sports: "sports", entertainment: "entertainment", health: "health",
    science: "science",
  };
  return map[category] ?? null;
}
