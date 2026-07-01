import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysisReportsTable = pgTable("analysis_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id"),
  category: text("category").notNull(),
  runAt: timestamp("run_at").notNull().defaultNow(),
  miroFishRunId: text("miro_fish_run_id"),
  status: text("status").notNull().default("pending"),
  trendingTopics: jsonb("trending_topics").default([]),
  narrativeSummary: text("narrative_summary"),
  sentimentOverall: text("sentiment_overall"),
  keyEntities: jsonb("key_entities").default([]),
  predictions: jsonb("predictions").default([]),
  rawReport: text("raw_report"),
  seedDocumentLength: integer("seed_document_length"),
  itemsAnalyzed: integer("items_analyzed").default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnalysisReportSchema = createInsertSchema(analysisReportsTable).omit({ id: true, createdAt: true });
export const selectAnalysisReportSchema = createSelectSchema(analysisReportsTable);
export type InsertAnalysisReport = z.infer<typeof insertAnalysisReportSchema>;
export type AnalysisReport = typeof analysisReportsTable.$inferSelect;
