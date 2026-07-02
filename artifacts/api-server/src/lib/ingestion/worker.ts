import { createWorker } from "../queues";
import { db } from "@workspace/db";
import { crawlerSourcesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { ingestItems } from "./pipeline";
import { startRun, completeRun, failRun } from "./run-tracker";
import { collectRssBatch } from "./collectors/rss";
import type { RssSource } from "./collectors/rss";
import { collectGdelt, collectGdeltAllCategories } from "./collectors/gdelt";
import { collectNewsApi } from "./collectors/news-api";
import { collectMediaStack } from "./collectors/mediastack";
import { collectBingNews } from "./collectors/bing-news";
import { collectTwitter } from "./collectors/twitter";
import { collectReddit } from "./collectors/reddit";
import { collectYouTube } from "./collectors/youtube";
import { collectSerp } from "./collectors/serp";
import { crawlUrls } from "./collectors/web-crawler";
import { collectTelegram, collectTelegramAllCategories } from "./collectors/telegram";
import { collectTikTok } from "./collectors/tiktok";
import { PRECONFIGURED_SOURCES, getSourcesByCategory } from "./sources-config";
import type { IngestionJobData } from "./types";
import { logger } from "../logger";

function getEnv(key: string): string {
  return process.env[key] ?? "";
}

async function getActiveRssSources(category?: string): Promise<RssSource[]> {
  const baseline: RssSource[] = category ? getSourcesByCategory(category) : PRECONFIGURED_SOURCES;
  const seenUrls = new Set(baseline.map((s) => s.url));

  try {
    const conditions = [
      eq(crawlerSourcesTable.isActive, true),
      eq(crawlerSourcesTable.type, "rss"),
    ];
    if (category) conditions.push(eq(crawlerSourcesTable.category, category));

    const rows = await db
      .select({
        name: crawlerSourcesTable.name,
        url: crawlerSourcesTable.url,
        category: crawlerSourcesTable.category,
        language: crawlerSourcesTable.language,
      })
      .from(crawlerSourcesTable)
      .where(and(...conditions));

    const dbSources: RssSource[] = rows
      .filter((r) => !seenUrls.has(r.url))
      .map((r) => ({
        name: r.name,
        url: r.url,
        category: r.category,
        language: r.language ?? "en",
        platform: "rss",
      }));

    return [...baseline, ...dbSources];
  } catch (err) {
    logger.warn({ err }, "Could not load additional RSS sources from DB — using preconfigured list only");
    return baseline;
  }
}

export function startContentIngestionWorker(): void {
  createWorker<IngestionJobData>("content-ingestion", async (job) => {
    const { sourceType, sourceId, category, keyword, urls } = job.data;
    const runId = await startRun(sourceType, sourceId);
    let stats = { fetched: 0, deduplicated: 0, stored: 0 };

    logger.info({ sourceType, category, keyword, jobId: job.id }, "Content ingestion job started");

    try {
      switch (sourceType) {
        case "rss-all": {
          const sources = await getActiveRssSources();
          const items = await collectRssBatch(sources);
          stats = await ingestItems(items);
          break;
        }

        case "rss-batch": {
          const sources = await getActiveRssSources(category);
          const items = await collectRssBatch(sources);
          stats = await ingestItems(items);
          break;
        }

        case "gdelt": {
          const items = category
            ? await collectGdelt(category)
            : await collectGdeltAllCategories();
          stats = await ingestItems(items);
          break;
        }

        case "newsapi": {
          const apiKey = getEnv("NEWS_API_KEY");
          if (!apiKey) { logger.warn("NEWS_API_KEY not set — skipping NewsAPI collection"); break; }
          const items = await collectNewsApi(category ?? "general", apiKey);
          stats = await ingestItems(items);
          break;
        }

        case "mediastack": {
          const apiKey = getEnv("MEDIASTACK_API_KEY");
          if (!apiKey) { logger.warn("MEDIASTACK_API_KEY not set — skipping MediaStack collection"); break; }
          const items = await collectMediaStack(category ?? "general", apiKey);
          stats = await ingestItems(items);
          break;
        }

        case "bing-news": {
          const apiKey = getEnv("BING_NEWS_API_KEY");
          if (!apiKey) { logger.warn("BING_NEWS_API_KEY not set — skipping Bing News collection"); break; }
          const items = await collectBingNews(keyword ?? category ?? "news", apiKey, category ?? "general");
          stats = await ingestItems(items);
          break;
        }

        case "twitter": {
          const bearerToken = getEnv("TWITTER_BEARER_TOKEN");
          if (!bearerToken) { logger.warn("TWITTER_BEARER_TOKEN not set — skipping Twitter collection"); break; }
          const items = await collectTwitter(category ?? "general", bearerToken);
          stats = await ingestItems(items);
          break;
        }

        case "reddit": {
          const clientId = getEnv("REDDIT_CLIENT_ID");
          const clientSecret = getEnv("REDDIT_CLIENT_SECRET");
          if (!clientId || !clientSecret) { logger.warn("REDDIT_CLIENT_ID/SECRET not set — skipping Reddit collection"); break; }
          const items = await collectReddit(category ?? "general", clientId, clientSecret);
          stats = await ingestItems(items);
          break;
        }

        case "youtube": {
          const apiKey = getEnv("YOUTUBE_API_KEY");
          if (!apiKey) { logger.warn("YOUTUBE_API_KEY not set — skipping YouTube collection"); break; }
          const items = await collectYouTube(category ?? "general", apiKey);
          stats = await ingestItems(items);
          break;
        }

        case "serp": {
          const apiKey = getEnv("SERP_API_KEY");
          if (!apiKey) { logger.warn("SERP_API_KEY not set — skipping SerpAPI collection"); break; }
          const items = await collectSerp(keyword ?? category ?? "news", apiKey, category ?? "general");
          stats = await ingestItems(items);
          break;
        }

        case "telegram": {
          const items = category
            ? await collectTelegram(category)
            : await collectTelegramAllCategories();
          stats = await ingestItems(items);
          break;
        }

        case "tiktok": {
          const clientKey = getEnv("TIKTOK_CLIENT_KEY");
          const clientSecret = getEnv("TIKTOK_CLIENT_SECRET");
          if (!clientKey || !clientSecret) { logger.warn("TIKTOK_CLIENT_KEY/SECRET not set — skipping TikTok collection"); break; }
          const items = await collectTikTok(category ?? "general", clientKey, clientSecret);
          stats = await ingestItems(items);
          break;
        }

        case "web-crawler": {
          const crawlUrls_ = urls ?? [];
          if (!crawlUrls_.length) { logger.warn("No URLs provided for web-crawler job"); break; }
          const items = await crawlUrls(crawlUrls_, category ?? "general");
          stats = await ingestItems(items);
          break;
        }

        default:
          logger.warn({ sourceType }, "Unknown ingestion source type");
      }

      await completeRun(runId, sourceId, stats.fetched, stats.deduplicated, stats.stored, { category, keyword });
      logger.info({ sourceType, category, ...stats }, "Content ingestion job complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await failRun(runId, sourceId, msg);
      throw err;
    }
  });
}
