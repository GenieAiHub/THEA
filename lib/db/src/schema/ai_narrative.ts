import {
  pgTable,
  text,
  timestamp,
  uuid,
  real,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { watchlistKeywordsTable } from "./watchlist_keywords";

/**
 * AI Narrative Monitor — tracks how AI assistants (ChatGPT, Gemini, …)
 * describe an org's tracked entities over time.
 *
 * A tracked prompt is one question asked about one entity. Prompts are
 * seeded automatically from the org's watchlist brand/competitor keywords
 * and can be edited by org users afterwards.
 */
export const aiNarrativePromptsTable = pgTable(
  "ai_narrative_prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    /** The entity (brand, competitor, person) the question is about. */
    entity: text("entity").notNull(),
    entityType: text("entity_type").notNull().default("brand"), // brand | competitor | person | keyword
    /** The literal question sent to each AI provider. */
    promptText: text("prompt_text").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    /** Watchlist keyword this prompt was seeded from (null when user-created or keyword deleted). */
    seededFromKeywordId: uuid("seeded_from_keyword_id").references(
      () => watchlistKeywordsTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("ai_narrative_prompts_org_idx").on(t.orgId, t.isActive)],
);

/**
 * One monitoring run for one org: every active prompt asked to every
 * configured provider, then scored.
 */
export const aiNarrativeRunsTable = pgTable(
  "ai_narrative_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("running"), // running | completed | partial | failed
    trigger: text("trigger").notNull().default("scheduled"), // scheduled | manual
    promptCount: integer("prompt_count").notNull().default(0),
    responseCount: integer("response_count").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [index("ai_narrative_runs_org_started_idx").on(t.orgId, t.startedAt)],
);

/**
 * One provider's answer to one prompt in one run, plus its scores.
 * `entity` is denormalized from the prompt so history survives prompt
 * edits/deletes (promptId FK is set null on delete).
 */
export const aiNarrativeResponsesTable = pgTable(
  "ai_narrative_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => aiNarrativeRunsTable.id, { onDelete: "cascade" }),
    promptId: uuid("prompt_id").references(() => aiNarrativePromptsTable.id, {
      onDelete: "set null",
    }),
    entity: text("entity").notNull(),
    provider: text("provider").notNull(), // openai | gemini
    model: text("model").notNull(),
    responseText: text("response_text").notNull(),
    /** −1 (very negative) … +1 (very positive); null when scoring failed. */
    sentimentScore: real("sentiment_score"),
    /** { mentions: { "Entity Name": count, … } } — entities named in the answer. */
    shareOfVoice: jsonb("share_of_voice").default({}),
    /** string[] — notable factual claims the AI made about the entity. */
    notableClaims: jsonb("notable_claims").default([]),
    /** string[] — verbatim quote snippets worth surfacing in the UI. */
    quoteSnippets: jsonb("quote_snippets").default([]),
    /** [{ uri, title }] — Gemini grounding sources (empty for ungrounded providers). */
    groundingSources: jsonb("grounding_sources").default([]),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_narrative_responses_timeline_idx").on(
      t.orgId,
      t.entity,
      t.provider,
      t.createdAt,
    ),
    index("ai_narrative_responses_run_idx").on(t.runId),
  ],
);

export const insertAiNarrativePromptSchema = createInsertSchema(aiNarrativePromptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAiNarrativePromptSchema = createSelectSchema(aiNarrativePromptsTable);
export type InsertAiNarrativePrompt = z.infer<typeof insertAiNarrativePromptSchema>;
export type AiNarrativePrompt = typeof aiNarrativePromptsTable.$inferSelect;

export const insertAiNarrativeRunSchema = createInsertSchema(aiNarrativeRunsTable).omit({
  id: true,
  startedAt: true,
});
export const selectAiNarrativeRunSchema = createSelectSchema(aiNarrativeRunsTable);
export type InsertAiNarrativeRun = z.infer<typeof insertAiNarrativeRunSchema>;
export type AiNarrativeRun = typeof aiNarrativeRunsTable.$inferSelect;

export const insertAiNarrativeResponseSchema = createInsertSchema(aiNarrativeResponsesTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiNarrativeResponseSchema = createSelectSchema(aiNarrativeResponsesTable);
export type InsertAiNarrativeResponse = z.infer<typeof insertAiNarrativeResponseSchema>;
export type AiNarrativeResponse = typeof aiNarrativeResponsesTable.$inferSelect;
