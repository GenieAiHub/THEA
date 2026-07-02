import { pgTable, text, timestamp, uuid, real, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { watchlistKeywordsTable } from "./watchlist_keywords";

/**
 * Crisis probability scores — stored per keyword per analysis cycle.
 * Score 0-100: weighted combination of velocity, sentiment shift, bot ratio, and media pickup.
 */
export const crisisScoresTable = pgTable("crisis_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  keywordId: uuid("keyword_id")
    .references(() => watchlistKeywordsTable.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  score: real("score").notNull().default(0),
  velocityScore: real("velocity_score").notNull().default(0),
  sentimentScore: real("sentiment_score").notNull().default(0),
  botScore: real("bot_score").notNull().default(0),
  mediaPickupScore: real("media_pickup_score").notNull().default(0),
  volumeCurrent: real("volume_current").notNull().default(0),
  volumeBaseline: real("volume_baseline").notNull().default(0),
  spikeRatio: real("spike_ratio").notNull().default(1),
  components: jsonb("components").default({}).$type<Record<string, number>>(),
  scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("crisis_scores_org_keyword_idx").on(table.orgId, table.keyword),
  index("crisis_scores_scored_at_idx").on(table.scoredAt),
  index("crisis_scores_keyword_id_idx").on(table.keywordId),
]);

export const insertCrisisScoreSchema = createInsertSchema(crisisScoresTable).omit({ id: true });
export const selectCrisisScoreSchema = createSelectSchema(crisisScoresTable);
export type InsertCrisisScore = z.infer<typeof insertCrisisScoreSchema>;
export type CrisisScore = typeof crisisScoresTable.$inferSelect;
