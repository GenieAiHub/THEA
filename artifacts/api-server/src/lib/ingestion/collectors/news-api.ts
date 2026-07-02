import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const BASE_URL = "https://newsapi.org/v2";

const NEWSAPI_CATEGORIES = new Set([
  "business", "entertainment", "general", "health", "science", "sports", "technology",
]);

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

function mapToNewsApiCategory(category: string): string | null {
  if (NEWSAPI_CATEGORIES.has(category)) return category;
  const fallbacks: Record<string, string> = {
    politics: "general",
    society: "general",
    environment: "science",
    crypto: "business",
    "southeast-asia": "general",
    media: "entertainment",
  };
  return fallbacks[category] ?? null;
}

export async function collectNewsApi(category: string, apiKey: string): Promise<NormalizedItem[]> {
  if (!apiKey) return [];

  try {
    const newsCategory = mapToNewsApiCategory(category);
    const items = await fetchArticles(category, newsCategory, apiKey);
    return items;
  } catch (err) {
    logger.warn({ err, category }, "NewsAPI collection failed");
    return [];
  }
}

async function fetchArticles(category: string, newsCategory: string | null, apiKey: string): Promise<NormalizedItem[]> {
  let url: string;

  if (newsCategory && NEWSAPI_CATEGORIES.has(newsCategory)) {
    url = `${BASE_URL}/top-headlines?category=${newsCategory}&language=en&pageSize=100&apiKey=${apiKey}`;
  } else {
    url = `${BASE_URL}/everything?q=${encodeURIComponent(category)}&language=en&sortBy=publishedAt&pageSize=100&from=${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}&apiKey=${apiKey}`;
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await res.json() as NewsApiResponse;

  if (data.status !== "ok" || !data.articles) {
    logger.warn({ category, message: data.message }, "NewsAPI returned error");
    return [];
  }

  return data.articles
    .filter((a) => a.title && a.title !== "[Removed]")
    .map((a) => ({
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
