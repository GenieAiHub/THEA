import { pgTable, text, timestamp, uuid, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * THEA Markets — public prediction polls generated from trend data.
 * `options` stores the option labels as a JSON array of strings; vote counts
 * are aggregated from market_votes at read time.
 */
export const predictionMarketsTable = pgTable("prediction_markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  status: text("status").notNull().default("open"), // open | closed | resolved
  resolvedOption: integer("resolved_option"),
  source: text("source").notNull().default("manual"), // auto | manual
  sourceTopic: text("source_topic"),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("prediction_markets_status_idx").on(table.status),
  index("prediction_markets_category_idx").on(table.category),
  index("prediction_markets_created_at_idx").on(table.createdAt),
]);

export const marketVotesTable = pgTable("market_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketId: uuid("market_id").notNull().references(() => predictionMarketsTable.id, { onDelete: "cascade" }),
  optionIndex: integer("option_index").notNull(),
  voterId: text("voter_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("market_votes_market_voter_idx").on(table.marketId, table.voterId),
  index("market_votes_market_idx").on(table.marketId),
]);

export const insertPredictionMarketSchema = createInsertSchema(predictionMarketsTable).omit({ id: true });
export const selectPredictionMarketSchema = createSelectSchema(predictionMarketsTable);
export type InsertPredictionMarket = z.infer<typeof insertPredictionMarketSchema>;
export type PredictionMarket = typeof predictionMarketsTable.$inferSelect;
export type MarketVote = typeof marketVotesTable.$inferSelect;
