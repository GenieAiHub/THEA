import { Router } from "express";
import { getQueues } from "../../lib/queues";
import { getPlatformConfigNumber } from "../../lib/platform-config";
import { scheduleAnalysis, getActiveCategories } from "../../lib/analysis";
import { scheduleIngestion } from "../../lib/ingestion";
import { requireOperator } from "../../middlewares/operator";
import { logger } from "../../lib/logger";

const router = Router();

router.use(requireOperator);

// Data-fetch source types accepted by POST /crawler/trigger (kept in sync with crawler.ts).
const VALID_SOURCE_TYPES = [
  "rss-all", "rss-batch", "gdelt", "newsapi", "mediastack", "bing-news",
  "twitter", "reddit", "youtube", "serp", "brave", "duckduckgo", "social-search", "telegram", "tiktok",
  "instagram", "facebook", "web-crawler", "gemini-search", "deepseek-crawl",
];

// ─── GET /api/v1/admin/scheduler ──────────────────────────────────────────────
// Returns the current cadence config + the repeatable job schedulers registered
// on the analysis/ingestion queues so the operator can see what's actually running.
router.get("/scheduler", async (_req, res) => {
  const [mirofishMin, classifyMin, embedMin, categories] = await Promise.all([
    getPlatformConfigNumber("mirofish_interval_minutes", 60),
    getPlatformConfigNumber("llm_classify_interval_minutes", 15),
    getPlatformConfigNumber("llm_embed_interval_minutes", 30),
    getActiveCategories().catch(() => [] as string[]),
  ]);

  let jobSchedulers: Array<{ queue: string; key: string; name?: string; every?: string | number; pattern?: string; next?: number | null }> = [];
  try {
    const { miroFishRuns, llmProcessing, contentIngestion } = getQueues();
    const queueList: Array<[string, typeof miroFishRuns]> = [
      ["mirofish-runs", miroFishRuns],
      ["llm-processing", llmProcessing],
      ["content-ingestion", contentIngestion],
    ];
    for (const [queueName, q] of queueList) {
      try {
        const schedulers = await q.getJobSchedulers(0, 100, true);
        for (const s of schedulers) {
          jobSchedulers.push({
            queue: queueName,
            key: s.key,
            name: s.name,
            every: s.every ?? undefined,
            pattern: s.pattern ?? undefined,
            next: s.next ?? null,
          });
        }
      } catch (err) {
        logger.warn({ err, queueName }, "scheduler: failed to read job schedulers");
      }
    }
  } catch (err) {
    logger.warn({ err }, "scheduler: queues unavailable");
  }

  res.json({
    data: {
      intervals: {
        mirofishIntervalMinutes: mirofishMin,
        llmClassifyIntervalMinutes: classifyMin,
        llmEmbedIntervalMinutes: embedMin,
      },
      jobSchedulers,
      validSourceTypes: VALID_SOURCE_TYPES,
      categories,
    },
  });
});

// ─── POST /api/v1/admin/scheduler/reload ──────────────────────────────────────
// Re-registers all repeatable schedulers so cadence edits in platform_configs
// take effect immediately (upsertJobScheduler is idempotent).
router.post("/scheduler/reload", async (_req, res) => {
  try {
    await scheduleIngestion();
    await scheduleAnalysis();
    res.json({ reloaded: true, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "scheduler reload failed");
    res.status(500).json({ error: "Failed to reload schedulers", detail: (err as Error).message });
  }
});

export default router;
