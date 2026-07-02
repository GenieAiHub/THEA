import { Router } from "express";
import { db } from "@workspace/db";
import { watchlistKeywordsTable, crisisScoresTable, alertsTable, contentItemsTable } from "@workspace/db/schema";
import { eq, and, gte, lt, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireFeature } from "../../middlewares/featureGate";
import { computeShareOfVoice } from "../../lib/shareOfVoice";
import { computeCrisisScore } from "../../lib/crisisScoring";
import { detectSpikesForOrg } from "../../lib/spikeDetector";

const router = Router();
router.use(requireAuth);

// ─── GET /api/v1/watchlist ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const keywords = await db
    .select()
    .from(watchlistKeywordsTable)
    .where(eq(watchlistKeywordsTable.orgId, req.thea!.org.id));

  res.json({ data: keywords, total: keywords.length, limit: req.thea!.subscription.maxKeywords });
});

// ─── POST /api/v1/watchlist ───────────────────────────────────────────────────
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

  const VALID_TYPES = ["keyword", "brand", "competitor", "person", "hashtag"];
  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
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

// ─── PATCH /api/v1/watchlist/:id ─────────────────────────────────────────────
router.patch("/:id", requireRole("owner", "admin"), async (req, res) => {
  const { isActive, notes, type, category } = req.body as {
    isActive?: boolean;
    notes?: string;
    type?: string;
    category?: string;
  };
  const [updated] = await db
    .update(watchlistKeywordsTable)
    .set({
      ...(isActive !== undefined ? { isActive } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(category !== undefined ? { category } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(watchlistKeywordsTable.id, req.params.id as string), eq(watchlistKeywordsTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }
  res.json(updated);
});

// ─── DELETE /api/v1/watchlist/:id ────────────────────────────────────────────
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

// ─── GET /api/v1/watchlist/sov ───────────────────────────────────────────────
/**
 * Competitor share-of-voice comparison.
 * Returns mention counts + share percentages for all brand/competitor keywords.
 */
router.get("/sov", async (req, res) => {
  const { timeframe = "24h" } = req.query as { timeframe?: string };
  const hoursMap: Record<string, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };
  const hours = hoursMap[timeframe] ?? 24;

  const result = await computeShareOfVoice(req.thea!.org.id, hours);
  res.json({ ...result, timeframe, generatedAt: new Date().toISOString() });
});

// ─── GET /api/v1/watchlist/:id/analysis ──────────────────────────────────────
/**
 * Crisis probability score + spike history + latest alerts for a watchlist keyword.
 */
router.get("/:id/analysis", async (req, res) => {
  const orgId = req.thea!.org.id;

  const [keyword] = await db
    .select()
    .from(watchlistKeywordsTable)
    .where(and(eq(watchlistKeywordsTable.id, req.params.id as string), eq(watchlistKeywordsTable.orgId, orgId)))
    .limit(1);

  if (!keyword) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }

  // Latest stored crisis scores (last 24h)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const storedScores = await db
    .select()
    .from(crisisScoresTable)
    .where(
      and(
        eq(crisisScoresTable.orgId, orgId),
        eq(crisisScoresTable.keywordId, keyword.id),
        gte(crisisScoresTable.scoredAt, since24h),
      ),
    )
    .orderBy(desc(crisisScoresTable.scoredAt))
    .limit(96); // 15-min slots over 24h

  // Latest alerts for this keyword
  const recentAlerts = await db
    .select()
    .from(alertsTable)
    .where(
      and(
        eq(alertsTable.orgId, orgId),
        eq(alertsTable.keywordId, keyword.id),
        gte(alertsTable.createdAt, since24h),
      ),
    )
    .orderBy(desc(alertsTable.createdAt))
    .limit(10);

  // Compute real current and baseline volumes for the live score
  const WINDOW_MINUTES = 15;
  const BASELINE_HOURS = 24;
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
  const baselineStart = new Date(now.getTime() - BASELINE_HOURS * 60 * 60 * 1000);
  const pattern = `%${keyword.keyword.replace(/[%_]/g, "\\$&")}%`;
  const mentionFilter = sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`;

  const [currentRow, baselineRow] = await Promise.all([
    db
      .select({ n: count() })
      .from(contentItemsTable)
      .where(and(eq(contentItemsTable.orgId, orgId), gte(contentItemsTable.collectedAt, windowStart), mentionFilter))
      .then((r) => r[0]),
    db
      .select({ n: count() })
      .from(contentItemsTable)
      .where(and(eq(contentItemsTable.orgId, orgId), gte(contentItemsTable.collectedAt, baselineStart), lt(contentItemsTable.collectedAt, windowStart), mentionFilter))
      .then((r) => r[0]),
  ]);

  const currentVolume = Number(currentRow?.n ?? 0);
  const baselineSlots = (BASELINE_HOURS * 60) / WINDOW_MINUTES - 1;
  const baselineAvg = baselineSlots > 0 ? Number(baselineRow?.n ?? 0) / baselineSlots : 0;
  const liveScore = await computeCrisisScore(orgId, keyword.keyword, currentVolume, baselineAvg);

  res.json({
    keyword,
    liveScore,
    scoreHistory: storedScores,
    recentAlerts,
    generatedAt: new Date().toISOString(),
  });
});

// ─── POST /api/v1/watchlist/scan ─────────────────────────────────────────────
/**
 * Manually trigger spike detection for the org's watchlist.
 * Requires owner or admin role.
 */
router.post("/scan", requireRole("owner", "admin"), async (req, res) => {
  const orgId = req.thea!.org.id;
  detectSpikesForOrg(orgId).catch((err) =>
    require("../../lib/logger").logger.warn({ err, orgId }, "Manual spike scan failed"),
  );
  res.status(202).json({ message: "Spike detection scan triggered", orgId });
});

export default router;
