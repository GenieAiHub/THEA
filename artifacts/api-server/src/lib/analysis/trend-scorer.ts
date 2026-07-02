import { db } from "@workspace/db";
import { trendScoresTable } from "@workspace/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { logger } from "../logger";
import type { ParsedReport } from "./report-parser";

export type LifecycleStage = "emerging" | "accelerating" | "peaked" | "declining" | "dead";

function classifyLifecycle(
  currentScore: number,
  history: Array<{ score: number; scoredAt: Date }>
): LifecycleStage {
  if (currentScore < 5) return "dead";

  if (history.length < 2) return "emerging";

  const sortedHistory = [...history].sort((a, b) => a.scoredAt.getTime() - b.scoredAt.getTime());
  const oldest = sortedHistory[0]!.score;
  const recent = sortedHistory[sortedHistory.length - 1]!.score;

  const hoursSinceFirst = (Date.now() - sortedHistory[0]!.scoredAt.getTime()) / (1000 * 60 * 60);
  const changePercent = oldest > 0 ? ((currentScore - oldest) / oldest) * 100 : 0;
  const recentChangePercent = recent > 0 ? ((currentScore - recent) / recent) * 100 : 0;

  if (currentScore < 5 && hoursSinceFirst > 3) return "dead";
  if (recentChangePercent <= -15) return "declining";
  if (Math.abs(recentChangePercent) <= 5 && hoursSinceFirst >= 2) return "peaked";
  if (recentChangePercent >= 20) return "accelerating";
  if (hoursSinceFirst < 2 && changePercent > 0) return "emerging";
  return "peaked";
}

function computeCompositeScore(params: {
  consensusStrength: number;
  engagementPercentile: number;
  velocity: number;
  sourceDiversity: number;
}): number {
  const { consensusStrength, engagementPercentile, velocity, sourceDiversity } = params;
  const raw =
    consensusStrength * 0.4 +
    engagementPercentile * 0.3 +
    velocity * 0.2 +
    sourceDiversity * 0.1;
  return Math.round(Math.max(0, Math.min(100, raw * 100)));
}

export async function scoreTrends(
  report: ParsedReport,
  category: string,
  itemsAnalyzed: number
): Promise<void> {
  if (!report.trendingTopics.length) return;

  const lookbackMs = 6 * 60 * 60 * 1000;
  const since = new Date(Date.now() - lookbackMs);

  for (const topicData of report.trendingTopics) {
    const { topic, score: miroScore, evidenceStrength, trajectory } = topicData;

    const history = await db
      .select({ score: trendScoresTable.score, scoredAt: trendScoresTable.scoredAt })
      .from(trendScoresTable)
      .where(
        and(
          eq(trendScoresTable.topic, topic),
          eq(trendScoresTable.category, category),
          gte(trendScoresTable.scoredAt, since)
        )
      )
      .orderBy(desc(trendScoresTable.scoredAt));

    const velocityScore = history.length > 0
      ? Math.max(0, Math.min(1, (miroScore - (history[0]?.score ?? miroScore)) / 100 + 0.5))
      : 0.5;

    const sourceDiversity = Math.min(1, itemsAnalyzed / 50);
    const engagementPercentile = evidenceStrength;

    const compositeScore = computeCompositeScore({
      consensusStrength: miroScore / 100,
      engagementPercentile,
      velocity: velocityScore,
      sourceDiversity,
    });

    const historyWithCurrent = [
      ...history,
      { score: compositeScore, scoredAt: new Date() },
    ];
    const lifecycleStage = classifyLifecycle(compositeScore, history);

    const keyEntities = report.keyEntities.slice(0, 5);

    try {
      await db.insert(trendScoresTable).values({
        topic: topic.slice(0, 500),
        category,
        score: compositeScore,
        velocityScore,
        engagementScore: engagementPercentile,
        consensusScore: miroScore / 100,
        diversityScore: sourceDiversity,
        lifecycleStage,
        mentionCount: itemsAnalyzed,
        sentimentAvg: report.sentimentOverall === "positive" ? 0.5
          : report.sentimentOverall === "negative" ? -0.5 : 0,
        topSources: keyEntities,
      });
    } catch (err) {
      logger.warn({ err, topic, category }, "Failed to insert trend score");
    }
  }

  logger.info({ category, topics: report.trendingTopics.length }, "Trend scores computed and stored");
}
