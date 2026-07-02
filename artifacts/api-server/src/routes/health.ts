import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pingRedis } from "../lib/redis";
import { pingElasticsearch } from "../lib/elasticsearch";

const router: IRouter = Router();

/**
 * GET /api/healthz — Lightweight liveness probe.
 * Returns 200 immediately; does not check downstream services.
 * Use for Kubernetes liveness probes / load-balancer keep-alives.
 */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * GET /api/health — Full readiness / dependency probe.
 * Checks database, Redis, and Elasticsearch.
 * Returns HTTP 200 when ALL services are healthy, 503 otherwise.
 * Use for deployment monitors, readiness probes, and uptime checks.
 */
router.get("/health", async (_req, res) => {
  const [dbOk, redisOk, esOk] = await Promise.all([
    db.execute(sql`SELECT 1`).then(() => true).catch(() => false),
    pingRedis(),
    pingElasticsearch(),
  ]);

  const allHealthy = dbOk && redisOk && esOk;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ok" : "degraded",
    services: {
      database:      dbOk    ? "ok" : "unavailable",
      redis:         redisOk ? "ok" : "unavailable",
      elasticsearch: esOk    ? "ok" : "unavailable",
    },
    version: process.env.npm_package_version ?? "unknown",
    timestamp: new Date().toISOString(),
  });
});

export default router;
