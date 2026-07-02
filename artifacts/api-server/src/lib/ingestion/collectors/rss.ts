import Parser from "rss-parser";
import type { NormalizedItem } from "../types";
import { logger } from "../../logger";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "THEA-Intelligence-Bot/1.0 (+https://thea.ai/bot)" },
  customFields: {
    item: ["media:description", "content:encoded", "dc:creator"],
  },
});

export interface RssSource {
  name: string;
  url: string;
  category: string;
  language?: string;
  platform?: string;
}

export async function collectRss(source: RssSource): Promise<NormalizedItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    const items: NormalizedItem[] = [];

    for (const entry of (feed.items ?? []).slice(0, 50)) {
      const body =
        (entry as any)["content:encoded"] ||
        entry.content ||
        (entry as any)["media:description"] ||
        entry.summary ||
        entry.title ||
        "";

      if (!body && !entry.title) continue;

      items.push({
        platform: source.platform ?? "rss",
        sourceUrl: entry.link ?? entry.guid ?? "",
        title: entry.title ?? null,
        body: body || entry.title || "",
        author: (entry as any)["dc:creator"] || (entry as any).creator || (entry as any).author || null,
        publishedAt: entry.pubDate ? new Date(entry.pubDate) : entry.isoDate ? new Date(entry.isoDate) : null,
        language: source.language ?? "en",
        category: source.category,
        engagementMetrics: {},
        rawMetadata: { feedTitle: feed.title, feedUrl: source.url },
      });
    }

    return items;
  } catch (err) {
    logger.warn({ err, url: source.url, name: source.name }, "RSS fetch failed");
    return [];
  }
}

export async function collectRssBatch(sources: RssSource[]): Promise<NormalizedItem[]> {
  const results = await Promise.allSettled(
    sources.map((s) => collectRss(s))
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
