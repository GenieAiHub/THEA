import { pgTable, text, timestamp, uuid, real, jsonb, index, customType } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

const vector = customType<{ data: number[]; config: { dimensions: number }; configRequired: true; driverData: string }>({
  dataType(config) {
    return `vector(${config.dimensions})`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map(parseFloat);
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

export const contentItemsTable = pgTable("content_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  contentHash: text("content_hash").notNull(),
  platform: text("platform").notNull(),
  sourceUrl: text("source_url"),
  sourceUrls: jsonb("source_urls").notNull().default([]),
  title: text("title"),
  body: text("body").notNull(),
  author: text("author"),
  language: text("language").default("en"),
  category: text("category"),
  sentimentScore: real("sentiment_score"),
  engagementMetrics: jsonb("engagement_metrics").default({}),
  rawMetadata: jsonb("raw_metadata").default({}),
  entities: jsonb("entities").default([]),
  summary: text("summary"),
  embedding: vector("embedding", { dimensions: 1536 }),
  isDisinformation: text("is_disinformation").default("false"),
  botRiskScore: real("bot_risk_score"),
  geoCountry: text("geo_country"),
  geoRegion: text("geo_region"),
  publishedAt: timestamp("published_at"),
  collectedAt: timestamp("collected_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => [
  index("content_items_org_id_idx").on(table.orgId),
  index("content_items_platform_idx").on(table.platform),
  index("content_items_category_idx").on(table.category),
  index("content_items_language_idx").on(table.language),
  index("content_items_collected_at_idx").on(table.collectedAt),
  index("content_items_org_platform_idx").on(table.orgId, table.platform),
]);

export const insertContentItemSchema = createInsertSchema(contentItemsTable).omit({ id: true, collectedAt: true });
export const selectContentItemSchema = createSelectSchema(contentItemsTable);
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type ContentItem = typeof contentItemsTable.$inferSelect;
