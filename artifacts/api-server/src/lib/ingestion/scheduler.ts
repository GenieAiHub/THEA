import { getQueues } from "../queues";
import { CATEGORIES } from "./sources-config";
import { logger } from "../logger";

const RSS_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const GDELT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const TELEGRAM_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const SOCIAL_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const NEWS_API_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const TIKTOK_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;

export async function scheduleIngestion(): Promise<void> {
  const { contentIngestion } = getQueues();

  try {
    await contentIngestion.upsertJobScheduler(
      "rss-all-sources",
      { every: RSS_REFRESH_INTERVAL_MS },
      {
        name: "rss-all",
        data: { sourceType: "rss-all" },
        opts: { attempts: 2, backoff: { type: "exponential", delay: 30000 } },
      }
    );

    await contentIngestion.upsertJobScheduler(
      "gdelt-all-categories",
      { every: GDELT_REFRESH_INTERVAL_MS },
      {
        name: "gdelt",
        data: { sourceType: "gdelt" },
        opts: { attempts: 3, backoff: { type: "exponential", delay: 10000 } },
      }
    );

    await contentIngestion.upsertJobScheduler(
      "telegram-all-channels",
      { every: TELEGRAM_REFRESH_INTERVAL_MS },
      {
        name: "telegram",
        data: { sourceType: "telegram" },
        opts: { attempts: 2 },
      }
    );

    const socialSources = ["twitter", "reddit", "youtube"];
    for (const sourceType of socialSources) {
      for (const category of CATEGORIES.slice(0, 5)) {
        await contentIngestion.upsertJobScheduler(
          `${sourceType}-${category}`,
          { every: SOCIAL_REFRESH_INTERVAL_MS },
          {
            name: sourceType,
            data: { sourceType, category },
            opts: { attempts: 2 },
          }
        );
      }
    }

    for (const category of ["politics", "technology", "business", "society"]) {
      await contentIngestion.upsertJobScheduler(
        `tiktok-${category}`,
        { every: TIKTOK_REFRESH_INTERVAL_MS },
        {
          name: "tiktok",
          data: { sourceType: "tiktok", category },
          opts: { attempts: 1 },
        }
      );
    }

    const newsApiSources = ["newsapi", "mediastack", "bing-news"];
    for (const sourceType of newsApiSources) {
      for (const category of ["politics", "technology", "business", "society", "sports", "health"]) {
        await contentIngestion.upsertJobScheduler(
          `${sourceType}-${category}`,
          { every: NEWS_API_REFRESH_INTERVAL_MS },
          {
            name: sourceType,
            data: { sourceType, category },
            opts: { attempts: 2 },
          }
        );
      }
    }

    logger.info("Content ingestion schedulers registered");
  } catch (err) {
    logger.warn({ err }, "Failed to register some ingestion schedulers — will retry on next startup");
  }
}

export async function triggerImmediateCollection(
  sourceType: string,
  category?: string,
  keyword?: string,
  urls?: string[]
): Promise<void> {
  const { contentIngestion } = getQueues();
  await contentIngestion.add(
    sourceType,
    { sourceType, category, keyword, urls },
    { priority: 1, attempts: 2 }
  );
  logger.info({ sourceType, category, keyword }, "Triggered immediate collection job");
}

export async function triggerRssAll(): Promise<void> {
  await triggerImmediateCollection("rss-all");
}

export async function triggerGdeltAll(): Promise<void> {
  await triggerImmediateCollection("gdelt");
}
