import app from "./app";
import { logger } from "./lib/logger";

// ─── Fail-fast environment validation ────────────────────────────────────────
// All required infrastructure variables must be present before the server
// binds to a port.  Optional variables (REDIS_URL, ELASTICSEARCH_URL) are
// checked here and will degrade gracefully at runtime, but their absence is
// logged as a warning so operators notice immediately on startup.
const REQUIRED_ENV: Record<string, string> = {
  PORT: "TCP port the HTTP server listens on",
  DATABASE_URL: "PostgreSQL connection string",
};

const WARN_IF_MISSING: Record<string, string> = {
  REDIS_URL: "Redis connection string (BullMQ queues / caching)",
  ELASTICSEARCH_URL: "Elasticsearch node URL (full-text search)",
};

const missing: string[] = [];

for (const [key, description] of Object.entries(REQUIRED_ENV)) {
  if (!process.env[key]) {
    missing.push(`  ${key}  — ${description}`);
  }
}

if (missing.length > 0) {
  // Use console.error here because the logger may not be initialised yet
  console.error(
    `[THEA] Startup aborted — required environment variables are not set:\n${missing.join("\n")}`
  );
  process.exit(1);
}

for (const [key, description] of Object.entries(WARN_IF_MISSING)) {
  if (!process.env[key]) {
    logger.warn(`${key} is not set (${description}) — related features will be degraded`);
  }
}

// ─── pgvector bootstrap ───────────────────────────────────────────────────────
import { bootstrapPgVector } from "./lib/pgvector";

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

  // Run non-blocking post-start bootstrap
  bootstrapPgVector().catch((err) =>
    logger.error({ err }, "pgvector bootstrap failed")
  );
});
