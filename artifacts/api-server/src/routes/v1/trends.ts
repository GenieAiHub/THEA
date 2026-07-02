import { Router } from "express";
import { db } from "@workspace/db";
import { trendScoresTable } from "@workspace/db/schema";
import { desc, eq, gte, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/clerkAuth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { category, timeframe = "24h", limit = "20" } = req.query as Record<string, string>;

  const hoursMap: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
  const hours = hoursMap[timeframe] ?? 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const conditions = [gte(trendScoresTable.scoredAt, since)];
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

  const hoursMap: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
  const hours = hoursMap[timeframe] ?? 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const history = await db
    .select()
    .from(trendScoresTable)
    .where(
      and(
        eq(trendScoresTable.topic, topic),
        gte(trendScoresTable.scoredAt, since)
      )
    )
    .orderBy(desc(trendScoresTable.scoredAt));

  res.json({ topic, timeframe, data: history });
});

export default router;
