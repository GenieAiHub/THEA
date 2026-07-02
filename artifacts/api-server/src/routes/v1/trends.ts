import { Router } from "express";
import { db } from "@workspace/db";
import { trendScoresTable } from "@workspace/db/schema";
import { desc, eq, gte, and, or } from "drizzle-orm";
import { requireAuth } from "../../middlewares/clerkAuth";

const router = Router();
router.use(requireAuth);

const PLATFORM_ORG_ID = "10000000-0000-0000-0000-000000000001";

/** Show platform-wide trends + this org's own trend scores */
function trendOrgScope(orgId: string) {
  return or(
    eq(trendScoresTable.orgId, PLATFORM_ORG_ID),
    eq(trendScoresTable.orgId, orgId)
  )!;
}

router.get("/", async (req, res) => {
  const { category, timeframe = "24h", limit = "20" } = req.query as Record<string, string>;
  const orgId = req.thea!.org.id;

  const hoursMap: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
  const hours = hoursMap[timeframe] ?? 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const conditions = [gte(trendScoresTable.scoredAt, since), trendOrgScope(orgId)];
  if (category) conditions.push(eq(trendScoresTable.category, category));

  const trends = await db
    .select()
    .from(trendScoresTable)
    .where(and(...conditions))
    .orderBy(desc(trendScoresTable.score))
    .limit(Math.min(100, parseInt(limit, 10)));

  res.json({ data: trends, timeframe, since });
});

router.get("/categories", async (_req, res) => {
  const categories = [
    "Politics",
    "News",
    "Technology",
    "Media",
    "Society",
    "Branding",
    "Entertainment",
  ];
  res.json({ data: categories });
});

router.get("/:topic", async (req, res) => {
  const { topic } = req.params;
  const { timeframe = "24h" } = req.query as Record<string, string>;
  const orgId = req.thea!.org.id;

  const hoursMap: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
  const hours = hoursMap[timeframe] ?? 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const history = await db
    .select()
    .from(trendScoresTable)
    .where(
      and(
        eq(trendScoresTable.topic, topic as string),
        gte(trendScoresTable.scoredAt, since),
        trendOrgScope(orgId)
      )
    )
    .orderBy(desc(trendScoresTable.scoredAt));

  res.json({ topic, timeframe, data: history });
});

export default router;
