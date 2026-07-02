import { pgTable, text, timestamp, uuid, boolean, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Journalist tracker — profiles indexed by beat and outlet.
 * Populated from media outlet RSS bylines and manual seeding.
 * Auto-updated from content_items.author on daily scan.
 */
export const journalistsTable = pgTable("journalists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  outlet: text("outlet").notNull(),
  beatTags: text("beat_tags").array().default([]),
  twitterHandle: text("twitter_handle"),
  email: text("email"),
  articleCountPerMonth: integer("article_count_per_month").default(0),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastArticleTitle: text("last_article_title"),
  lastArticleUrl: text("last_article_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("journalists_name_outlet_unique").on(table.name, table.outlet),
  index("journalists_outlet_idx").on(table.outlet),
  index("journalists_last_seen_idx").on(table.lastSeenAt),
]);

export const insertJournalistSchema = createInsertSchema(journalistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectJournalistSchema = createSelectSchema(journalistsTable);
export type InsertJournalist = z.infer<typeof insertJournalistSchema>;
export type Journalist = typeof journalistsTable.$inferSelect;
