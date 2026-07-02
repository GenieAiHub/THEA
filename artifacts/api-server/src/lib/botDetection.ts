import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { eq, and, gte, sql, avg, count } from "drizzle-orm";

export interface BotDetectionResult {
  organicConfidence: number;
  coordinatedItemRatio: number;
  avgBotRisk: number;
  highRiskCount: number;
  totalAnalyzed: number;
  flaggedAccounts: string[];
}

const BOT_RISK_THRESHOLD = 0.7;
const COORDINATION_WINDOW_MINUTES = 30;

/**
 * Compute organic confidence (0-100%) for a topic or keyword.
 *
 * Algorithm:
 *   1. Fetch all content items for the topic in the last 6h
 *   2. Compute average bot risk from existing botRiskScore column
 *   3. Detect coordinated posting: same author, multiple posts in 30 min window
 *   4. organic_confidence = 100 - (coordinated_ratio * 60) - (avg_bot_risk * 40)
 */
export async function computeOrganicConfidence(
  orgId: string,
  topic: string,
  timeframeHours = 6,
): Promise<BotDetectionResult> {
  const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
  const pattern = `%${topic.replace(/[%_]/g, "\\$&")}%`;

  const items = await db
    .select({
      author: contentItemsTable.author,
      botRiskScore: contentItemsTable.botRiskScore,
      collectedAt: contentItemsTable.collectedAt,
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    )
    .limit(500);

  if (!items.length) {
    return { organicConfidence: 100, coordinatedItemRatio: 0, avgBotRisk: 0, highRiskCount: 0, totalAnalyzed: 0, flaggedAccounts: [] };
  }

  // Compute average bot risk
  const avgBotRisk =
    items.reduce((sum, i) => sum + (i.botRiskScore ?? 0), 0) / items.length;

  const highRiskCount = items.filter((i) => (i.botRiskScore ?? 0) >= BOT_RISK_THRESHOLD).length;

  // Detect coordinated posting: authors posting 3+ times within 30-min window
  const authorBuckets = new Map<string, Date[]>();
  for (const item of items) {
    if (!item.author) continue;
    if (!authorBuckets.has(item.author)) authorBuckets.set(item.author, []);
    authorBuckets.get(item.author)!.push(item.collectedAt);
  }

  const windowMs = COORDINATION_WINDOW_MINUTES * 60 * 1000;
  const coordinatedAuthors = new Set<string>();
  for (const [author, timestamps] of authorBuckets) {
    const sorted = timestamps.map((t) => t.getTime()).sort((a, b) => a - b);
    for (let i = 0; i <= sorted.length - 3; i++) {
      if (sorted[i + 2]! - sorted[i]! <= windowMs) {
        coordinatedAuthors.add(author);
        break;
      }
    }
  }

  const coordinatedItems = items.filter((i) => i.author && coordinatedAuthors.has(i.author)).length;
  const coordinatedItemRatio = coordinatedItems / items.length;

  const organicConfidence = Math.round(
    Math.max(0, Math.min(100, 100 - coordinatedItemRatio * 60 - avgBotRisk * 40)),
  );

  return {
    organicConfidence,
    coordinatedItemRatio: Math.round(coordinatedItemRatio * 100) / 100,
    avgBotRisk: Math.round(avgBotRisk * 100) / 100,
    highRiskCount,
    totalAnalyzed: items.length,
    flaggedAccounts: [...coordinatedAuthors].slice(0, 10),
  };
}
