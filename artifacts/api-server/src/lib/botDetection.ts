import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export interface BotDetectionResult {
  organicConfidence: number;
  coordinatedItemRatio: number;
  avgBotRisk: number;
  highRiskCount: number;
  totalAnalyzed: number;
  flaggedAccounts: string[];
  coordinatedBurstCount: number;
}

const BOT_RISK_THRESHOLD = 0.7;
const COORDINATION_WINDOW_MINUTES = 30;
const BURST_ACCOUNT_THRESHOLD = 5;   // 5+ different accounts = coordinated burst signal
const REPEAT_POST_THRESHOLD = 3;     // 3+ posts from same account in window = suspect

/**
 * Compute organic confidence (0-100%) for a topic or keyword.
 *
 * Algorithm:
 *   1. Fetch all content items for the topic in the last N hours
 *   2. Average bot risk from existing botRiskScore column
 *   3. Same-author repeat detection: ≥3 posts in 30-min window = suspect
 *   4. Cross-account burst detection: ≥5 different accounts posting in the same
 *      30-min window = coordinated burst signal (astroturfing pattern)
 *   5. organic_confidence = 100 − (coordinated_ratio × 40) − (burst_penalty × 20) − (avg_bot_risk × 40)
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
      title: contentItemsTable.title,
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
    return {
      organicConfidence: 100,
      coordinatedItemRatio: 0,
      avgBotRisk: 0,
      highRiskCount: 0,
      totalAnalyzed: 0,
      flaggedAccounts: [],
      coordinatedBurstCount: 0,
    };
  }

  // Average bot risk score
  const avgBotRisk =
    items.reduce((sum, i) => sum + (i.botRiskScore ?? 0), 0) / items.length;

  const highRiskCount = items.filter((i) => (i.botRiskScore ?? 0) >= BOT_RISK_THRESHOLD).length;

  const windowMs = COORDINATION_WINDOW_MINUTES * 60 * 1000;

  // ─── Same-author repeat detection ───────────────────────────────────────────
  const authorBuckets = new Map<string, number[]>();
  for (const item of items) {
    if (!item.author) continue;
    if (!authorBuckets.has(item.author)) authorBuckets.set(item.author, []);
    authorBuckets.get(item.author)!.push(item.collectedAt.getTime());
  }

  const repeatingAuthors = new Set<string>();
  for (const [author, timestamps] of authorBuckets) {
    const sorted = timestamps.slice().sort((a, b) => a - b);
    // Sliding window: find any window where ≥REPEAT_POST_THRESHOLD posts exist
    let l = 0;
    for (let r = 0; r < sorted.length; r++) {
      while (sorted[r]! - sorted[l]! > windowMs) l++;
      if (r - l + 1 >= REPEAT_POST_THRESHOLD) {
        repeatingAuthors.add(author);
        break;
      }
    }
  }

  // ─── Cross-account burst detection ──────────────────────────────────────────
  // Bucket items into 30-minute slots; any slot with ≥BURST_ACCOUNT_THRESHOLD
  // distinct authors is a coordinated burst.
  const slotMs = COORDINATION_WINDOW_MINUTES * 60 * 1000;
  const slotBuckets = new Map<number, Set<string>>();
  for (const item of items) {
    if (!item.author) continue;
    const slot = Math.floor(item.collectedAt.getTime() / slotMs);
    if (!slotBuckets.has(slot)) slotBuckets.set(slot, new Set());
    slotBuckets.get(slot)!.add(item.author);
  }

  let coordinatedBurstCount = 0;
  for (const [, accounts] of slotBuckets) {
    if (accounts.size >= BURST_ACCOUNT_THRESHOLD) coordinatedBurstCount++;
  }

  // Items from repeating authors
  const coordinatedItems = items.filter((i) => i.author && repeatingAuthors.has(i.author)).length;
  const coordinatedItemRatio = coordinatedItems / items.length;

  // Burst penalty: 0 if no burst slots, up to 0.5 if ≥5 burst slots observed
  const burstPenalty = Math.min(0.5, coordinatedBurstCount / 10);

  const organicConfidence = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100 - coordinatedItemRatio * 40 - burstPenalty * 20 - avgBotRisk * 40,
      ),
    ),
  );

  return {
    organicConfidence,
    coordinatedItemRatio: Math.round(coordinatedItemRatio * 100) / 100,
    avgBotRisk: Math.round(avgBotRisk * 100) / 100,
    highRiskCount,
    totalAnalyzed: items.length,
    flaggedAccounts: [...repeatingAuthors].slice(0, 10),
    coordinatedBurstCount,
  };
}
