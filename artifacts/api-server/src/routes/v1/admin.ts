import { Router } from "express";
import { db } from "@workspace/db";
import { organizationsTable, subscriptionsTable, collectionRunsTable, llmUsageLogsTable } from "@workspace/db/schema";
import { desc, count } from "drizzle-orm";

const router = Router();

router.get("/orgs", async (_req, res) => {
  const orgs = await db.select().from(organizationsTable).orderBy(desc(organizationsTable.createdAt));
  res.json({ data: orgs });
});

router.get("/subscriptions", async (_req, res) => {
  const subs = await db.select().from(subscriptionsTable).orderBy(desc(subscriptionsTable.createdAt));
  res.json({ data: subs });
});

router.get("/llm-usage", async (_req, res) => {
  const recent = await db
    .select()
    .from(llmUsageLogsTable)
    .orderBy(desc(llmUsageLogsTable.createdAt))
    .limit(100);
  res.json({ data: recent });
});

router.get("/collection-runs", async (_req, res) => {
  const runs = await db
    .select()
    .from(collectionRunsTable)
    .orderBy(desc(collectionRunsTable.startedAt))
    .limit(100);
  res.json({ data: runs });
});

router.get("/stats", async (_req, res) => {
  const [orgCount] = await db.select({ count: count() }).from(organizationsTable);

  res.json({
    organizations: orgCount?.count ?? 0,
    timestamp: new Date().toISOString(),
  });
});

export default router;
