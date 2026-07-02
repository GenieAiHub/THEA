import { db } from "@workspace/db";
import { contentItemsTable, geoSignalsTable } from "@workspace/db/schema";
import { eq, and, gte, sql, avg, count, isNotNull, desc } from "drizzle-orm";
import { logger } from "./logger";

export interface GeoHeatmapEntry {
  countryCode: string;
  region: string | null;
  intensity: number;
  mentionCount: number;
  avgSentiment: number | null;
}

/**
 * Aggregate geo signals from content_items for a given topic/keyword.
 * Intensity = log(mentionCount + 1) normalized to 0-100.
 */
export async function computeGeoHeatmap(
  orgId: string,
  topic: string,
  timeframeHours = 24,
): Promise<GeoHeatmapEntry[]> {
  const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
  const pattern = `%${topic.replace(/[%_]/g, "\\$&")}%`;

  const rows = await db
    .select({
      countryCode: contentItemsTable.geoCountry,
      region: contentItemsTable.geoRegion,
      mentionCount: count(),
      avgSentiment: avg(contentItemsTable.sentimentScore),
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        isNotNull(contentItemsTable.geoCountry),
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    )
    .groupBy(contentItemsTable.geoCountry, contentItemsTable.geoRegion)
    .orderBy(desc(count()));

  if (!rows.length) return [];

  const maxCount = Math.max(...rows.map((r) => Number(r.mentionCount)));

  return rows.map((row) => {
    const n = Number(row.mentionCount);
    const intensity = maxCount > 0 ? Math.round((Math.log(n + 1) / Math.log(maxCount + 1)) * 100) : 0;
    return {
      countryCode: row.countryCode!,
      region: row.region,
      intensity,
      mentionCount: n,
      avgSentiment: row.avgSentiment !== null ? Math.round(Number(row.avgSentiment) * 100) / 100 : null,
    };
  });
}

/**
 * Persist aggregated geo signals to the geo_signals table (hourly window).
 */
export async function persistGeoSignals(
  orgId: string,
  topic: string,
  windowAt: Date,
): Promise<void> {
  const entries = await computeGeoHeatmap(orgId, topic, 1);
  if (!entries.length) return;

  try {
    await db.insert(geoSignalsTable).values(
      entries.map((e) => ({
        orgId,
        topic,
        countryCode: e.countryCode,
        region: e.region,
        intensity: e.intensity,
        mentionCount: e.mentionCount,
        avgSentiment: e.avgSentiment,
        windowAt,
      })),
    );
  } catch (err) {
    logger.warn({ err, orgId, topic }, "Failed to persist geo signals");
  }
}

/**
 * Query aggregated geo signals from the geo_signals table.
 * Falls back to live computation from content_items if no stored signals.
 */
export async function queryGeoHeatmap(
  orgId: string,
  topic: string,
  timeframeHours = 24,
): Promise<GeoHeatmapEntry[]> {
  const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);

  const stored = await db
    .select()
    .from(geoSignalsTable)
    .where(
      and(
        eq(geoSignalsTable.orgId, orgId),
        eq(geoSignalsTable.topic, topic),
        gte(geoSignalsTable.windowAt, since),
      ),
    );

  if (stored.length > 0) {
    // Aggregate stored windows
    const byCountry = new Map<string, GeoHeatmapEntry>();
    for (const row of stored) {
      const key = `${row.countryCode}:${row.region ?? ""}`;
      const existing = byCountry.get(key);
      if (existing) {
        existing.mentionCount += row.mentionCount;
        existing.intensity = Math.max(existing.intensity, row.intensity);
      } else {
        byCountry.set(key, {
          countryCode: row.countryCode,
          region: row.region,
          intensity: row.intensity,
          mentionCount: row.mentionCount,
          avgSentiment: row.avgSentiment,
        });
      }
    }
    return [...byCountry.values()].sort((a, b) => b.mentionCount - a.mentionCount);
  }

  // Fall back to live computation
  return computeGeoHeatmap(orgId, topic, timeframeHours);
}
