import { pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const collectionRunsTable = pgTable("collection_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceType: text("source_type").notNull(),
  sourceId: uuid("source_id"),
  status: text("status").notNull().default("running"),
  itemsFetched: integer("items_fetched").default(0),
  itemsDeduplicated: integer("items_deduplicated").default(0),
  itemsStored: integer("items_stored").default(0),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default({}),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertCollectionRunSchema = createInsertSchema(collectionRunsTable).omit({ id: true, startedAt: true });
export const selectCollectionRunSchema = createSelectSchema(collectionRunsTable);
export type InsertCollectionRun = z.infer<typeof insertCollectionRunSchema>;
export type CollectionRun = typeof collectionRunsTable.$inferSelect;
