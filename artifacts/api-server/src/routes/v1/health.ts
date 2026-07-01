import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { pingRedis } from "../../lib/redis";
import { pingElasticsearch } from "../../lib/elasticsearch";

const router = Router();

router.get("/", async (_req, res) => {
  const [dbOk, redisOk, esOk] = await Promise.all([
    db.execute(sql`SELECT 1`).then(() => true).catch(() => false),
    pingRedis(),
    pingElasticsearch(),
  ]);

  const services = {
    database: dbOk ? "ok" : "unavailable",
    redis: redisOk ? "ok" : "unavailable",
    elasticsearch: esOk ? "ok" : "unavailable",
  };

  const allHealthy = dbOk && redisOk && esOk;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ok" : "degraded",
    services,
    version: process.env.npm_package_version ?? "unknown",
    timestamp: new Date().toISOString(),
  });
});

export default router;
