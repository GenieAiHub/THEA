import { Router } from "express";
import { db } from "@workspace/db";
import { contentItemsTable, collectionRunsTable, crawlerSourcesTable } from "@workspace/db/schema";
import { sql, gte, desc, eq, count } from "drizzle-orm";
import { getQueues } from "../../lib/queues";
import { pingRedis } from "../../lib/redis";
import { pingElasticsearch } from "../../lib/elasticsearch";
import { requireOperator } from "../../middlewares/operator";
import { logger } from "../../lib/logger";

const router = Router();

router.use(requireOperator);

// Race a health probe against a short timeout so a hung dependency (e.g. a
// downed Elasticsearch that retries for ~30s) can never stall the snapshot.
// The inner promise already has a .catch, so it won't reject unhandled if it
// settles after the race resolves.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ─── GET /api/v1/admin/monitoring ─────────────────────────────────────────────
// One-shot operational snapshot for the Super Admin → Monitoring dashboard:
// service health, BullMQ queue depths, ingestion volume, and source health.
router.get("/monitoring", async (_req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // ── Service health ──────────────────────────────────────────────────────────
  const [dbOk, redisOk, esOk] = await Promise.all([
    withTimeout(db.execute(sql`SELECT 1`).then(() => true).catch(() => false), 3000, false),
    withTimeout(pingRedis().catch(() => false), 3000, false),
    withTimeout(pingElasticsearch().catch(() => false), 3000, false),
  ]);

  // ── Queue depths ────────────────────────────────────────────────────────────
  let queues: Array<{ name: string; counts: Record<string, number>; error?: string }> = [];
  try {
    const qs = getQueues();
    queues = await Promise.all(
      Object.values(qs).map(async (q) => {
        try {
          const counts = await q.getJobCounts(
            "waiting", "active", "completed", "failed", "delayed", "paused"
          );
          return { name: q.name, counts: counts as Record<string, number> };
        } catch (err) {
          return { name: q.name, counts: {}, error: (err as Error).message };
        }
      })
    );
  } catch (err) {
    logger.warn({ err }, "monitoring: failed to read queue counts");
  }

  // ── Ingestion volume ──────────────────────────────────────────────────────────
  const [contentTotal, contentRecent, runAgg, sourceAgg] = await Promise.all([
    db.select({ c: count() }).from(contentItemsTable),
    db.select({ c: count() }).from(contentItemsTable).where(gte(contentItemsTable.collectedAt, since24h)),
    db
      .select({
        status: collectionRunsTable.status,
        runs: count(),
        fetched: sql<number>`COALESCE(SUM(${collectionRunsTable.itemsFetched}), 0)`,
        stored: sql<number>`COALESCE(SUM(${collectionRunsTable.itemsStored}), 0)`,
      })
      .from(collectionRunsTable)
      .where(gte(collectionRunsTable.startedAt, since24h))
      .groupBy(collectionRunsTable.status),
    db
      .select({ isActive: crawlerSourcesTable.isActive, c: count() })
      .from(crawlerSourcesTable)
      .groupBy(crawlerSourcesTable.isActive),
  ]);

  const recentRuns = await db
    .select()
    .from(collectionRunsTable)
    .orderBy(desc(collectionRunsTable.startedAt))
    .limit(20);

  const runsByStatus: Record<string, { runs: number; fetched: number; stored: number }> = {};
  let runs24h = 0;
  let fetched24h = 0;
  let stored24h = 0;
  for (const r of runAgg) {
    const runs = Number(r.runs ?? 0);
    const fetched = Number(r.fetched ?? 0);
    const stored = Number(r.stored ?? 0);
    runsByStatus[r.status] = { runs, fetched, stored };
    runs24h += runs;
    fetched24h += fetched;
    stored24h += stored;
  }

  let activeSources = 0;
  let inactiveSources = 0;
  for (const s of sourceAgg) {
    if (s.isActive) activeSources = Number(s.c);
    else inactiveSources = Number(s.c);
  }

  res.json({
    data: {
      health: {
        database: dbOk ? "ok" : "unavailable",
        redis: redisOk ? "ok" : "unavailable",
        elasticsearch: esOk ? "ok" : "unavailable",
        allHealthy: dbOk && redisOk && esOk,
      },
      queues,
      content: {
        total: Number(contentTotal[0]?.c ?? 0),
        last24h: Number(contentRecent[0]?.c ?? 0),
      },
      collection: {
        runs24h,
        fetched24h,
        stored24h,
        byStatus: runsByStatus,
        recentRuns,
      },
      sources: {
        active: activeSources,
        inactive: inactiveSources,
        total: activeSources + inactiveSources,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
