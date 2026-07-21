import app from "./app";
import { logger } from "./lib/logger";

// ─── Fail-fast environment validation ────────────────────────────────────────
const REQUIRED_ENV: Array<[string, string]> = [
  ["PORT",               "TCP port the HTTP server listens on"],
  ["DATABASE_URL",       "PostgreSQL connection string"],
  ["REDIS_URL",          "Redis connection string (BullMQ queues / caching)"],
  ["ELASTICSEARCH_URL",  "Elasticsearch node URL (full-text search)"],
];

const missing: string[] = [];

for (const [key, description] of REQUIRED_ENV) {
  if (!process.env[key]) {
    missing.push(`  ${key}  — ${description}`);
  }
}

if (missing.length > 0) {
  console.error(
    `[THEA] Startup aborted — required environment variables are not set:\n${missing.join("\n")}`
  );
  process.exit(1);
}

// ─── Startup bootstrap ────────────────────────────────────────────────────────
import { bootstrapPgVector } from "./lib/pgvector";
import { ensureContentItemsIndex } from "./lib/elasticsearch";
import { seedPlatformConfigs } from "./routes/v1/admin_configs";
import { seedSubscriptionPlans } from "./lib/plans";
import { createWorker } from "./lib/queues";
import { generateMarketsNow, getMarketSettings, syncMarketGenerationSchedule } from "./lib/markets";
import { startContentIngestionWorker, scheduleIngestion, ensurePlatformOrg } from "./lib/ingestion";
import { startLlmProcessingWorker, startMiroFishWorker, scheduleAnalysis } from "./lib/analysis";
import { startAlertDispatchWorker } from "./lib/alert-dispatch-worker";
import { startIntelligenceWorker } from "./lib/intelligence/worker";
import { scheduleIntelligenceJobs } from "./lib/intelligence/scheduler";
import { startAiNarrativeWorker, scheduleAiNarrative } from "./lib/aiNarrativeWorker";
import { startEmailDeliveryWorker } from "./lib/emailDeliveryWorker";
import { scheduleDigests } from "./lib/digestScheduler";
import { startTelegramBot } from "./lib/telegramBot";
import { initFaceRecognition } from "./lib/faceRecognition";
import { startCameraSampler } from "./lib/watch/cameraSampler";
import { stopAllLiveStreams } from "./lib/watch/liveStream";
import { startVisualRecognitionWorker, startVideoScanWorker } from "./lib/watch/watchWorkers";
import { initObjectRecognition } from "./lib/watch/objectRecognition";
import { pruneSnapshots, enforceSightingCap } from "./lib/watch/snapshots";
import { logger as bootLogger } from "./lib/logger";

function startMarketGenerationWorker(): void {
  createWorker("market-generation", async () => {
    const settings = await getMarketSettings();
    if (!settings.enabled) {
      bootLogger.info("Market auto-generation is disabled — skipping scheduled run");
      return;
    }
    try {
      const result = await generateMarketsNow();
      bootLogger.info({ generated: result.generated }, "Scheduled market generation complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("No LLM API key configured")) {
        bootLogger.warn(
          "Market auto-generation skipped: no LLM API key configured. Add an OpenAI or Gemini key in Super Admin → API Keys.",
        );
        return;
      }
      throw err;
    }
  });
}

// ─── Start HTTP server ────────────────────────────────────────────────────────
const port = Number(process.env["PORT"]!);

if (Number.isNaN(port) || port <= 0) {
  console.error(`[THEA] Invalid PORT value: "${process.env["PORT"]}"`);
  process.exit(1);
}

/**
 * Start the Security Watch camera sampler, retrying with backoff — during
 * boot the DB pool can be saturated by the other bootstrap tasks, and a
 * single connection timeout must not permanently disable live monitoring.
 */
async function startSecurityWatchWithRetry(maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await startCameraSampler();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delayMs = attempt * 15_000;
      logger.warn({ err, attempt, delayMs }, "Security Watch start failed — retrying");
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// Kill live-stream ffmpeg children on shutdown so restarts don't orphan
// long-running processes writing HLS segments to /tmp forever.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    stopAllLiveStreams();
    process.exit(0);
  });
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Non-blocking post-start bootstrap — failures are logged but do not crash
  await Promise.allSettled([
    bootstrapPgVector().catch((err) =>
      logger.error({ err }, "pgvector bootstrap failed")
    ),
    ensureContentItemsIndex().catch((err) =>
      logger.warn({ err }, "Elasticsearch index bootstrap failed — will retry on next startup")
    ),
    seedPlatformConfigs().catch((err) =>
      logger.warn({ err }, "Platform config seed failed — will retry on next startup")
    ),
    seedSubscriptionPlans().catch((err) =>
      logger.warn({ err }, "Subscription plans seed failed — will retry on next startup")
    ),
    ensurePlatformOrg().catch((err) =>
      logger.warn({ err }, "Platform org seed failed — will retry on next startup")
    ),
    Promise.resolve()
      .then(() => {
        startMarketGenerationWorker();
        return syncMarketGenerationSchedule();
      })
      .catch((err) =>
        logger.warn({ err }, "Market generation scheduler bootstrap failed — will retry on next startup")
      ),
    Promise.resolve()
      .then(() => {
        startContentIngestionWorker();
        return scheduleIngestion();
      })
      .catch((err) =>
        logger.warn({ err }, "Content ingestion scheduler bootstrap failed — will retry on next startup")
      ),
    Promise.resolve()
      .then(() => {
        startLlmProcessingWorker();
        startMiroFishWorker();
        startAlertDispatchWorker();
        return scheduleAnalysis();
      })
      .catch((err) =>
        logger.warn({ err }, "Analysis worker bootstrap failed — will retry on next startup")
      ),
    Promise.resolve()
      .then(() => {
        startIntelligenceWorker();
        return scheduleIntelligenceJobs();
      })
      .catch((err) =>
        logger.warn({ err }, "Intelligence worker bootstrap failed — will retry on next startup")
      ),
    Promise.resolve()
      .then(() => {
        startAiNarrativeWorker();
        return scheduleAiNarrative();
      })
      .catch((err) =>
        logger.warn({ err }, "AI narrative worker bootstrap failed — will retry on next startup")
      ),
    Promise.resolve()
      .then(() => {
        startEmailDeliveryWorker();
        return scheduleDigests();
      })
      .catch((err) =>
        logger.warn({ err }, "Email delivery worker / digest scheduler bootstrap failed — will retry on next startup")
      ),
    Promise.resolve()
      .then(() => startTelegramBot())
      .catch((err) =>
        logger.warn({ err }, "Telegram bot bootstrap failed — will retry on next startup")
      ),
    initFaceRecognition().catch((err) =>
      logger.warn({ err }, "Face recognition model load failed — will retry lazily on first request")
    ),
    Promise.resolve()
      .then(() => {
        startVisualRecognitionWorker();
        startVideoScanWorker();
        // Daily retention prune for Security Watch sightings + snapshots
        setInterval(() => {
          pruneSnapshots().catch(() => undefined);
          enforceSightingCap().catch(() => undefined);
        }, 24 * 60 * 60 * 1000);
        return startSecurityWatchWithRetry();
      })
      .catch((err) =>
        logger.warn({ err }, "Security Watch bootstrap failed — will retry on next startup")
      ),
    initObjectRecognition().catch((err) =>
      logger.warn({ err }, "Object recognition model load failed — will retry lazily on first use")
    ),
  ]);
});
