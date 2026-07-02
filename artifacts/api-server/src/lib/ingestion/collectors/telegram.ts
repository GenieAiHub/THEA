import type { NormalizedItem } from "../types";
import { logger } from "../../logger";
import { detectLanguage } from "../language";
import { getPlatformConfig } from "../../platform-config";
import { collectRss } from "./rss";
import type { RssSource } from "./rss";

const CHANNELS_BY_CATEGORY: Record<string, string[]> = {
  politics: ["bbcnews", "reutersnews", "aljazeera", "cnnbrk", "politico", "thehill"],
  technology: ["techcrunch", "wired_com", "TheVerge", "HackerNewsfeed", "thenextweb"],
  business: ["reuters_finance", "bloombergmarkets", "cnbc", "ft_weekend", "businessinsider"],
  "southeast-asia": ["malaysiakini_news", "channelnewsasia", "thestar_malaysia", "bangkokpost", "jakartapost_en"],
  society: ["bbcworldservice", "nprnews", "theguardian"],
  health: ["whonews", "medscape_news", "stat_news"],
  environment: ["bbcclimate", "carbonglobal", "climatechangenews"],
  sports: ["bbcsport", "espn", "goal_com"],
  entertainment: ["hollywoodreporter", "variety_mag"],
  crypto: ["coindesk", "cointelegraph_en"],
  media: ["niemanlab", "cjr_news"],
  crypto_web3: ["theblockco", "decrypt_media"],
};

const RSSHUB_BASE = "https://rsshub.app";

interface TelegramMessage {
  id: number;
  message?: string;
  date?: number;
  views?: number;
  replies?: { replies?: number };
  peerId?: { channelId?: string };
}

async function collectGramJs(category: string): Promise<NormalizedItem[]> {
  const apiIdStr = (await getPlatformConfig("telegram_api_id")) ?? "";
  const apiHash = (await getPlatformConfig("telegram_api_hash")) ?? "";
  const sessionStr = (await getPlatformConfig("telegram_session")) ?? "";

  if (!apiIdStr || !apiHash || !sessionStr) return [];

  const apiId = parseInt(apiIdStr, 10);
  if (isNaN(apiId)) {
    logger.warn("TELEGRAM_API_ID is not a valid integer");
    return [];
  }

  let TelegramClient: typeof import("telegram").TelegramClient;
  let StringSession: typeof import("telegram/sessions/index.js").StringSession;
  try {
    const telegramMod = await import("telegram");
    const sessionMod = await import("telegram/sessions/index.js");
    TelegramClient = telegramMod.TelegramClient;
    StringSession = sessionMod.StringSession;
  } catch {
    logger.warn("telegram package not available — falling back to RSS");
    return [];
  }

  const channels = CHANNELS_BY_CATEGORY[category] ?? [];
  if (!channels.length) return [];

  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 3,
    retryDelay: 1000,
    autoReconnect: false,
    useIPV6: false,
  });

  const items: NormalizedItem[] = [];

  try {
    await client.connect();

    for (const channel of channels) {
      try {
        const messages = (await client.getMessages(channel, { limit: 20 })) as TelegramMessage[];

        for (const msg of messages) {
          if (!msg.message || msg.message.trim().length < 10) continue;

          items.push({
            platform: "telegram",
            sourceUrl: `https://t.me/${channel}/${msg.id}`,
            title: null,
            body: msg.message.slice(0, 2000),
            author: channel,
            publishedAt: msg.date ? new Date(msg.date * 1000) : null,
            language: detectLanguage(msg.message),
            category,
            engagementMetrics: {
              views: msg.views ?? 0,
              comments: msg.replies?.replies ?? 0,
            },
            rawMetadata: { channel, messageId: msg.id },
          });
        }
      } catch (err) {
        logger.warn({ channel, err: (err as Error).message }, "GramJS: channel fetch failed");
      }
    }
  } finally {
    try { await client.disconnect(); } catch {}
  }

  logger.info({ category, collected: items.length, via: "gramjs" }, "Telegram GramJS collection complete");
  return items;
}

async function collectRssHubFallback(category: string): Promise<NormalizedItem[]> {
  const channels = CHANNELS_BY_CATEGORY[category] ?? [];
  if (!channels.length) return [];

  const rsshubBase = (await getPlatformConfig("rsshub_url")) ?? RSSHUB_BASE;
  const rssSources: RssSource[] = channels.map((channel) => ({
    name: `Telegram: ${channel}`,
    url: `${rsshubBase}/telegram/channel/${channel}`,
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
        logger.warn({ channel: source.name, err: (err as Error).message }, "Telegram RSS fallback failed");
      }
    })
  );
  return items;
}

export async function collectTelegram(category: string): Promise<NormalizedItem[]> {
  const [tgApiId, tgApiHash, tgSession] = await Promise.all([
    getPlatformConfig("telegram_api_id"),
    getPlatformConfig("telegram_api_hash"),
    getPlatformConfig("telegram_session"),
  ]);
  const hasGramJsConfig = !!(tgApiId && tgApiHash && tgSession);

  if (hasGramJsConfig) {
    try {
      const items = await collectGramJs(category);
      if (items.length > 0) return items;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "GramJS collection failed — falling back to RSS");
    }
  }

  return collectRssHubFallback(category);
}

export async function collectTelegramAllCategories(): Promise<NormalizedItem[]> {
  const categories = Object.keys(CHANNELS_BY_CATEGORY);
  const results = await Promise.allSettled(
    categories.map((cat) => collectTelegram(cat))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
