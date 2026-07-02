import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { collectRss } from "./rss";
import type { RssSource } from "./rss";

const PUBLIC_CHANNELS_BY_CATEGORY: Record<string, string[]> = {
  politics: ["bbcnews", "reutersnews", "aljazeera", "cnnbrk", "politico"],
  technology: ["techcrunch", "wired", "TheVerge", "HackerNewsfeed"],
  business: ["reuters_finance", "bloombergmarkets", "cnbc"],
  "southeast-asia": ["malaysiakini_news", "channelnewsasia", "thestar_malaysia", "bangkokpost"],
  society: ["bbcworldservice", "nprnews"],
  health: ["whonews", "medscape"],
  environment: ["bbcclimate", "climatenews"],
  sports: ["bbcsport", "espn"],
  entertainment: ["hollywoodreporter", "variety"],
  crypto: ["coindesk", "cointelegraph"],
};

const RSSHUB_BASE = "https://rsshub.app";
const SELF_HOSTED_RSSHUB = process.env.RSSHUB_URL;

function getRssHubBase(): string {
  return SELF_HOSTED_RSSHUB ?? RSSHUB_BASE;
}

export async function collectTelegram(category: string): Promise<NormalizedItem[]> {
  const channels = PUBLIC_CHANNELS_BY_CATEGORY[category] ?? [];
  if (!channels.length) return [];

  const rssSources: RssSource[] = channels.map((channel) => ({
    name: `Telegram: ${channel}`,
    url: `${getRssHubBase()}/telegram/channel/${channel}`,
    category,
    platform: "telegram",
    language: "en",
  }));

  const items: NormalizedItem[] = [];

  await Promise.allSettled(
    rssSources.map(async (source) => {
      try {
        const collected = await collectRss(source);
        items.push(...collected);
      } catch (err) {
        logger.warn({ err, channel: source.name }, "Telegram channel RSS fetch failed");
      }
    })
  );

  logger.info({ category, collected: items.length }, "Telegram collection complete");
  return items;
}

export async function collectTelegramAllCategories(): Promise<NormalizedItem[]> {
  const categories = Object.keys(PUBLIC_CHANNELS_BY_CATEGORY);
  const results = await Promise.allSettled(
    categories.map((cat) => collectTelegram(cat))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
