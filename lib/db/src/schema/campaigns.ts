import { pgTable, text, timestamp, uuid, real, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * Campaign tracker — measures impact of a comms campaign after launch.
 * baseline period is auto-calculated from data before startDate.
 */
export const campaignsTable = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetKeywords: jsonb("target_keywords").default([]).$type<string[]>(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  baselinePeriodStart: timestamp("baseline_period_start", { withTimezone: true }),
  baselinePeriodEnd: timestamp("baseline_period_end", { withTimezone: true }),
  goal: text("goal"),
  status: text("status").notNull().default("active"),
  baselineKeywordVolume: real("baseline_keyword_volume").default(0),
  baselineSentiment: real("baseline_sentiment").default(0),
  baselineSov: real("baseline_sov").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("campaigns_org_idx").on(table.orgId),
  index("campaigns_status_idx").on(table.status),
]);

/**
 * Daily campaign measurements — before/after comparison for ROI.
 */
export const campaignMeasurementsTable = pgTable("campaign_measurements", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
  keywordVolume: integer("keyword_volume").notNull().default(0),
  sentimentScore: real("sentiment_score").default(0),
  sovPercent: real("sov_percent").default(0),
  mediaPickupCount: integer("media_pickup_count").default(0),
  emv: real("emv").default(0),
}, (table) => [
  index("campaign_measurements_campaign_idx").on(table.campaignId),
  index("campaign_measurements_measured_at_idx").on(table.measuredAt),
]);

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCampaignSchema = createSelectSchema(campaignsTable);
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;

export const insertCampaignMeasurementSchema = createInsertSchema(campaignMeasurementsTable).omit({ id: true });
export type InsertCampaignMeasurement = z.infer<typeof insertCampaignMeasurementSchema>;
export type CampaignMeasurement = typeof campaignMeasurementsTable.$inferSelect;
