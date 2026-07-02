import { db } from "@workspace/db";
import { contentItemsTable, watchlistKeywordsTable } from "@workspace/db/schema";
import { eq, and, gte, sql, count, avg } from "drizzle-orm";

export interface SovEntry {
  keyword: string;
  type: string;
  mentionCount: number;
  sharePercent: number;
  avgSentiment: number | null;
  trend: "up" | "down" | "stable";
}

export interface NarrativeGap {
  competitor: string;
  topics: string[];
  message: string;
}

/**
 * Compute share-of-voice for the org's brand vs tracked competitors.
 *
 * Returns mention counts + share percentages for each brand/competitor keyword,
 * based on content_items collected in the given time window.
 */
export async function computeShareOfVoice(
  orgId: string,
  timeframeHours = 24,
): Promise<{ entries: SovEntry[]; totalMentions: number }> {
  const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
  const prevSince = new Date(Date.now() - timeframeHours * 2 * 60 * 60 * 1000);

  // Get org's brand and competitor keywords
  const keywords = await db
    .select()
    .from(watchlistKeywordsTable)
    .where(
      and(
        eq(watchlistKeywordsTable.orgId, orgId),
        eq(watchlistKeywordsTable.isActive, true),
        sql`${watchlistKeywordsTable.type} IN ('brand', 'competitor', 'keyword')`,
      ),
    );

  if (!keywords.length) return { entries: [], totalMentions: 0 };

  const results: SovEntry[] = [];
  let totalMentions = 0;

  for (const kw of keywords) {
    const pattern = `%${kw.keyword.replace(/[%_]/g, "\\$&")}%`;

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
          sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
        ),
      );

    const [previous] = await db
      .select({ n: count() })
      .from(contentItemsTable)
      .where(
        and(
          eq(contentItemsTable.orgId, orgId),
          gte(contentItemsTable.collectedAt, prevSince),
          sql`collectedAt < ${since}`,
          sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
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
        current?.avgSentiment !== null
          ? Math.round(Number(current?.avgSentiment) * 100) / 100
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
