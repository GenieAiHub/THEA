import { Router } from "express";
import { db } from "@workspace/db";
import { analysisReportsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

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

  const query = db
    .select()
    .from(analysisReportsTable)
    .orderBy(desc(analysisReportsTable.runAt))
    .limit(Math.min(200, parseInt(limit, 10)));

  if (category) {
    const reports = await db
      .select()
      .from(analysisReportsTable)
      .where(eq(analysisReportsTable.category, category))
      .orderBy(desc(analysisReportsTable.runAt))
      .limit(Math.min(200, parseInt(limit, 10)));
    res.json({ data: reports });
    return;
  }

  const reports = await query;
  res.json({ data: reports });
});

router.post("/run", async (req, res) => {
  const { category } = req.body as { category?: string };

  // Stub: enqueue MiroFish run job (Phase 3 wires this up)
  res.status(202).json({
    message: "Analysis run queued",
    category: category ?? "all",
    note: "MiroFish integration will be wired in Phase 3",
  });
});

export default router;
