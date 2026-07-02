import { db } from "@workspace/db";
import { contentItemsTable, crawlerSourcesTable, campaignsTable, campaignMeasurementsTable } from "@workspace/db/schema";
import { eq, and, gte, lt, desc, sql, avg, count, inArray } from "drizzle-orm";
import { computeShareOfVoice } from "./shareOfVoice";
import { logger } from "./logger";

const DEFAULT_CPM = 10; // fallback CPM if outlet has no benchmark set

export interface CampaignMetrics {
  campaignId: string;
  measuredAt: string;
  keywordVolume: number;
  sentimentScore: number;
  sovPercent: number;
  mediaPickupCount: number;
  emv: number;
  vsBaseline: {
    volumeChange: number;
    sentimentChange: number;
    sovChange: number;
  };
}

/**
 * Compute EMV for content items mentioning campaign keywords from a specific outlet.
 *
 * EMV = outlet_monthly_reach × topic_relevance_score × CPM_benchmark / 1000
 *
 * topic_relevance_score is approximated from the item's sentiment score (abs value)
 * mapped to 0-1. Items with higher engagement or stronger sentiment count more.
 */
async function computeItemEmv(sourceUrl: string, sentimentScore: number | null): Promise<number> {
  const absUrl = new URL(sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`);
  const domain = absUrl.hostname.replace(/^www\./, "");

  const [source] = await db
    .select({
      monthlyUniques: crawlerSourcesTable.monthlyUniques,
      cpmBenchmark: crawlerSourcesTable.cpmBenchmark,
    })
    .from(crawlerSourcesTable)
    .where(sql`${crawlerSourcesTable.url} ILIKE ${"%" + domain + "%"}`)
    .limit(1);

  const reach = source?.monthlyUniques ?? 100_000;
  const cpm = source?.cpmBenchmark ?? DEFAULT_CPM;
  const relevance = Math.min(1, 0.5 + Math.abs(Number(sentimentScore ?? 0.3)));

  return (reach * relevance * cpm) / 1_000_000; // EMV in thousands of dollars
}

/**
 * Measure daily campaign performance and persist to campaign_measurements table.
 */
export async function measureCampaignDaily(campaignId: string): Promise<CampaignMetrics | null> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.status, "active")));

  if (!campaign) return null;

  const keywords = (campaign.targetKeywords as string[] | null) ?? [];
  if (!keywords.length) return null;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const orgId = campaign.orgId;

  // Build OR filter for all target keywords
  const keywordFilters = keywords.map((kw) => {
    const p = `%${kw.replace(/[%_]/g, "\\$&")}%`;
    return sql`(${contentItemsTable.title} ILIKE ${p} OR ${contentItemsTable.body} ILIKE ${p})`;
  });

  const mentionFilter = sql`(${sql.join(keywordFilters, sql` OR `)})`;

  // Current 24h window
  const [stats] = await db
    .select({
      n: count(),
      avgSentiment: avg(contentItemsTable.sentimentScore),
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, dayAgo),
        mentionFilter,
      ),
    );

  const keywordVolume = Number(stats?.n ?? 0);
  const sentimentScore = Math.round(Number(stats?.avgSentiment ?? 0) * 100) / 100;

  // SOV — use first keyword as primary
  const { entries, totalMentions } = await computeShareOfVoice(orgId, 24);
  const brandEntry = entries.find((e) => keywords.some((kw) => kw.toLowerCase() === e.keyword.toLowerCase()));
  const sovPercent = brandEntry?.sharePercent ?? 0;

  // Media pickup count (news/rss items only)
  const [mediaStats] = await db
    .select({ n: count() })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, dayAgo),
        inArray(contentItemsTable.platform, ["rss", "news", "web"]),
        mentionFilter,
      ),
    );

  const mediaPickupCount = Number(mediaStats?.n ?? 0);

  // EMV — compute per news item with source URL
  const newsItems = await db
    .select({ sourceUrl: contentItemsTable.sourceUrl, sentimentScore: contentItemsTable.sentimentScore })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, dayAgo),
        inArray(contentItemsTable.platform, ["rss", "news", "web"]),
        sql`${contentItemsTable.sourceUrl} IS NOT NULL`,
        mentionFilter,
      ),
    )
    .limit(100);

  let emv = 0;
  for (const item of newsItems) {
    if (item.sourceUrl) {
      emv += await computeItemEmv(item.sourceUrl, item.sentimentScore).catch(() => 0);
    }
  }

  // Baseline comparison
  const volumeChange = campaign.baselineKeywordVolume
    ? ((keywordVolume - campaign.baselineKeywordVolume) / Math.max(campaign.baselineKeywordVolume, 1)) * 100
    : 0;
  const sentimentChange = campaign.baselineSentiment
    ? sentimentScore - Number(campaign.baselineSentiment)
    : 0;
  const sovChange = campaign.baselineSov ? sovPercent - Number(campaign.baselineSov) : 0;

  // Persist measurement
  await db.insert(campaignMeasurementsTable).values({
    campaignId,
    measuredAt: now,
    keywordVolume,
    sentimentScore,
    sovPercent,
    mediaPickupCount,
    emv: Math.round(emv * 100) / 100,
  });

  logger.info({ campaignId, keywordVolume, sentimentScore, emv: emv.toFixed(2) }, "Campaign measurement recorded");

  return {
    campaignId,
    measuredAt: now.toISOString(),
    keywordVolume,
    sentimentScore,
    sovPercent,
    mediaPickupCount,
    emv: Math.round(emv * 100) / 100,
    vsBaseline: {
      volumeChange: Math.round(volumeChange * 10) / 10,
      sentimentChange: Math.round(sentimentChange * 100) / 100,
      sovChange: Math.round(sovChange * 10) / 10,
    },
  };
}

/**
 * Compute and set baseline metrics for a campaign from pre-launch data.
 */
export async function computeCampaignBaseline(campaignId: string): Promise<void> {
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) return;

  const keywords = (campaign.targetKeywords as string[] | null) ?? [];
  if (!keywords.length) return;

  const baselineEnd = campaign.startDate;
  const baselineStart = new Date(baselineEnd.getTime() - 14 * 24 * 60 * 60 * 1000); // 14-day baseline
  const orgId = campaign.orgId;

  const keywordFilters = keywords.map((kw) => {
    const p = `%${kw.replace(/[%_]/g, "\\$&")}%`;
    return sql`(${contentItemsTable.title} ILIKE ${p} OR ${contentItemsTable.body} ILIKE ${p})`;
  });

  const [stats] = await db
    .select({ n: count(), avgSentiment: avg(contentItemsTable.sentimentScore) })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, baselineStart),
        lt(contentItemsTable.collectedAt, baselineEnd),
        sql`(${sql.join(keywordFilters, sql` OR `)})`,
      ),
    );

  const days = 14;
  const baselineVolume = Number(stats?.n ?? 0) / days;

  await db
    .update(campaignsTable)
    .set({
      baselinePeriodStart: baselineStart,
      baselinePeriodEnd: baselineEnd,
      baselineKeywordVolume: baselineVolume,
      baselineSentiment: Number(stats?.avgSentiment ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(campaignsTable.id, campaignId));

  logger.info({ campaignId, baselineVolume: baselineVolume.toFixed(1) }, "Campaign baseline computed");
}

/**
 * Run daily measurements for ALL active campaigns.
 */
export async function measureAllActiveCampaigns(): Promise<void> {
  const activeCampaigns = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(eq(campaignsTable.status, "active"));

  await Promise.allSettled(
    activeCampaigns.map((c) =>
      measureCampaignDaily(c.id).catch((err) =>
        logger.warn({ err, campaignId: c.id }, "Campaign daily measurement failed"),
      ),
    ),
  );
}
