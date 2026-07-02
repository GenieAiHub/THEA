import { pgTable, text, timestamp, uuid, real, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

const PLATFORM_ORG_ID = "10000000-0000-0000-0000-000000000001";

export const trendScoresTable = pgTable("trend_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().default(PLATFORM_ORG_ID).references(() => organizationsTable.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  category: text("category").notNull(),
  score: real("score").notNull(),
  velocityScore: real("velocity_score"),
  engagementScore: real("engagement_score"),
  consensusScore: real("consensus_score"),
  diversityScore: real("diversity_score"),
  lifecycleStage: text("lifecycle_stage").default("emerging"),
  mentionCount: integer("mention_count").default(0),
  sentimentAvg: real("sentiment_avg"),
  topSources: jsonb("top_sources").default([]),
  scoredAt: timestamp("scored_at").notNull().defaultNow(),
}, (table) => [
  index("trend_scores_org_id_idx").on(table.orgId),
  index("trend_scores_topic_idx").on(table.topic),
  index("trend_scores_category_idx").on(table.category),
  index("trend_scores_scored_at_idx").on(table.scoredAt),
  index("trend_scores_score_idx").on(table.score),
]);

export const insertTrendScoreSchema = createInsertSchema(trendScoresTable).omit({ id: true });
export const selectTrendScoreSchema = createSelectSchema(trendScoresTable);
export type InsertTrendScore = z.infer<typeof insertTrendScoreSchema>;
export type TrendScore = typeof trendScoresTable.$inferSelect;
