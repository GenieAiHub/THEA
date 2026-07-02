import { pgTable, text, timestamp, uuid, integer, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

const PLATFORM_ORG_ID = "10000000-0000-0000-0000-000000000001";

export const entityMentionsTable = pgTable("entity_mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().default(PLATFORM_ORG_ID).references(() => organizationsTable.id, { onDelete: "cascade" }),
  entityName: text("entity_name").notNull(),
  entityType: text("entity_type").notNull(),
  category: text("category").notNull(),
  mentionCount: integer("mention_count").notNull().default(1),
  sentimentAvg: real("sentiment_avg"),
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("entity_mentions_org_id_idx").on(table.orgId),
  index("entity_mentions_name_idx").on(table.entityName),
  index("entity_mentions_category_idx").on(table.category),
  index("entity_mentions_window_idx").on(table.windowStart),
  index("entity_mentions_count_idx").on(table.mentionCount),
  uniqueIndex("entity_mentions_unique_idx").on(table.orgId, table.entityName, table.entityType, table.category, table.windowStart),
]);

export const insertEntityMentionSchema = createInsertSchema(entityMentionsTable).omit({ id: true, createdAt: true });
export const selectEntityMentionSchema = createSelectSchema(entityMentionsTable);
export type InsertEntityMention = z.infer<typeof insertEntityMentionSchema>;
export type EntityMention = typeof entityMentionsTable.$inferSelect;
