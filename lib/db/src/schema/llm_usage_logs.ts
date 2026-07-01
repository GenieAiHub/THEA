import { pgTable, text, timestamp, uuid, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const llmUsageLogsTable = pgTable("llm_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  model: text("model").notNull(),
  operation: text("operation").notNull(),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  estimatedCostUsd: real("estimated_cost_usd").default(0),
  durationMs: integer("duration_ms"),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLlmUsageLogSchema = createInsertSchema(llmUsageLogsTable).omit({ id: true, createdAt: true });
export const selectLlmUsageLogSchema = createSelectSchema(llmUsageLogsTable);
export type InsertLlmUsageLog = z.infer<typeof insertLlmUsageLogSchema>;
export type LlmUsageLog = typeof llmUsageLogsTable.$inferSelect;
