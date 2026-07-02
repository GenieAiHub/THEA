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
const BURST_ACCOUNT_THRESHOLD = 5;
const REPEAT_POST_THRESHOLD = 3;
const TEXT_SIMILARITY_THRESHOLD = 0.7; // Jaccard similarity for coordinated text
const MIN_TOKENS = 5;                  // ignore very short posts for similarity

/**
 * Tokenise text into a Set of lowercase word tokens (strips punctuation).
 */
function tokenise(text: string | null): Set<string> {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

/**
 * Jaccard similarity between two token sets.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersect = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersect / union;
}

/**
 * Compute organic confidence (0-100%) for a topic or keyword.
 *
 * Algorithm:
 *   1. Average bot risk from existing botRiskScore column
 *   2. Same-author repeat detection: ≥3 posts in 30-min window
 *   3. Cross-account burst detection: ≥5 different accounts posting in same 30-min slot
 *   4. Near-duplicate text detection: pairs of items from different accounts with
 *      Jaccard token similarity ≥0.7 within 30 min (coordinated messaging pattern)
 *   5. organic_confidence = 100 − (repeat_ratio × 30) − (burst_penalty × 20) − (text_similarity_penalty × 10) − (avg_bot_risk × 40)
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
      body: contentItemsTable.body,
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

  const avgBotRisk =
    items.reduce((sum, i) => sum + (i.botRiskScore ?? 0), 0) / items.length;
  const highRiskCount = items.filter((i) => (i.botRiskScore ?? 0) >= BOT_RISK_THRESHOLD).length;

  const windowMs = COORDINATION_WINDOW_MINUTES * 60 * 1000;

  // ── 1. Same-author repeat detection ────────────────────────────────────────
  const authorBuckets = new Map<string, number[]>();
  for (const item of items) {
    if (!item.author) continue;
    if (!authorBuckets.has(item.author)) authorBuckets.set(item.author, []);
    authorBuckets.get(item.author)!.push(item.collectedAt.getTime());
  }

  const repeatingAuthors = new Set<string>();
  for (const [author, timestamps] of authorBuckets) {
    const sorted = timestamps.slice().sort((a, b) => a - b);
    let l = 0;
    for (let r = 0; r < sorted.length; r++) {
      while (sorted[r]! - sorted[l]! > windowMs) l++;
      if (r - l + 1 >= REPEAT_POST_THRESHOLD) {
        repeatingAuthors.add(author);
        break;
      }
    }
  }

  // ── 2. Cross-account burst detection ───────────────────────────────────────
  const slotMs = windowMs;
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

  // ── 3. Near-duplicate text detection (cross-account Jaccard similarity) ────
  // Sample up to 100 items for efficiency; compute pairwise Jaccard in same slot
  const sampleItems = items.slice(0, 100).map((i) => ({
    author: i.author,
    tokens: tokenise([i.title, i.body?.slice(0, 300)].filter(Boolean).join(" ")),
    slot: Math.floor(i.collectedAt.getTime() / slotMs),
  }));

  let coordinatedTextPairs = 0;
  for (let i = 0; i < sampleItems.length; i++) {
    for (let j = i + 1; j < sampleItems.length; j++) {
      const a = sampleItems[i]!;
      const b = sampleItems[j]!;
      if (
        a.author !== b.author &&
        a.slot === b.slot &&
        a.tokens.size >= MIN_TOKENS &&
        b.tokens.size >= MIN_TOKENS &&
        jaccard(a.tokens, b.tokens) >= TEXT_SIMILARITY_THRESHOLD
      ) {
        coordinatedTextPairs++;
      }
    }
  }
  const textSimilarityPenalty = Math.min(0.5, coordinatedTextPairs / 10);

  const coordinatedItems = items.filter((i) => i.author && repeatingAuthors.has(i.author)).length;
  const coordinatedItemRatio = coordinatedItems / items.length;
  const burstPenalty = Math.min(0.5, coordinatedBurstCount / 10);

  const organicConfidence = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100
          - coordinatedItemRatio * 30
          - burstPenalty * 20
          - textSimilarityPenalty * 10
          - avgBotRisk * 40,
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
