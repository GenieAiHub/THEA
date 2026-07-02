import { pgTable, text, timestamp, uuid, real, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * Influencer scoring — top amplifier accounts ranked by reach × engagement.
 * Bot-risk flag: follower/engagement ratio >20 is suspicious.
 */
export const influencerScoresTable = pgTable("influencer_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  platform: text("platform").notNull(),
  accountHandle: text("account_handle").notNull(),
  displayName: text("display_name"),
  followerCount: integer("follower_count").default(0),
  avgEngagementRate: real("avg_engagement_rate").default(0),
  reachScore: real("reach_score").notNull().default(0),
  botRisk: real("bot_risk").notNull().default(0),
  isBotFlagged: text("is_bot_flagged").notNull().default("false"),
  mentionCount: integer("mention_count").notNull().default(0),
  scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("influencer_scores_org_topic_idx").on(table.orgId, table.topic),
  index("influencer_scores_scored_at_idx").on(table.scoredAt),
  index("influencer_scores_reach_idx").on(table.reachScore),
]);

export const insertInfluencerScoreSchema = createInsertSchema(influencerScoresTable).omit({ id: true });
export const selectInfluencerScoreSchema = createSelectSchema(influencerScoresTable);
export type InsertInfluencerScore = z.infer<typeof insertInfluencerScoreSchema>;
export type InfluencerScore = typeof influencerScoresTable.$inferSelect;
