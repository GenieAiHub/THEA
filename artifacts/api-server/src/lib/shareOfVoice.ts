import { db } from "@workspace/db";
import { contentItemsTable, watchlistKeywordsTable } from "@workspace/db/schema";
import { eq, and, gte, lt, sql, count, avg, inArray } from "drizzle-orm";

export interface SovEntry {
  keyword: string;
  type: string;
  mentionCount: number;
  sharePercent: number;
  avgSentiment: number | null;
  trend: "up" | "down" | "stable";
}

/**
 * Compute share-of-voice for the org's brand vs tracked competitors.
 *
 * Returns mention counts + share percentages for each brand/competitor keyword,
 * based on content_items collected in the given time window.
 *
 * @param orgId      Organisation ID
 * @param timeframeHours  Rolling window in hours from now (default 24). Ignored when dateRange is provided.
 * @param dateRange  Explicit start/end dates (e.g. campaign pre-launch baseline window).
 */
export async function computeShareOfVoice(
  orgId: string,
  timeframeHours = 24,
  dateRange?: { since: Date; until: Date },
): Promise<{ entries: SovEntry[]; totalMentions: number }> {
  const now = new Date();
  const since = dateRange?.since ?? new Date(now.getTime() - timeframeHours * 60 * 60 * 1000);
  const until = dateRange?.until ?? now;
  const windowMs = until.getTime() - since.getTime();
  const prevSince = dateRange
    ? new Date(since.getTime() - windowMs) // same-length window before baseline
    : new Date(now.getTime() - timeframeHours * 2 * 60 * 60 * 1000);

  // Get org's brand, competitor and keyword entries
  const keywords = await db
    .select()
    .from(watchlistKeywordsTable)
    .where(
      and(
        eq(watchlistKeywordsTable.orgId, orgId),
        eq(watchlistKeywordsTable.isActive, true),
        inArray(watchlistKeywordsTable.type, ["brand", "competitor", "keyword"]),
      ),
    );

  if (!keywords.length) return { entries: [], totalMentions: 0 };

  const results: SovEntry[] = [];
  let totalMentions = 0;

  for (const kw of keywords) {
    const pattern = `%${kw.keyword.replace(/[%_]/g, "\\$&")}%`;
    const mentionFilter = sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`;

    // Current window
    const [current] = await db
      .select({
        n: count(),
        avgSentiment: avg(contentItemsTable.sentimentScore),
      })
      .from(contentItemsTable)
      .where(
        and(
          eq(contentItemsTable.orgId, orgId),
          gte(contentItemsTable.collectedAt, since),
          lt(contentItemsTable.collectedAt, until),
          mentionFilter,
        ),
      );

    // Previous window (prevSince → since) for trend calculation
    const [previous] = await db
      .select({ n: count() })
      .from(contentItemsTable)
      .where(
        and(
          eq(contentItemsTable.orgId, orgId),
          gte(contentItemsTable.collectedAt, prevSince),
          lt(contentItemsTable.collectedAt, since),
          mentionFilter,
        ),
      );

    const currentN = Number(current?.n ?? 0);
    const prevN = Number(previous?.n ?? 0);
    const trend: "up" | "down" | "stable" =
      currentN > prevN * 1.1 ? "up" : currentN < prevN * 0.9 ? "down" : "stable";

    results.push({
      keyword: kw.keyword,
      type: kw.type,
      mentionCount: currentN,
      sharePercent: 0, // computed after totals
      avgSentiment:
        current?.avgSentiment != null
          ? Math.round(Number(current.avgSentiment) * 100) / 100
          : null,
      trend,
    });
    totalMentions += currentN;
  }

  // Compute share percentages
  for (const entry of results) {
    entry.sharePercent =
      totalMentions > 0 ? Math.round((entry.mentionCount / totalMentions) * 1000) / 10 : 0;
  }

  return { entries: results.sort((a, b) => b.mentionCount - a.mentionCount), totalMentions };
}
