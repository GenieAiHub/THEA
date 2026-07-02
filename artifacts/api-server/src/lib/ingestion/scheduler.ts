import { getQueues } from "../queues";
import { db } from "@workspace/db";
import { crawlerSourcesTable, watchlistKeywordsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { PRECONFIGURED_SOURCES } from "./sources-config";
import { PLATFORM_ORG_ID } from "./system-org";
import { logger } from "../logger";

const RSS_INTERVAL_MS = 15 * 60 * 1000;
const GDELT_INTERVAL_MS = 15 * 60 * 1000;
const TELEGRAM_INTERVAL_MS = 30 * 60 * 1000;
const SOCIAL_INTERVAL_MS = 60 * 60 * 1000;
const NEWS_API_INTERVAL_MS = 60 * 60 * 1000;
const TIKTOK_INTERVAL_MS = 2 * 60 * 60 * 1000;
const CRAWLER_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SEARCH_INTERVAL_MS = 4 * 60 * 60 * 1000;

async function getActiveCategories(): Promise<string[]> {
  try {
    const rows = await db
      .selectDistinct({ category: crawlerSourcesTable.category })
      .from(crawlerSourcesTable)
      .where(eq(crawlerSourcesTable.isActive, true));

    if (rows.length > 0) {
      return rows.map((r) => r.category).filter(Boolean) as string[];
    }
  } catch (err) {
    logger.warn({ err }, "Could not read active categories from DB — using preconfigured list");
  }
  return [...new Set(PRECONFIGURED_SOURCES.map((s) => s.category))];
}

async function scheduleWebCrawlerSources(): Promise<void> {
  const { contentIngestion } = getQueues();
  try {
    const rows = await db
      .select({
        url: crawlerSourcesTable.url,
        category: crawlerSourcesTable.category,
      })
      .from(crawlerSourcesTable)
      .where(
        and(
          eq(crawlerSourcesTable.isActive, true),
          eq(crawlerSourcesTable.type, "web")
        )
      );

    if (!rows.length) return;

    const byCategory = new Map<string, string[]>();
    for (const row of rows) {
      const cat = row.category;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(row.url);
    }

    for (const [category, urls] of byCategory) {
      await contentIngestion.upsertJobScheduler(
        `web-crawler-${category}`,
        { every: CRAWLER_INTERVAL_MS },
        {
          name: "web-crawler",
          data: { sourceType: "web-crawler", category, urls },
          opts: { attempts: 2, backoff: { type: "exponential", delay: 60000 } },
        }
      );
    }

    logger.info(
      { categories: byCategory.size, sources: rows.length },
      "Web crawler sources scheduled from DB"
    );
  } catch (err) {
    logger.warn({ err }, "Could not schedule web crawler sources from DB");
  }
}

async function scheduleSearchKeywords(): Promise<void> {
  const { contentIngestion } = getQueues();
  try {
    const keywords = await db
      .select({
        keyword: watchlistKeywordsTable.keyword,
        category: watchlistKeywordsTable.category,
        orgId: watchlistKeywordsTable.orgId,
      })
      .from(watchlistKeywordsTable)
      .where(eq(watchlistKeywordsTable.isActive, true));

    if (!keywords.length) {
      logger.info("No active watchlist keywords found — skipping search scheduling");
      return;
    }

    for (const { keyword, category, orgId } of keywords) {
      const slug = keyword.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const orgSlug = orgId.slice(0, 8);
      await contentIngestion.upsertJobScheduler(
        `search-keyword-${slug}-${orgSlug}`,
        { every: SEARCH_INTERVAL_MS },
        {
          name: "duckduckgo",
          data: {
            sourceType: "duckduckgo",
            keyword,
            category: category ?? "general",
            orgId,
          },
          opts: { attempts: 2, backoff: { type: "exponential", delay: 30000 } },
        }
      );
    }

    logger.info({ count: keywords.length }, "DuckDuckGo search keyword schedulers registered from watchlist (all orgs)");
  } catch (err) {
    logger.warn({ err }, "Could not schedule search keyword jobs from watchlist_keywords");
  }
}

/**
 * Schedule per-org watchlist collection jobs — runs every 15 minutes.
 * Each org gets its own job to collect content matching their watchlist terms
 * from DuckDuckGo (default) plus Bing News and SerpAPI when configured.
 */
async function scheduleWatchlistCollectionJobs(): Promise<void> {
  const { contentIngestion } = getQueues();
  try {
    // Get distinct org IDs that have active watchlist keywords
    const orgs = await db
      .selectDistinct({ orgId: watchlistKeywordsTable.orgId })
      .from(watchlistKeywordsTable)
      .where(and(eq(watchlistKeywordsTable.isActive, true)));

    for (const { orgId } of orgs) {
      const orgSlug = orgId.slice(0, 8);
      await contentIngestion.upsertJobScheduler(
        `watchlist-collect-${orgSlug}`,
        { every: RSS_INTERVAL_MS }, // 15 minutes
        {
          name: "watchlist-scan",
          data: { sourceType: "watchlist-scan", orgId },
          opts: { attempts: 2, backoff: { type: "exponential", delay: 15000 } },
        }
      );
    }

    logger.info({ orgCount: orgs.length }, "Per-org watchlist collection schedulers registered");
  } catch (err) {
    logger.warn({ err }, "Could not schedule per-org watchlist collection jobs");
  }
}

/**
 * Schedule per-org spike analysis — runs every 15 minutes, offset by 5 minutes
 * from the collection jobs so analysis runs after new data is ingested.
 */
async function scheduleWatchlistAnalysisJobs(): Promise<void> {
  const { alertDispatch } = getQueues();
  try {
    const orgs = await db
      .selectDistinct({ orgId: watchlistKeywordsTable.orgId })
      .from(watchlistKeywordsTable)
      .where(and(eq(watchlistKeywordsTable.isActive, true)));

    for (const { orgId } of orgs) {
      const orgSlug = orgId.slice(0, 8);
      await alertDispatch.upsertJobScheduler(
        `watchlist-analysis-${orgSlug}`,
        { every: RSS_INTERVAL_MS, immediately: false },
        {
          name: "spike-analysis",
          data: { orgId },
          opts: { attempts: 2, backoff: { type: "fixed", delay: 5000 } },
        }
      );
    }

    logger.info({ orgCount: orgs.length }, "Per-org watchlist spike analysis schedulers registered");
  } catch (err) {
    logger.warn({ err }, "Could not schedule watchlist spike analysis jobs");
  }
}

export async function scheduleIngestion(): Promise<void> {
  const { contentIngestion } = getQueues();
  const allCategories = await getActiveCategories();

  logger.info({ categoryCount: allCategories.length }, "Scheduling ingestion across active categories");

  try {
    await contentIngestion.upsertJobScheduler(
      "rss-all-sources",
      { every: RSS_INTERVAL_MS },
      {
        name: "rss-all",
        data: { sourceType: "rss-all" },
        opts: { attempts: 2, backoff: { type: "exponential", delay: 30000 } },
      }
    );

    await contentIngestion.upsertJobScheduler(
      "gdelt-all-categories",
      { every: GDELT_INTERVAL_MS },
      {
        name: "gdelt",
        data: { sourceType: "gdelt" },
        opts: { attempts: 3, backoff: { type: "exponential", delay: 10000 } },
      }
    );

    await contentIngestion.upsertJobScheduler(
      "telegram-all-channels",
      { every: TELEGRAM_INTERVAL_MS },
      {
        name: "telegram",
        data: { sourceType: "telegram" },
        opts: { attempts: 2, backoff: { type: "fixed", delay: 5000 } },
      }
    );

    const socialSources: Array<{ type: string; backoffDelay: number }> = [
      { type: "twitter", backoffDelay: 60000 },
      { type: "reddit", backoffDelay: 30000 },
      { type: "youtube", backoffDelay: 30000 },
    ];
    for (const { type, backoffDelay } of socialSources) {
      for (const category of allCategories) {
        await contentIngestion.upsertJobScheduler(
          `${type}-${category}`,
          { every: SOCIAL_INTERVAL_MS },
          {
            name: type,
            data: { sourceType: type, category },
            opts: { attempts: 3, backoff: { type: "exponential", delay: backoffDelay } },
          }
        );
      }
    }

    for (const category of allCategories) {
      await contentIngestion.upsertJobScheduler(
        `tiktok-${category}`,
        { every: TIKTOK_INTERVAL_MS },
        {
          name: "tiktok",
          data: { sourceType: "tiktok", category },
          opts: { attempts: 1 },
        }
      );
    }

    const newsApiSources: Array<{ type: string; backoffDelay: number }> = [
      { type: "newsapi", backoffDelay: 120000 },
      { type: "mediastack", backoffDelay: 60000 },
      { type: "bing-news", backoffDelay: 60000 },
    ];
    for (const { type, backoffDelay } of newsApiSources) {
      for (const category of allCategories) {
        await contentIngestion.upsertJobScheduler(
          `${type}-${category}`,
          { every: NEWS_API_INTERVAL_MS },
          {
            name: type,
            data: { sourceType: type, category },
            opts: { attempts: 2, backoff: { type: "exponential", delay: backoffDelay } },
          }
        );
      }
    }

    await scheduleWebCrawlerSources();
    await scheduleSearchKeywords();
    await scheduleWatchlistCollectionJobs();
    await scheduleWatchlistAnalysisJobs();

    logger.info({ scheduledCategories: allCategories.length }, "Content ingestion schedulers registered");
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
    { priority: 1, attempts: 2, backoff: { type: "exponential", delay: 5000 } }
  );
  logger.info({ sourceType, category, keyword }, "Triggered immediate collection job");
}

export async function triggerRssAll(): Promise<void> {
  await triggerImmediateCollection("rss-all");
}

export async function triggerGdeltAll(): Promise<void> {
  await triggerImmediateCollection("gdelt");
}
