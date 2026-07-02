import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { analysisReportsTable, llmUsageLogsTable } from "@workspace/db/schema";
import { desc, eq, and, gte, sql, or } from "drizzle-orm";
import { getQueues } from "../../lib/queues";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

const ADMIN_TOKEN = process.env.ADMIN_INTERNAL_TOKEN;
const PLATFORM_ORG_ID = "10000000-0000-0000-0000-000000000001";

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ error: "Admin token not configured on this server" });
    return;
  }
  const header = req.headers["x-admin-token"] ?? req.headers.authorization?.replace("Bearer ", "");
  if (header !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/** Scope: platform-wide reports (orgId = PLATFORM_ORG_ID) + this org's own reports */
function orgScope(orgId: string) {
  return or(
    eq(analysisReportsTable.orgId, PLATFORM_ORG_ID),
    eq(analysisReportsTable.orgId, orgId)
  )!;
}

router.get("/latest", requireAuth, async (req, res) => {
  const orgId = req.thea!.org.id;
  const reports = await db
    .select()
    .from(analysisReportsTable)
    .where(orgScope(orgId))
    .orderBy(desc(analysisReportsTable.runAt))
    .limit(7);
  res.json({ data: reports });
});

router.get("/category/:category", requireAuth, async (req, res) => {
  const category = req.params.category as string;
  const orgId = req.thea!.org.id;
  const report = await db
    .select()
    .from(analysisReportsTable)
    .where(and(eq(analysisReportsTable.category, category), orgScope(orgId)))
    .orderBy(desc(analysisReportsTable.runAt))
    .limit(1);

  if (!report.length) {
    res.status(404).json({ error: "No analysis report found for this category" });
    return;
  }
  res.json(report[0]);
});

router.get("/history", requireAuth, async (req, res) => {
  const { category, limit = "50" } = req.query as Record<string, string>;
  const limitN = Math.min(200, parseInt(limit, 10));
  const orgId = req.thea!.org.id;
  const scope = orgScope(orgId);

  const conditions = category
    ? and(eq(analysisReportsTable.category, category), scope)
    : scope;

  const reports = await db
    .select()
    .from(analysisReportsTable)
    .where(conditions)
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
