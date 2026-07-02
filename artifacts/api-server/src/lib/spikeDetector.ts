import { db } from "@workspace/db";
import { contentItemsTable, watchlistKeywordsTable, alertsTable } from "@workspace/db/schema";
import { eq, and, gte, lt, sql, count } from "drizzle-orm";
import { getQueues } from "./queues";
import { logger } from "./logger";
import { computeCrisisScore, saveCrisisScore } from "./crisisScoring";

const WINDOW_MINUTES = 15;
const BASELINE_HOURS = 24;
const SPIKE_THRESHOLD = 3.0;
const MIN_VOLUME = 10;

interface KeywordVolume {
  keywordId: string;
  keyword: string;
  orgId: string;
  currentVolume: number;
  baselineAvg: number;
  spikeRatio: number;
}

/**
 * Count content items mentioning a keyword in a given time window.
 * Uses ILIKE on title/body — sufficient for watchlist keyword matching.
 */
async function countMentions(
  keyword: string,
  orgId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const pattern = `%${keyword.replace(/[%_]/g, "\\$&")}%`;
  const [row] = await db
    .select({ n: count() })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, from),
        lt(contentItemsTable.collectedAt, to),
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * Run spike detection for a single org.
 * Called after each 15-min watchlist collection cycle.
 *
 * Flow:
 *   1. Compute volume for every active keyword
 *   2. Compute crisis score for every keyword (persisted to crisis_scores table)
 *   3. For keywords that cross the spike threshold, create alerts and queue dispatch
 */
export async function detectSpikesForOrg(orgId: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
  const baselineStart = new Date(now.getTime() - BASELINE_HOURS * 60 * 60 * 1000);

  const keywords = await db
    .select()
    .from(watchlistKeywordsTable)
    .where(and(eq(watchlistKeywordsTable.orgId, orgId), eq(watchlistKeywordsTable.isActive, true)));

  if (!keywords.length) return;

  const baselineSlots = (BASELINE_HOURS * 60) / WINDOW_MINUTES - 1;
  const spikes: KeywordVolume[] = [];

  // ─── Step 1 + 2: Compute volumes and crisis scores for ALL active keywords ──
  for (const kw of keywords) {
    const [currentVolume, baselineTotal] = await Promise.all([
      countMentions(kw.keyword, orgId, windowStart, now),
      countMentions(kw.keyword, orgId, baselineStart, windowStart),
    ]);

    const baselineAvg = baselineSlots > 0 ? baselineTotal / baselineSlots : 0;
    const spikeRatio =
      baselineAvg > 0 ? currentVolume / baselineAvg : currentVolume > 0 ? 999 : 1;

    // Compute crisis score for every keyword and persist to history table
    const crisis = await computeCrisisScore(orgId, kw.keyword, currentVolume, baselineAvg);
    await saveCrisisScore(orgId, kw.id, kw.keyword, crisis);

    if (spikeRatio >= SPIKE_THRESHOLD && currentVolume >= MIN_VOLUME) {
      spikes.push({ keywordId: kw.id, keyword: kw.keyword, orgId, currentVolume, baselineAvg, spikeRatio });
    }
  }

  // ─── Step 3: Create alerts for spiking keywords ──────────────────────────────
  for (const spike of spikes) {
    // Re-use the crisis score we already computed (pull from last DB insert)
    const crisis = await computeCrisisScore(orgId, spike.keyword, spike.currentVolume, spike.baselineAvg);

    const severity =
      spike.spikeRatio >= 10 || crisis.score >= 80
        ? "critical"
        : spike.spikeRatio >= 5 || crisis.score >= 60
          ? "high"
          : spike.spikeRatio >= 3 || crisis.score >= 40
            ? "medium"
            : "low";

    const [alert] = await db
      .insert(alertsTable)
      .values({
        orgId,
        keywordId: spike.keywordId,
        keyword: spike.keyword,
        type: "spike",
        severity,
        spikeRatio: spike.spikeRatio,
        crisisProbability: crisis.score,
        volumeBefore: spike.baselineAvg,
        volumeAfter: spike.currentVolume,
        sentimentShift: crisis.sentimentShift,
        status: "new",
        payload: { crisis, window: `${WINDOW_MINUTES}m`, baseline: `${BASELINE_HOURS}h` },
      })
      .returning();

    logger.info(
      { orgId, keyword: spike.keyword, spikeRatio: spike.spikeRatio.toFixed(2), severity, crisisScore: crisis.score },
      "Spike alert created",
    );

    await getQueues().alertDispatch.add(
      "alert-dispatch",
      {
        alertId: alert.id,
        orgId,
        keyword: spike.keyword,
        severity,
        spikeRatio: spike.spikeRatio,
        crisisProbability: crisis.score,
      },
      { priority: severity === "critical" ? 1 : severity === "high" ? 2 : 5 },
    );
  }

  if (spikes.length > 0 || keywords.length > 0) {
    logger.info({ orgId, keywords: keywords.length, spikes: spikes.length }, "Spike detection + crisis scoring complete");
  }
}

/**
 * Run spike detection for ALL active orgs.
 */
export async function detectSpikesAllOrgs(): Promise<void> {
  const orgs = await db
    .selectDistinct({ orgId: watchlistKeywordsTable.orgId })
    .from(watchlistKeywordsTable)
    .where(eq(watchlistKeywordsTable.isActive, true));

  await Promise.allSettled(orgs.map((o) => detectSpikesForOrg(o.orgId)));
}
