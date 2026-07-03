import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { extractHashtags, logTrending } from "./hashtags";
import { fetchWithJina } from "./serp";
import { detectLanguage } from "../language";
import { chatWithDeepSeek } from "../../llm";

const MAX_URLS = 10;
const MAX_CONTENT_CHARS = 12000;

interface DeepSeekExtraction {
  title?: string;
  summary?: string;
  topics?: string[];
  sentiment?: string;
}

/** DeepSeek is asked to return only JSON; pull the first {...} block out safely. */
function parseJsonBlock(raw: string): DeepSeekExtraction | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as DeepSeekExtraction;
  } catch {
    return null;
  }
}

/**
 * DeepSeek-powered URL crawler. We fetch each URL's readable text (via the Jina
 * reader) and hand it to DeepSeek, which extracts a clean title, a concise
 * factual summary, key topics, and overall sentiment. That is how an LLM
 * "crawls" a page: the fetch is ours, the reading/extraction is DeepSeek's.
 *
 * Needs a DeepSeek API key (Super Admin → API Keys); the worker gates on it.
 * LLM-billable, so it runs on-demand (triggered with a URL list) rather than on
 * a broad schedule.
 */
export async function collectDeepSeekCrawl(urls: string[], category: string): Promise<NormalizedItem[]> {
  if (!urls?.length) return [];

  const items: NormalizedItem[] = [];

  for (const url of urls.slice(0, MAX_URLS)) {
    try {
      const content = await fetchWithJina(url);
      if (!content || content.length < 80) {
        logger.warn({ url }, "DeepSeek crawl: no readable content fetched");
        continue;
      }

      const prompt =
        `Extract the key information from the following web page and respond with ONLY a JSON object ` +
        `with these fields: "title" (string), "summary" (a concise factual summary, 2-4 sentences), ` +
        `"topics" (array of short topic strings), "sentiment" (one of "positive", "neutral", "negative"). ` +
        `Do not include any text outside the JSON.\n\nURL: ${url}\n\nPAGE CONTENT:\n${content.slice(0, MAX_CONTENT_CHARS)}`;

      const resp = await chatWithDeepSeek(
        [{ role: "user", content: prompt }],
        { operation: "ingestion-deepseek-crawl" },
      );

      const extracted = parseJsonBlock(resp.content);
      const summary = extracted?.summary?.trim() ?? "";
      // pipeline.ts drops bodies < 10 chars before hashing — skip early.
      if (summary.length < 10) {
        logger.warn({ url }, "DeepSeek crawl: extraction produced no usable summary");
        continue;
      }

      let host: string | null = null;
      try { host = new URL(url).hostname; } catch { host = null; }

      items.push({
        platform: "web",
        sourceUrl: url,
        title: extracted?.title?.trim() || null,
        body: summary,
        author: host,
        publishedAt: null,
        language: detectLanguage(summary),
        category,
        engagementMetrics: {},
        rawMetadata: {
          engine: "deepseek-crawl",
          topics: extracted?.topics ?? [],
          sentiment: extracted?.sentiment ?? null,
          hashtags: extractHashtags(summary),
          domain: host,
        },
      });
    } catch (err) {
      logger.warn({ err, url }, "DeepSeek crawl failed for URL");
    }
  }

  if (items.length) logTrending("deepseek-crawl", category, items);
  logger.info({ category, fetched: items.length }, "DeepSeek crawl collection complete");
  return items;
}
