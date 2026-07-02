import { Router } from "express";
import { db } from "@workspace/db";
import { predictionMarketsTable, marketVotesTable } from "@workspace/db/schema";
import { eq, desc, sql, and, ilike, or } from "drizzle-orm";
import { VoteOnMarketBody } from "@workspace/api-zod";
import { serializeMarkets } from "../../lib/markets";
import { requireAuth } from "../../middlewares/clerkAuth";
import { tenantOr, PLATFORM_ORG_ID } from "../../lib/tenantScope";

const router = Router();
router.use(requireAuth);

// ─── GET /api/v1/markets ──────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const userOrgId = req.thea!.org.id;
  const { status, category, sort = "trending", search } = req.query as Record<string, string | undefined>;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));

  const conditions = [tenantOr(predictionMarketsTable.orgId, userOrgId)];

  if (category) conditions.push(eq(predictionMarketsTable.category, category));
  if (search) {
    conditions.push(
      or(
        ilike(predictionMarketsTable.question, `%${search}%`),
        ilike(predictionMarketsTable.description, `%${search}%`),
      )!,
    );
  }
  if (status === "closed" || status === "resolved") {
    conditions.push(eq(predictionMarketsTable.status, status));
  } else if (status === "open") {
    conditions.push(
      and(
        eq(predictionMarketsTable.status, "open"),
        or(
          sql`${predictionMarketsTable.closesAt} IS NULL`,
          sql`${predictionMarketsTable.closesAt} > now()`,
        )!,
      )!,
    );
  }

  const rows = await db
    .select()
    .from(predictionMarketsTable)
    .where(and(...conditions))
    .orderBy(desc(predictionMarketsTable.createdAt))
    .limit(limit);

  let markets = await serializeMarkets(rows);

  if (sort === "trending") {
    markets = markets.sort((a, b) => b.totalVotes - a.totalVotes || +new Date(b.createdAt) - +new Date(a.createdAt));
  } else if (sort === "closing") {
    markets = markets.sort((a, b) => {
      if (!a.closesAt && !b.closesAt) return 0;
      if (!a.closesAt) return 1;
      if (!b.closesAt) return -1;
      return +new Date(a.closesAt) - +new Date(b.closesAt);
    });
  }

  res.json({ data: markets });
});

// ─── GET /api/v1/markets/categories ──────────────────────────────────────────
router.get("/categories", async (req, res) => {
  const userOrgId = req.thea!.org.id;
  const rows = await db
    .select({
      category: predictionMarketsTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(predictionMarketsTable)
    .where(tenantOr(predictionMarketsTable.orgId, userOrgId))
    .groupBy(predictionMarketsTable.category)
    .orderBy(desc(sql`count(*)`));

  res.json({ data: rows });
});

// ─── GET /api/v1/markets/stats ────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const userOrgId = req.thea!.org.id;
  const orgFilter = tenantOr(predictionMarketsTable.orgId, userOrgId);

  const [marketCounts] = await db
    .select({
      totalMarkets: sql<number>`count(*)::int`,
      openMarkets: sql<number>`count(*) filter (where ${predictionMarketsTable.status} = 'open' and (${predictionMarketsTable.closesAt} is null or ${predictionMarketsTable.closesAt} > now()))::int`,
      categories: sql<number>`count(distinct ${predictionMarketsTable.category})::int`,
    })
    .from(predictionMarketsTable)
    .where(orgFilter);

  const [voteCounts] = await db
    .select({ totalVotes: sql<number>`count(*)::int` })
    .from(marketVotesTable)
    .where(
      sql`${marketVotesTable.marketId} IN (SELECT id FROM prediction_markets WHERE ${predictionMarketsTable.orgId} = ${PLATFORM_ORG_ID} OR ${predictionMarketsTable.orgId} = ${userOrgId})`,
    );

  res.json({
    totalMarkets: marketCounts?.totalMarkets ?? 0,
    openMarkets: marketCounts?.openMarkets ?? 0,
    totalVotes: voteCounts?.totalVotes ?? 0,
    categories: marketCounts?.categories ?? 0,
  });
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /api/v1/markets/:id ─────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  const userOrgId = req.thea!.org.id;
  const rows = await db
    .select()
    .from(predictionMarketsTable)
    .where(and(eq(predictionMarketsTable.id, req.params.id), tenantOr(predictionMarketsTable.orgId, userOrgId)))
    .limit(1);

  if (!rows[0]) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  const [market] = await serializeMarkets(rows);
  res.json(market);
});

// ─── POST /api/v1/markets/:id/vote ───────────────────────────────────────────
router.post("/:id/vote", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    res.status(404).json({ error: "Market not found" });
    return;
  }
  const parsed = VoteOnMarketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid vote payload", details: parsed.error.issues });
    return;
  }
  const { optionIndex, voterId } = parsed.data;
  const userOrgId = req.thea!.org.id;

  const rows = await db
    .select()
    .from(predictionMarketsTable)
    .where(and(eq(predictionMarketsTable.id, req.params.id), tenantOr(predictionMarketsTable.orgId, userOrgId)))
    .limit(1);

  const market = rows[0];
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  const isClosed =
    market.status !== "open" ||
    (market.closesAt !== null && market.closesAt.getTime() < Date.now());
  if (isClosed) {
    res.status(409).json({ error: "Market is closed for voting" });
    return;
  }

  const optionCount = Array.isArray(market.options) ? market.options.length : 0;
  if (optionIndex >= optionCount) {
    res.status(400).json({ error: `optionIndex must be between 0 and ${optionCount - 1}` });
    return;
  }

  const inserted = await db
    .insert(marketVotesTable)
    .values({ marketId: market.id, optionIndex, voterId })
    .onConflictDoNothing()
    .returning({ id: marketVotesTable.id });

  if (inserted.length === 0) {
    res.status(409).json({ error: "You have already voted on this market" });
    return;
  }

  const [serialized] = await serializeMarkets([market]);
  res.json(serialized);
});

export default router;
