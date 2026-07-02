import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { analysisReportsTable, llmUsageLogsTable } from "@workspace/db/schema";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { getQueues } from "../../lib/queues";

const router = Router();

const ADMIN_TOKEN = process.env.ADMIN_INTERNAL_TOKEN;

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["x-admin-token"] ?? req.headers.authorization?.replace("Bearer ", "");
  if (!ADMIN_TOKEN || header === ADMIN_TOKEN) { next(); return; }
  res.status(401).json({ error: "Unauthorized" });
}

router.get("/latest", async (_req, res) => {
  const reports = await db
    .select()
    .from(analysisReportsTable)
    .orderBy(desc(analysisReportsTable.runAt))
    .limit(7);
  res.json({ data: reports });
});

router.get("/category/:category", async (req, res) => {
  const { category } = req.params;
  const report = await db
    .select()
    .from(analysisReportsTable)
    .where(eq(analysisReportsTable.category, category))
    .orderBy(desc(analysisReportsTable.runAt))
    .limit(1);

  if (!report.length) {
    res.status(404).json({ error: "No analysis report found for this category" });
    return;
  }
  res.json(report[0]);
});

router.get("/history", async (req, res) => {
  const { category, limit = "50" } = req.query as Record<string, string>;
  const limitN = Math.min(200, parseInt(limit, 10));

  const conditions = category ? [eq(analysisReportsTable.category, category)] : [];
  const reports = await db
    .select()
    .from(analysisReportsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(analysisReportsTable.runAt))
    .limit(limitN);

  res.json({ data: reports });
});

router.post("/run", requireAdminToken, async (req, res) => {
  const { category, windowHours = 24 } = req.body as { category?: string; windowHours?: number };
  const { miroFishRuns } = getQueues();

  const categories = category
    ? [category]
    : ["Politics", "News", "Technology", "Society", "Media", "Branding", "Entertainment"];

  for (const cat of categories) {
    await miroFishRuns.add(
      "mirofish-manual",
      { category: cat, windowHours, triggeredBy: "manual", forceRun: true },
      { priority: 1, attempts: 2, backoff: { type: "exponential", delay: 10000 } }
    );
  }

  res.status(202).json({ message: "Analysis run queued", categories, windowHours });
});

router.post("/classify", requireAdminToken, async (req, res) => {
  const { category, itemIds } = req.body as { category?: string; itemIds?: string[] };
  const { llmProcessing } = getQueues();

  await llmProcessing.add(
    "classify-manual",
    { operation: "classify_and_embed" as const, itemIds, category },
    { priority: 1, attempts: 3, backoff: { type: "exponential", delay: 10000 } }
  );

  res.status(202).json({
    message: "Classification job queued",
    category: category ?? "all",
    itemIds: itemIds?.length ?? "all pending",
  });
});

router.get("/cost", requireAdminToken, async (_req, res) => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const rows = await db
    .select({
      model: llmUsageLogsTable.model,
      totalTokens: sql<number>`SUM(${llmUsageLogsTable.totalTokens})`,
      estimatedCostUsd: sql<number>`SUM(${llmUsageLogsTable.estimatedCostUsd})`,
      calls: sql<number>`COUNT(*)`,
    })
    .from(llmUsageLogsTable)
    .where(and(eq(llmUsageLogsTable.status, "success"), gte(llmUsageLogsTable.createdAt, startOfDay)))
    .groupBy(llmUsageLogsTable.model);

  const todayTotalUsd = rows.reduce((s, r) => s + Number(r.estimatedCostUsd ?? 0), 0);
  res.json({ data: rows, todayTotalUsd, date: startOfDay.toISOString() });
});

export default router;
