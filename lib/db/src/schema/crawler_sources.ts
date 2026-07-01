import { pgTable, text, timestamp, uuid, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crawlerSourcesTable = pgTable("crawler_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull().default("rss"),
  category: text("category").notNull(),
  language: text("language").default("en"),
  country: text("country"),
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config").default({}),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"),
  lastRunCount: integer("last_run_count").default(0),
  errorCount: integer("error_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCrawlerSourceSchema = createInsertSchema(crawlerSourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCrawlerSourceSchema = createSelectSchema(crawlerSourcesTable);
export type InsertCrawlerSource = z.infer<typeof insertCrawlerSourceSchema>;
export type CrawlerSource = typeof crawlerSourcesTable.$inferSelect;
