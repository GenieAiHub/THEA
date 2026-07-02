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
import { collectDuckDuckGo } from "./collectors/duckduckgo";
import { crawlUrls } from "./collectors/web-crawler";
import { collectTelegram, collectTelegramAllCategories } from "./collectors/telegram";
import { collectTikTok } from "./collectors/tiktok";
import { PRECONFIGURED_SOURCES, getSourcesByCategory } from "./sources-config";
import type { IngestionJobData } from "./types";
import { logger } from "../logger";
import { watchlistKeywordsTable } from "@workspace/db/schema";
import { persistGeoSignals } from "../geoSignals";

function getEnv(key: string): string {
  return process.env[key] ?? "";
}

async function getActiveRssSources(category?: string): Promise<RssSource[]> {
  const baseline: RssSource[] = category ? getSourcesByCategory(category) : PRECONFIGURED_SOURCES;

  try {
    const typeConditions = [eq(crawlerSourcesTable.type, "rss")];
    if (category) typeConditions.push(eq(crawlerSourcesTable.category, category));

    const allDbRows = await db
      .select({
        name: crawlerSourcesTable.name,
        url: crawlerSourcesTable.url,
        category: crawlerSourcesTable.category,
        language: crawlerSourcesTable.language,
        isActive: crawlerSourcesTable.isActive,
      })
      .from(crawlerSourcesTable)
      .where(and(...typeConditions));

    const inactiveUrls = new Set(allDbRows.filter((r) => !r.isActive).map((r) => r.url));
    const mergedBaseline = baseline.filter((s) => !inactiveUrls.has(s.url));

    const dbOnlySources: RssSource[] = allDbRows
      .filter((r) => r.isActive && !baseline.some((b) => b.url === r.url))
      .map((r) => ({
        name: r.name,
        url: r.url,
        category: r.category,
        language: r.language ?? "en",
        platform: "rss",
      }));

    return [...mergedBaseline, ...dbOnlySources];
  } catch (err) {
    logger.warn({ err }, "Could not load RSS source overrides from DB — using preconfigured list only");
    return baseline;
  }
}

export function startContentIngestionWorker(): void {
  createWorker<IngestionJobData>("content-ingestion", async (job) => {
    const { sourceType, sourceId, category, keyword, urls, orgId } = job.data;
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

        case "duckduckgo": {
          const items = await collectDuckDuckGo(keyword ?? category ?? "news", category ?? "general");
          // Pass orgId so org-scoped search jobs attribute content to the correct org
          stats = await ingestItems(items, orgId);
          break;
        }

        case "serp": {
          const apiKey = getEnv("SERP_API_KEY");
          if (!apiKey) { logger.warn("SERP_API_KEY not set — skipping SerpAPI collection"); break; }
          const items = await collectSerp(keyword ?? category ?? "news", apiKey, category ?? "general");
          // Pass orgId so org-scoped SERP jobs attribute content to the correct org
          stats = await ingestItems(items, orgId);
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

        case "watchlist-scan": {
          if (!orgId) { logger.warn("watchlist-scan job missing orgId — skipping"); break; }

          // DuckDuckGo is the default keyless search engine, so watchlist-scan
          // always runs; Bing News and SerpAPI are optional enhancers.
          const bingKey = getEnv("BING_NEWS_API_KEY");
          const serpKey = getEnv("SERP_API_KEY");

          const orgKeywords = await db
            .select({
              id: watchlistKeywordsTable.id,
              keyword: watchlistKeywordsTable.keyword,
              category: watchlistKeywordsTable.category,
            })
            .from(watchlistKeywordsTable)
            .where(and(eq(watchlistKeywordsTable.orgId, orgId), eq(watchlistKeywordsTable.isActive, true)));

          const newsApiKey = getEnv("NEWS_API_KEY");
          const twitterKey = getEnv("TWITTER_BEARER_TOKEN");
          const redditSecret = getEnv("REDDIT_CLIENT_SECRET");
          const redditId = getEnv("REDDIT_CLIENT_ID");

          let totalFetched = 0, totalDeduplicated = 0, totalStored = 0;
          const keywordSet = new Set<string>();

          // Helper: ingest a batch of items tagged with keyword metadata
          const collectTagged = async (items: Awaited<ReturnType<typeof collectBingNews>>, metaTag: Record<string, string>) => {
            const tagged = items.map((i) => ({ ...i, rawMetadata: { ...i.rawMetadata, ...metaTag } }));
            const s = await ingestItems(tagged, orgId);
            totalFetched += s.fetched; totalDeduplicated += s.deduplicated; totalStored += s.stored;
          };

          // Keyword-targeted sources (Bing News + SerpAPI support keyword queries)
          for (const kw of orgKeywords) {
            keywordSet.add(kw.keyword);
            const cat = kw.category ?? "general";
            const metaTag = { orgId, watchlistKeywordId: kw.id };

            // Source 1: DuckDuckGo (default keyless search engine)
            await collectDuckDuckGo(kw.keyword, cat).then((items) => collectTagged(items, metaTag)).catch(() => undefined);
            // Source 2: Bing News (optional, keyword-targeted)
            if (bingKey) await collectBingNews(kw.keyword, bingKey, cat).then((items) => collectTagged(items, metaTag)).catch(() => undefined);
            // Source 3: SerpAPI (optional, keyword-targeted organic search)
            if (serpKey) await collectSerp(kw.keyword, serpKey, cat).then((items) => collectTagged(items, metaTag)).catch(() => undefined);
          }

          // Category-wide broad sweeps — de-duplicate unique categories across all keywords
          // These feed into the ILIKE-based spike detector for keyword mention discovery
          const categories = [...new Set(orgKeywords.map((kw) => kw.category ?? "general"))];
          for (const cat of categories) {
            const catMetaTag = { orgId };
            // Source 3: GDELT (free, no key required, category-based)
            await collectGdelt(cat).then((items) => collectTagged(items, catMetaTag)).catch(() => undefined);
            // Source 4: NewsAPI (category-based)
            if (newsApiKey) await collectNewsApi(cat, newsApiKey).then((items) => collectTagged(items, catMetaTag)).catch(() => undefined);
            // Source 5: Reddit (category-based subreddit sweep)
            if (redditId && redditSecret) await collectReddit(cat, redditId, redditSecret).then((items) => collectTagged(items, catMetaTag)).catch(() => undefined);
            // Source 6: Twitter / X (category-based)
            if (twitterKey) await collectTwitter(cat, twitterKey).then((items) => collectTagged(items, catMetaTag)).catch(() => undefined);
          }
          stats = { fetched: totalFetched, deduplicated: totalDeduplicated, stored: totalStored };

          // Persist hourly geo signals for each tracked keyword (non-blocking)
          const windowAt = new Date();
          for (const kw of [...keywordSet]) {
            persistGeoSignals(orgId, kw, windowAt).catch((err) =>
              logger.warn({ err, orgId, keyword: kw }, "Geo persistence failed after watchlist-scan"),
            );
          }
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
