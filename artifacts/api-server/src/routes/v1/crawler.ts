import { Router } from "express";
import { db } from "@workspace/db";
import { crawlerSourcesTable, collectionRunsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/sources", async (_req, res) => {
  const sources = await db
    .select()
    .from(crawlerSourcesTable)
    .orderBy(crawlerSourcesTable.name);
  res.json({ data: sources });
});

router.post("/sources", async (req, res) => {
  const { name, url, type = "rss", category, language = "en", country } = req.body as {
    name: string;
    url: string;
    type?: string;
    category: string;
    language?: string;
    country?: string;
  };

  if (!name || !url || !category) {
    res.status(400).json({ error: "name, url, and category are required" });
    return;
  }

  const [created] = await db
    .insert(crawlerSourcesTable)
    .values({ name, url, type, category, language, country })
    .returning();

  res.status(201).json(created);
});

router.patch("/sources/:id", async (req, res) => {
  const { isActive, config } = req.body as { isActive?: boolean; config?: Record<string, unknown> };
  const [updated] = await db
    .update(crawlerSourcesTable)
    .set({
      ...(isActive !== undefined ? { isActive } : {}),
      ...(config ? { config } : {}),
      updatedAt: new Date(),
    })
    .where(eq(crawlerSourcesTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Source not found" });
    return;
  }
  res.json(updated);
});

router.delete("/sources/:id", async (req, res) => {
  await db.delete(crawlerSourcesTable).where(eq(crawlerSourcesTable.id, req.params.id));
  res.status(204).send();
});

router.get("/runs", async (req, res) => {
  const { limit = "50" } = req.query as Record<string, string>;
  const runs = await db
    .select()
    .from(collectionRunsTable)
    .orderBy(desc(collectionRunsTable.startedAt))
    .limit(Math.min(200, parseInt(limit, 10)));
  res.json({ data: runs });
});

export default router;
