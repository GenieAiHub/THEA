import { Router } from "express";
import { db } from "@workspace/db";
import { watchlistKeywordsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/clerkAuth";
import { requireFeature } from "../../middlewares/featureGate";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const keywords = await db
    .select()
    .from(watchlistKeywordsTable)
    .where(eq(watchlistKeywordsTable.orgId, req.thea!.org.id));

  res.json({ data: keywords, total: keywords.length, limit: req.thea!.subscription.maxKeywords });
});

router.post("/", requireRole("owner", "admin"), requireFeature("watchlist"), async (req, res) => {
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

  const { org, subscription } = req.thea!;

  const existing = await db.select().from(watchlistKeywordsTable).where(eq(watchlistKeywordsTable.orgId, org.id));
  if (existing.length >= subscription.maxKeywords) {
    res.status(402).json({
      error: `Your plan allows up to ${subscription.maxKeywords} keywords. Upgrade to Pro for 50 keywords or Enterprise for unlimited.`,
    });
    return;
  }

  const [created] = await db
    .insert(watchlistKeywordsTable)
    .values({ orgId: org.id, keyword, type, category, notes })
    .returning();

  res.status(201).json(created);
});

router.patch("/:id", requireRole("owner", "admin"), async (req, res) => {
  const { isActive, notes } = req.body as { isActive?: boolean; notes?: string };
  const [updated] = await db
    .update(watchlistKeywordsTable)
    .set({ ...(isActive !== undefined ? { isActive } : {}), ...(notes !== undefined ? { notes } : {}), updatedAt: new Date() })
    .where(and(eq(watchlistKeywordsTable.id, req.params.id as string), eq(watchlistKeywordsTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }
  res.json(updated);
});

router.delete("/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(watchlistKeywordsTable)
    .where(and(eq(watchlistKeywordsTable.id, req.params.id as string), eq(watchlistKeywordsTable.orgId, req.thea!.org.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }
  res.status(204).send();
});

export default router;
