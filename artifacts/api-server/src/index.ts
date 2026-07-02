import app from "./app";
import { logger } from "./lib/logger";

// ─── Fail-fast environment validation ────────────────────────────────────────
// All required infrastructure variables must be present before the server
// binds to a port.  Missing any of these means core functionality cannot work.
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

// ─── Start HTTP server ────────────────────────────────────────────────────────
const port = Number(process.env["PORT"]!);

if (Number.isNaN(port) || port <= 0) {
  console.error(`[THEA] Invalid PORT value: "${process.env["PORT"]}"`);
  process.exit(1);
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
  ]);
});
