import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { normalizeBody } from "../normalizer";

const SERP_BASE = "https://serpapi.com/search.json";
const JINA_BASE = "https://r.jina.ai";

interface SerpResult {
  link?: string;
  title?: string;
  snippet?: string;
  displayed_link?: string;
  date?: string;
}

interface SerpResponse {
  organic_results?: SerpResult[];
  error?: string;
}

export async function collectSerp(keyword: string, apiKey: string, category: string): Promise<NormalizedItem[]> {
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      q: keyword,
      api_key: apiKey,
      num: "10",
      hl: "en",
      gl: "us",
      tbs: "qdr:d",
    });

    const res = await fetch(`${SERP_BASE}?${params}`, { signal: AbortSignal.timeout(20000) });

    if (!res.ok) {
      logger.warn({ status: res.status, keyword }, "SerpAPI request failed");
      return [];
    }

    const data = await res.json() as SerpResponse;

    if (data.error) {
      logger.warn({ error: data.error, keyword }, "SerpAPI error");
      return [];
    }

    const results = data.organic_results ?? [];
    const items: NormalizedItem[] = [];

    await Promise.allSettled(
      results.slice(0, 5).map(async (r) => {
        const url = r.link;
        if (!url) return;

        const body = await fetchWithJina(url) || r.snippet || r.title || "";

        items.push({
          platform: "serp",
          sourceUrl: url,
          title: r.title ?? null,
          body: body || r.snippet || r.title || "",
          author: r.displayed_link ?? null,
          publishedAt: r.date ? new Date(r.date) : null,
          language: "en",
          category,
          engagementMetrics: {},
          rawMetadata: { keyword },
        });
      })
    );

    return items;
  } catch (err) {
    logger.warn({ err, keyword }, "SerpAPI collection failed");
    return [];
  }
}

export async function fetchWithJina(url: string): Promise<string> {
  try {
    const res = await fetch(`${JINA_BASE}/${url}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "text",
        "User-Agent": "THEA-Intelligence-Bot/1.0",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return "";
    const text = await res.text();
    return normalizeBody(text);
  } catch {
    return "";
  }
}
