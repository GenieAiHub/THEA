import { db } from "@workspace/db";
import { contentItemsTable, entityMentionsTable } from "@workspace/db/schema";
import { eq, and, gte, lt, isNotNull, sql, desc } from "drizzle-orm";
import { logger } from "../logger";

interface EntityRecord {
  name: string;
  type: string;
  category: string;
  sentimentSum: number;
  sentimentCount: number;
  count: number;
}

const PLATFORM_ORG_ID = "10000000-0000-0000-0000-000000000001";

export async function aggregateEntityMentions(
  windowStart: Date,
  windowEnd: Date,
  category?: string,
  orgId: string = PLATFORM_ORG_ID
): Promise<void> {
  const conditions = [
    isNotNull(contentItemsTable.processedAt),
    gte(contentItemsTable.collectedAt, windowStart),
    lt(contentItemsTable.collectedAt, windowEnd),
  ];
  if (category) conditions.push(eq(contentItemsTable.category, category));

  const rows = await db
    .select({
      entities: contentItemsTable.entities,
      category: contentItemsTable.category,
      sentimentScore: contentItemsTable.sentimentScore,
    })
    .from(contentItemsTable)
    .where(and(...conditions));

  if (!rows.length) return;

  const entityMap = new Map<string, EntityRecord>();

  for (const row of rows) {
    if (!Array.isArray(row.entities)) continue;
    const cat = row.category ?? "unknown";

    for (const entity of row.entities as Array<{ name: string; type: string }>) {
      if (!entity.name || !entity.type) continue;
      const key = `${entity.name.toLowerCase()}::${entity.type}::${cat}`;
      const existing = entityMap.get(key);

      if (existing) {
        existing.count++;
        if (row.sentimentScore !== null) {
          existing.sentimentSum += row.sentimentScore;
          existing.sentimentCount++;
        }
      } else {
        entityMap.set(key, {
          name: entity.name.slice(0, 200),
          type: entity.type,
          category: cat,
          count: 1,
          sentimentSum: row.sentimentScore ?? 0,
          sentimentCount: row.sentimentScore !== null ? 1 : 0,
        });
      }
    }
  }

  if (!entityMap.size) return;

  for (const record of entityMap.values()) {
    const sentimentAvg = record.sentimentCount > 0
      ? record.sentimentSum / record.sentimentCount
      : null;

    try {
      await db
        .insert(entityMentionsTable)
        .values({
          orgId,
          entityName: record.name,
          entityType: record.type,
          category: record.category,
          mentionCount: record.count,
          sentimentAvg,
          windowStart,
          windowEnd,
        })
        .onConflictDoUpdate({
          target: [
            entityMentionsTable.orgId,
            entityMentionsTable.entityName,
            entityMentionsTable.entityType,
            entityMentionsTable.category,
            entityMentionsTable.windowStart,
          ],
          set: {
            mentionCount: sql`excluded.mention_count`,
            sentimentAvg: sql`excluded.sentiment_avg`,
          },
        });
    } catch (err) {
      logger.warn({ err, entity: record.name }, "Failed to upsert entity mention");
    }
  }

  logger.info(
    { windowStart, windowEnd, category: category ?? "all", orgId, entities: entityMap.size },
    "Entity mentions aggregated"
  );
}

export async function getTopEntities(
  windowHours = 24,
  orgId?: string,
  category?: string,
  limit = 20
): Promise<Array<{ entityName: string; entityType: string; category: string; mentionCount: number; sentimentAvg: number | null }>> {
  const { or } = await import("drizzle-orm");
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const orgFilter = orgId
    ? or(eq(entityMentionsTable.orgId, PLATFORM_ORG_ID), eq(entityMentionsTable.orgId, orgId))!
    : eq(entityMentionsTable.orgId, PLATFORM_ORG_ID);

  const conditions = [gte(entityMentionsTable.windowStart, since), orgFilter];
  if (category) conditions.push(eq(entityMentionsTable.category, category));

  return db
    .select({
      entityName: entityMentionsTable.entityName,
      entityType: entityMentionsTable.entityType,
      category: entityMentionsTable.category,
      mentionCount: sql<number>`SUM(${entityMentionsTable.mentionCount})`,
      sentimentAvg: sql<number | null>`AVG(${entityMentionsTable.sentimentAvg})`,
    })
    .from(entityMentionsTable)
    .where(and(...conditions))
    .groupBy(entityMentionsTable.entityName, entityMentionsTable.entityType, entityMentionsTable.category)
    .orderBy(desc(sql`SUM(${entityMentionsTable.mentionCount})`))
    .limit(Math.min(100, limit));
}
