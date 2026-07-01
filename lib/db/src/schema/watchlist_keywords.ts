import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const watchlistKeywordsTable = pgTable("watchlist_keywords", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  type: text("type").notNull().default("keyword"),
  category: text("category"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWatchlistKeywordSchema = createInsertSchema(watchlistKeywordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectWatchlistKeywordSchema = createSelectSchema(watchlistKeywordsTable);
export type InsertWatchlistKeyword = z.infer<typeof insertWatchlistKeywordSchema>;
export type WatchlistKeyword = typeof watchlistKeywordsTable.$inferSelect;
