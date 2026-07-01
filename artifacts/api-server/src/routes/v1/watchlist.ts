import { Router } from "express";
import { db } from "@workspace/db";
import { watchlistKeywordsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  // Stub: org_id from auth middleware in Phase 4
  const keywords = await db.select().from(watchlistKeywordsTable);
  res.json({ data: keywords });
});

router.post("/", async (req, res) => {
  const { keyword, type = "keyword", category, notes } = req.body as {
    keyword: string;
    type?: string;
    category?: string;
    notes?: string;
  };

  if (!keyword) {
    res.status(400).json({ error: "keyword is required" });
    return;
  }

  // Stub org_id — Phase 4 will wire in real org from auth
  const STUB_ORG_ID = "00000000-0000-0000-0000-000000000001";

  const [created] = await db
    .insert(watchlistKeywordsTable)
    .values({ orgId: STUB_ORG_ID, keyword, type, category, notes })
    .returning();

  res.status(201).json(created);
});

router.patch("/:id", async (req, res) => {
  const { isActive, notes } = req.body as { isActive?: boolean; notes?: string };
  const [updated] = await db
    .update(watchlistKeywordsTable)
    .set({ ...(isActive !== undefined ? { isActive } : {}), ...(notes ? { notes } : {}), updatedAt: new Date() })
    .where(eq(watchlistKeywordsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  await db.delete(watchlistKeywordsTable).where(eq(watchlistKeywordsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
