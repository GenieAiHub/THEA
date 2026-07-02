import { pgTable, text, timestamp, uuid, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { watchlistKeywordsTable } from "./watchlist_keywords";

export const alertsTable = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  keywordId: uuid("keyword_id").references(() => watchlistKeywordsTable.id, { onDelete: "set null" }),
  keyword: text("keyword").notNull(),
  type: text("type").notNull().default("spike"),
  severity: text("severity").notNull().default("medium"),
  spikeRatio: real("spike_ratio"),
  crisisProbability: real("crisis_probability"),
  volumeBefore: real("volume_before"),
  volumeAfter: real("volume_after"),
  sentimentShift: real("sentiment_shift"),
  status: text("status").notNull().default("open"),
  payload: jsonb("payload").default({}),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true });
export const selectAlertSchema = createSelectSchema(alertsTable);
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
