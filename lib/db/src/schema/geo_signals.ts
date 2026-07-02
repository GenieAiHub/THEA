import { pgTable, text, timestamp, uuid, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * Geographic intensity signals — aggregated mention intensity per
 * country/region per topic per 1-hour window.
 * Powers the geographic heat map feature.
 */
export const geoSignalsTable = pgTable("geo_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  countryCode: text("country_code").notNull(),
  region: text("region"),
  intensity: real("intensity").notNull().default(0),
  mentionCount: real("mention_count").notNull().default(0),
  avgSentiment: real("avg_sentiment"),
  windowAt: timestamp("window_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("geo_signals_org_topic_idx").on(table.orgId, table.topic),
  index("geo_signals_country_idx").on(table.countryCode),
  index("geo_signals_window_at_idx").on(table.windowAt),
  index("geo_signals_org_topic_country_window_idx").on(table.orgId, table.topic, table.countryCode, table.windowAt),
]);

export const insertGeoSignalSchema = createInsertSchema(geoSignalsTable).omit({ id: true, createdAt: true });
export const selectGeoSignalSchema = createSelectSchema(geoSignalsTable);
export type InsertGeoSignal = z.infer<typeof insertGeoSignalSchema>;
export type GeoSignal = typeof geoSignalsTable.$inferSelect;
