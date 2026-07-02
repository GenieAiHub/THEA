import { db } from "@workspace/db";
import { contentItemsTable, crisisScoresTable } from "@workspace/db/schema";
import { eq, and, gte, sql, avg, count } from "drizzle-orm";
import { logger } from "./logger";

export interface CrisisScoreResult {
  score: number;
  velocityScore: number;
  sentimentScore: number;
  botScore: number;
  mediaPickupScore: number;
  sentimentShift: number;
  spikeRatio: number;
  volumeCurrent: number;
  volumeBaseline: number;
}

const WEIGHTS = {
  velocity: 0.35,
  sentiment: 0.30,
  bot: 0.20,
  media: 0.15,
};

/**
 * Compute a 0-100 crisis probability score for a keyword.
 *
 * Components:
 *   - Velocity (35%): volume growth rate vs baseline
 *   - Sentiment shift (30%): positive→negative movement in last 1h
 *   - Bot ratio (20%): % of items from high-risk accounts
 *   - Media pickup (15%): distinct news outlets in last 1h
 */
export async function computeCrisisScore(
  orgId: string,
  keyword: string,
  currentVolume: number,
  baselineAvg: number,
): Promise<CrisisScoreResult> {
  const pattern = `%${keyword.replace(/[%_]/g, "\\$&")}%`;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const [recentMetrics] = await db
    .select({
      avgSentiment: avg(contentItemsTable.sentimentScore),
      avgBotRisk: avg(contentItemsTable.botRiskScore),
      distinctOutlets: sql<number>`count(distinct ${contentItemsTable.sourceUrl})::int`,
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, oneHourAgo),
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    );

  const [baselineSentiment] = await db
    .select({ avgSentiment: avg(contentItemsTable.sentimentScore) })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, sixHoursAgo),
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    );

  const spikeRatio = baselineAvg > 0 ? currentVolume / baselineAvg : currentVolume > 0 ? 10 : 1;

  // Velocity score (0-100): capped at 10× spike
  const velocityScore = Math.min(100, ((spikeRatio - 1) / 9) * 100);

  // Sentiment shift score (0-100): positive→negative movement
  const recentSentiment = Number(recentMetrics?.avgSentiment ?? 0);
  const baselineSentimentVal = Number(baselineSentiment?.avgSentiment ?? 0);
  const sentimentShift = baselineSentimentVal - recentSentiment; // positive = got more negative
  const sentimentScore = Math.min(100, Math.max(0, sentimentShift * 200)); // 0.5 shift = 100

  // Bot score (0-100): 100% bot risk items → 100
  const avgBotRisk = Number(recentMetrics?.avgBotRisk ?? 0);
  const botScore = Math.min(100, avgBotRisk * 100);

  // Media pickup score (0-100): 20+ distinct outlets = full score
  const distinctOutlets = Number(recentMetrics?.distinctOutlets ?? 0);
  const mediaPickupScore = Math.min(100, (distinctOutlets / 20) * 100);

  const score = Math.round(
    velocityScore * WEIGHTS.velocity +
    sentimentScore * WEIGHTS.sentiment +
    botScore * WEIGHTS.bot +
    mediaPickupScore * WEIGHTS.media,
  );

  return {
    score,
    velocityScore: Math.round(velocityScore),
    sentimentScore: Math.round(sentimentScore),
    botScore: Math.round(botScore),
    mediaPickupScore: Math.round(mediaPickupScore),
    sentimentShift,
    spikeRatio,
    volumeCurrent: currentVolume,
    volumeBaseline: baselineAvg,
  };
}

/**
 * Persist a crisis score for a keyword and return the stored record.
 */
export async function saveCrisisScore(
  orgId: string,
  keywordId: string | undefined,
  keyword: string,
  result: CrisisScoreResult,
) {
  try {
    const [row] = await db
      .insert(crisisScoresTable)
      .values({
        orgId,
        keywordId,
        keyword,
        score: result.score,
        velocityScore: result.velocityScore,
        sentimentScore: result.sentimentScore,
        botScore: result.botScore,
        mediaPickupScore: result.mediaPickupScore,
        volumeCurrent: result.volumeCurrent,
        volumeBaseline: result.volumeBaseline,
        spikeRatio: result.spikeRatio,
        components: {
          velocity: result.velocityScore,
          sentiment: result.sentimentScore,
          bot: result.botScore,
          mediaPickup: result.mediaPickupScore,
        },
      })
      .returning();
    return row;
  } catch (err) {
    logger.warn({ err, orgId, keyword }, "Failed to persist crisis score");
    return null;
  }
}
