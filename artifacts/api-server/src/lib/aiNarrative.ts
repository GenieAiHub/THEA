/**
 * AI Narrative Monitor — tracks how AI assistants (ChatGPT, Gemini) describe
 * an org's tracked entities.
 *
 * Flow per run:
 *   1. Ensure prompts exist (auto-seeded from watchlist brand/competitor keywords)
 *   2. Ask every active prompt to OpenAI (plain) + Gemini (Google-Search grounded)
 *   3. Score each answer with one gpt-4o-mini call (temperature 0, JSON mode):
 *      sentiment −1…+1, entity mentions, notable claims, quote snippets
 *   4. Persist run + responses
 *   5. Compare each entity's cross-provider average sentiment vs the previous
 *      run — a significant negative shift raises a normal THEA alert through
 *      the existing alert-dispatch pipeline (email/Slack/Telegram/WhatsApp).
 *
 * Cost controls: per-tier prompt caps, and the platform-wide daily LLM spend
 * cap is re-checked between prompts (a long run cannot blow past it mid-way).
 */
import { db } from "@workspace/db";
import {
  aiNarrativePromptsTable,
  aiNarrativeRunsTable,
  aiNarrativeResponsesTable,
  watchlistKeywordsTable,
  organizationsTable,
  subscriptionsTable,
  alertsTable,
  type AiNarrativePrompt,
} from "@workspace/db/schema";
import { eq, and, ne, desc, gte, lt, inArray, isNull, sql } from "drizzle-orm";
import { chatWithGpt, geminiGroundedSearch } from "./llm";
import { checkDailySpendCap } from "./analysis";
import { getQueues } from "./queues";
import { logger } from "./logger";
import type { Tier } from "../middlewares/featureGate";

export const AI_NARRATIVE_PROVIDERS = ["openai", "gemini"] as const;
export type AiNarrativeProvider = (typeof AI_NARRATIVE_PROVIDERS)[number];

/** Max active prompts queried per run, by tier. Starter has no access. */
export const AI_NARRATIVE_PROMPT_CAPS: Record<Tier, number> = {
  starter: 0,
  pro: 10,
  enterprise: 30,
};

/** Scheduled cadence per tier (ms between runs). */
export const AI_NARRATIVE_CADENCE_MS: Record<string, number> = {
  pro: 24 * 60 * 60 * 1000,
  enterprise: 6 * 60 * 60 * 1000,
};

/** Cross-provider average sentiment must drop by at least this much to alert. */
const SENTIMENT_SHIFT_THRESHOLD = 0.3;
/** Don't re-alert for the same entity while an open ai_narrative alert is younger than this. */
const ALERT_DEDUPE_HOURS = 24;
/** A run stuck in "running" longer than this is considered crashed (process restart mid-run). */
export const STALE_RUN_MS = 45 * 60 * 1000;

/**
 * Mark runs stuck in "running" for longer than STALE_RUN_MS as failed.
 * Called from the hourly scheduler tick so a crashed run cannot permanently
 * block manual runs (409 guard) or the portal "Run now" button.
 */
export async function failStaleNarrativeRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS);
  const stale = await db
    .update(aiNarrativeRunsTable)
    .set({ status: "failed", error: "Run timed out (process likely restarted mid-run)", completedAt: new Date() })
    .where(and(eq(aiNarrativeRunsTable.status, "running"), lt(aiNarrativeRunsTable.startedAt, cutoff)))
    .returning({ id: aiNarrativeRunsTable.id });
  if (stale.length) {
    logger.warn({ count: stale.length, runIds: stale.map((r) => r.id) }, "Marked stale AI narrative runs as failed");
  }
  return stale.length;
}

// ─── Prompt seeding ───────────────────────────────────────────────────────────

const BRAND_TEMPLATES = [
  (e: string) => `What can you tell me about ${e}?`,
  (e: string) => `What are the main criticisms or controversies involving ${e}?`,
];
const COMPETITOR_TEMPLATES = [(e: string) => `What can you tell me about ${e}?`];

/**
 * Seed tracked prompts from the org's watchlist brand/competitor keywords.
 * Idempotent: does nothing if the org already has any prompts (even inactive),
 * so user edits/deletions are never overwritten.
 */
export async function seedPromptsForOrg(orgId: string): Promise<number> {
  const [existing] = await db
    .select({ n: sql<number>`count(*)` })
    .from(aiNarrativePromptsTable)
    .where(eq(aiNarrativePromptsTable.orgId, orgId));
  if (Number(existing?.n ?? 0) > 0) return 0;

  const keywords = await db
    .select()
    .from(watchlistKeywordsTable)
    .where(
      and(
        eq(watchlistKeywordsTable.orgId, orgId),
        eq(watchlistKeywordsTable.isActive, true),
        inArray(watchlistKeywordsTable.type, ["brand", "competitor"]),
      ),
    );

  const rows: (typeof aiNarrativePromptsTable.$inferInsert)[] = [];
  for (const kw of keywords) {
    const templates = kw.type === "brand" ? BRAND_TEMPLATES : COMPETITOR_TEMPLATES;
    for (const t of templates) {
      rows.push({
        orgId,
        entity: kw.keyword,
        entityType: kw.type,
        promptText: t(kw.keyword),
        seededFromKeywordId: kw.id,
      });
    }
  }

  // Fall back to the org name so a fresh org still gets a useful default.
  if (!rows.length) {
    const [org] = await db
      .select({ name: organizationsTable.name })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, orgId));
    if (org) {
      for (const t of BRAND_TEMPLATES) {
        rows.push({ orgId, entity: org.name, entityType: "brand", promptText: t(org.name) });
      }
    }
  }

  if (rows.length) await db.insert(aiNarrativePromptsTable).values(rows);
  logger.info({ orgId, seeded: rows.length }, "AI narrative prompts seeded");
  return rows.length;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface NarrativeScores {
  sentiment: number | null;
  mentions: Record<string, number>;
  notableClaims: string[];
  quoteSnippets: string[];
}

async function scoreResponse(
  entity: string,
  question: string,
  answer: string,
  knownEntities: string[],
): Promise<NarrativeScores> {
  const system = `You are a media-intelligence scoring engine. You are given a question about the entity "${entity}" and the answer an AI assistant gave. Score how that answer portrays "${entity}".

Return ONLY a JSON object with exactly these keys:
{
  "sentiment": number,        // −1.0 (very negative portrayal of "${entity}") to +1.0 (very positive), 0 = neutral
  "mentions": object,         // map of entity name -> mention count, counting ONLY these entities: ${JSON.stringify(knownEntities)}
  "notableClaims": string[],  // up to 5 short factual claims the answer makes about "${entity}"
  "quoteSnippets": string[]   // up to 3 verbatim snippets (max ~200 chars each) from the answer that best show how "${entity}" is portrayed
}`;

  try {
    const resp = await chatWithGpt(
      [
        { role: "system", content: system },
        { role: "user", content: `QUESTION: ${question}\n\nANSWER:\n${answer.slice(0, 8000)}` },
      ],
      { model: "gpt-4o-mini", operation: "ai-narrative-score", temperature: 0, jsonMode: true },
    );
    const parsed = JSON.parse(resp.content) as Partial<NarrativeScores>;
    const sentiment =
      typeof parsed.sentiment === "number" && Number.isFinite(parsed.sentiment)
        ? Math.max(-1, Math.min(1, parsed.sentiment))
        : null;
    return {
      sentiment,
      mentions:
        parsed.mentions && typeof parsed.mentions === "object" && !Array.isArray(parsed.mentions)
          ? (parsed.mentions as Record<string, number>)
          : {},
      notableClaims: Array.isArray(parsed.notableClaims) ? parsed.notableClaims.slice(0, 5).map(String) : [],
      quoteSnippets: Array.isArray(parsed.quoteSnippets) ? parsed.quoteSnippets.slice(0, 3).map(String) : [],
    };
  } catch (err) {
    logger.warn({ err, entity }, "AI narrative scoring failed — storing unscored response");
    return { sentiment: null, mentions: {}, notableClaims: [], quoteSnippets: [] };
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

export interface NarrativeRunResult {
  runId: string;
  status: string;
  promptCount: number;
  responseCount: number;
  alertsRaised: number;
}

/** Resolve the org's active subscription tier (starter when none). */
export async function getOrgTier(orgId: string): Promise<Tier> {
  const [sub] = await db
    .select({ tier: subscriptionsTable.tier })
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.orgId, orgId), eq(subscriptionsTable.status, "active")))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  const tier = (sub?.tier ?? "starter") as Tier;
  return ["starter", "pro", "enterprise"].includes(tier) ? tier : "starter";
}

export async function runNarrativeMonitor(
  orgId: string,
  trigger: "scheduled" | "manual" = "scheduled",
): Promise<NarrativeRunResult> {
  const [org] = await db
    .select({ id: organizationsTable.id, pausedAt: organizationsTable.pausedAt })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId));
  if (!org) throw new Error(`Org not found: ${orgId}`);
  if (org.pausedAt) throw new Error("Organization is paused");

  const tier = await getOrgTier(orgId);
  const cap = AI_NARRATIVE_PROMPT_CAPS[tier];
  if (cap <= 0) throw new Error("AI Narrative Monitor requires a Pro subscription or higher");

  const spend = await checkDailySpendCap();
  if (!spend.withinCap) throw new Error("The platform's daily AI budget has been reached");

  await seedPromptsForOrg(orgId);

  const prompts = await db
    .select()
    .from(aiNarrativePromptsTable)
    .where(and(eq(aiNarrativePromptsTable.orgId, orgId), eq(aiNarrativePromptsTable.isActive, true)))
    .orderBy(aiNarrativePromptsTable.createdAt)
    .limit(cap);

  if (!prompts.length) throw new Error("No active tracked prompts — add watchlist brand/competitor keywords or create prompts");

  const knownEntities = [...new Set(prompts.map((p) => p.entity))];

  const [run] = await db
    .insert(aiNarrativeRunsTable)
    .values({ orgId, status: "running", trigger, promptCount: prompts.length })
    .returning();

  let responseCount = 0;
  let errorCount = 0;
  let budgetHit = false;

  for (const prompt of prompts) {
    // Re-check the platform spend cap between prompts (mid-run guard).
    const midCap = await checkDailySpendCap();
    if (!midCap.withinCap) {
      budgetHit = true;
      logger.warn({ orgId, runId: run.id }, "Daily AI budget reached mid-run — stopping narrative run early");
      break;
    }

    const results = await Promise.allSettled([
      queryOpenAi(prompt),
      queryGemini(prompt),
    ]);

    for (const r of results) {
      if (r.status === "rejected") {
        errorCount++;
        logger.warn({ err: r.reason, orgId, entity: prompt.entity }, "AI narrative provider query failed");
        continue;
      }
      const { provider, model, text, sources, promptTokens, completionTokens } = r.value;
      if (!text.trim()) {
        errorCount++;
        continue;
      }
      const scores = await scoreResponse(prompt.entity, prompt.promptText, text, knownEntities);
      await db.insert(aiNarrativeResponsesTable).values({
        orgId,
        runId: run.id,
        promptId: prompt.id,
        entity: prompt.entity,
        provider,
        model,
        responseText: text,
        sentimentScore: scores.sentiment,
        shareOfVoice: { mentions: scores.mentions },
        notableClaims: scores.notableClaims,
        quoteSnippets: scores.quoteSnippets,
        groundingSources: sources,
        promptTokens,
        completionTokens,
      });
      responseCount++;
    }
  }

  const status =
    responseCount === 0 ? "failed" : errorCount > 0 || budgetHit ? "partial" : "completed";
  await db
    .update(aiNarrativeRunsTable)
    .set({
      status,
      responseCount,
      completedAt: new Date(),
      error: budgetHit ? "Daily AI budget reached mid-run" : errorCount > 0 ? `${errorCount} provider queries failed` : null,
    })
    .where(eq(aiNarrativeRunsTable.id, run.id));

  let alertsRaised = 0;
  if (responseCount > 0) {
    alertsRaised = await detectNarrativeShifts(orgId, run.id).catch((err) => {
      logger.warn({ err, orgId, runId: run.id }, "Narrative shift detection failed");
      return 0;
    });
  }

  logger.info({ orgId, runId: run.id, status, responseCount, errorCount, alertsRaised }, "AI narrative run finished");
  return { runId: run.id, status, promptCount: prompts.length, responseCount, alertsRaised };
}

interface ProviderAnswer {
  provider: AiNarrativeProvider;
  model: string;
  text: string;
  sources: { uri: string; title: string }[];
  promptTokens: number;
  completionTokens: number;
}

async function queryOpenAi(prompt: AiNarrativePrompt): Promise<ProviderAnswer> {
  const resp = await chatWithGpt([{ role: "user", content: prompt.promptText }], {
    operation: "ai-narrative",
  });
  return {
    provider: "openai",
    model: resp.model,
    text: resp.content,
    sources: [],
    promptTokens: resp.promptTokens,
    completionTokens: resp.completionTokens,
  };
}

async function queryGemini(prompt: AiNarrativePrompt): Promise<ProviderAnswer> {
  const resp = await geminiGroundedSearch(prompt.promptText, { operation: "ai-narrative" });
  return {
    provider: "gemini",
    model: resp.model,
    text: resp.text,
    sources: resp.sources,
    promptTokens: 0,
    completionTokens: 0,
  };
}

// ─── Shift detection + alerting ───────────────────────────────────────────────

/**
 * Compare each entity's cross-provider AVERAGE sentiment in this run against
 * the previous run. A drop of ≥ SENTIMENT_SHIFT_THRESHOLD raises a THEA alert
 * (type "ai_narrative") through the normal alert-dispatch pipeline.
 * Per-provider deltas are stored in the alert payload for the UI only.
 */
export async function detectNarrativeShifts(orgId: string, runId: string): Promise<number> {
  const current = await db
    .select({
      entity: aiNarrativeResponsesTable.entity,
      provider: aiNarrativeResponsesTable.provider,
      sentiment: aiNarrativeResponsesTable.sentimentScore,
    })
    .from(aiNarrativeResponsesTable)
    .where(and(eq(aiNarrativeResponsesTable.orgId, orgId), eq(aiNarrativeResponsesTable.runId, runId)));

  const [prevRun] = await db
    .select({ id: aiNarrativeRunsTable.id })
    .from(aiNarrativeRunsTable)
    .where(
      and(
        eq(aiNarrativeRunsTable.orgId, orgId),
        ne(aiNarrativeRunsTable.id, runId),
        ne(aiNarrativeRunsTable.status, "failed"),
        ne(aiNarrativeRunsTable.status, "running"),
      ),
    )
    .orderBy(desc(aiNarrativeRunsTable.startedAt))
    .limit(1);
  if (!prevRun) return 0; // first run — nothing to compare against

  const previous = await db
    .select({
      entity: aiNarrativeResponsesTable.entity,
      provider: aiNarrativeResponsesTable.provider,
      sentiment: aiNarrativeResponsesTable.sentimentScore,
    })
    .from(aiNarrativeResponsesTable)
    .where(and(eq(aiNarrativeResponsesTable.orgId, orgId), eq(aiNarrativeResponsesTable.runId, prevRun.id)));

  const avgByEntity = (rows: typeof current) => {
    const acc = new Map<string, { sum: number; n: number; byProvider: Record<string, { sum: number; n: number }> }>();
    for (const r of rows) {
      if (r.sentiment == null) continue;
      const e = acc.get(r.entity) ?? { sum: 0, n: 0, byProvider: {} };
      e.sum += r.sentiment;
      e.n++;
      const p = e.byProvider[r.provider] ?? { sum: 0, n: 0 };
      p.sum += r.sentiment;
      p.n++;
      e.byProvider[r.provider] = p;
      acc.set(r.entity, e);
    }
    return acc;
  };

  const curAvg = avgByEntity(current);
  const prevAvg = avgByEntity(previous);
  let raised = 0;

  for (const [entity, cur] of curAvg) {
    const prev = prevAvg.get(entity);
    if (!prev || cur.n === 0 || prev.n === 0) continue;

    const currentAvg = cur.sum / cur.n;
    const previousAvg = prev.sum / prev.n;
    const delta = currentAvg - previousAvg;
    if (delta > -SENTIMENT_SHIFT_THRESHOLD) continue;

    // Dedupe: skip while any recent ai_narrative alert for this entity is < 24h old.
    // Note: the dispatch worker flips status "open" → "dispatched" within seconds,
    // so the dedupe must NOT filter on status or it would never match.
    const dedupeSince = new Date(Date.now() - ALERT_DEDUPE_HOURS * 60 * 60 * 1000);
    const [recentAlert] = await db
      .select({ id: alertsTable.id })
      .from(alertsTable)
      .where(
        and(
          eq(alertsTable.orgId, orgId),
          eq(alertsTable.type, "ai_narrative"),
          eq(alertsTable.keyword, entity),
          gte(alertsTable.createdAt, dedupeSince),
        ),
      )
      .limit(1);
    if (recentAlert) continue;

    const severity = delta <= -0.7 ? "critical" : delta <= -0.5 ? "high" : "medium";

    const providerDeltas: Record<string, number> = {};
    for (const p of AI_NARRATIVE_PROVIDERS) {
      const cp = cur.byProvider[p];
      const pp = prev.byProvider[p];
      if (cp?.n && pp?.n) providerDeltas[p] = Math.round((cp.sum / cp.n - pp.sum / pp.n) * 100) / 100;
    }

    const [alert] = await db
      .insert(alertsTable)
      .values({
        orgId,
        keyword: entity,
        type: "ai_narrative",
        severity,
        sentimentShift: Math.round(delta * 100) / 100,
        status: "open",
        payload: {
          runId,
          previousAvg: Math.round(previousAvg * 100) / 100,
          currentAvg: Math.round(currentAvg * 100) / 100,
          providerDeltas,
        },
      })
      .returning();

    await getQueues().alertDispatch.add(
      "alert-dispatch",
      {
        alertId: alert.id,
        orgId,
        keyword: entity,
        severity,
        alertType: "ai_narrative",
        sentimentShift: Math.round(delta * 100) / 100,
      },
      { priority: severity === "critical" ? 1 : severity === "high" ? 2 : 5 },
    );

    logger.info({ orgId, entity, delta: delta.toFixed(2), severity }, "AI narrative shift alert created");
    raised++;
  }

  return raised;
}

// ─── Read models (overview + timeline) ────────────────────────────────────────

export interface EntityNarrative {
  entity: string;
  entityType: string;
  providers: {
    provider: string;
    sentiment: number | null;
    delta: number | null;
    quoteSnippets: string[];
    notableClaims: string[];
    groundingSources: { uri: string; title: string }[];
    model: string;
    answeredAt: string;
  }[];
  avgSentiment: number | null;
  avgDelta: number | null;
}

export async function getNarrativeOverview(orgId: string): Promise<{
  lastRun: { id: string; status: string; startedAt: string; completedAt: string | null; trigger: string } | null;
  entities: EntityNarrative[];
}> {
  const runs = await db
    .select()
    .from(aiNarrativeRunsTable)
    .where(and(eq(aiNarrativeRunsTable.orgId, orgId), ne(aiNarrativeRunsTable.status, "failed")))
    .orderBy(desc(aiNarrativeRunsTable.startedAt))
    .limit(2);

  if (!runs.length) return { lastRun: null, entities: [] };
  const [latest, prev] = runs;

  const latestResponses = await db
    .select()
    .from(aiNarrativeResponsesTable)
    .where(and(eq(aiNarrativeResponsesTable.orgId, orgId), eq(aiNarrativeResponsesTable.runId, latest.id)))
    .orderBy(desc(aiNarrativeResponsesTable.createdAt));

  const prevResponses = prev
    ? await db
        .select({
          entity: aiNarrativeResponsesTable.entity,
          provider: aiNarrativeResponsesTable.provider,
          sentiment: aiNarrativeResponsesTable.sentimentScore,
        })
        .from(aiNarrativeResponsesTable)
        .where(and(eq(aiNarrativeResponsesTable.orgId, orgId), eq(aiNarrativeResponsesTable.runId, prev.id)))
    : [];

  const prevSentiment = new Map<string, { sum: number; n: number }>();
  for (const r of prevResponses) {
    if (r.sentiment == null) continue;
    const key = `${r.entity}::${r.provider}`;
    const e = prevSentiment.get(key) ?? { sum: 0, n: 0 };
    e.sum += r.sentiment;
    e.n++;
    prevSentiment.set(key, e);
  }

  const promptTypes = await db
    .select({ entity: aiNarrativePromptsTable.entity, entityType: aiNarrativePromptsTable.entityType })
    .from(aiNarrativePromptsTable)
    .where(eq(aiNarrativePromptsTable.orgId, orgId));
  const typeByEntity = new Map(promptTypes.map((p) => [p.entity, p.entityType]));

  const byEntity = new Map<string, EntityNarrative>();
  for (const r of latestResponses) {
    let e = byEntity.get(r.entity);
    if (!e) {
      e = { entity: r.entity, entityType: typeByEntity.get(r.entity) ?? "brand", providers: [], avgSentiment: null, avgDelta: null };
      byEntity.set(r.entity, e);
    }
    // Keep only the first (latest) response per provider per entity for the overview
    if (e.providers.some((p) => p.provider === r.provider)) continue;

    const prevKey = prevSentiment.get(`${r.entity}::${r.provider}`);
    const prevAvg = prevKey && prevKey.n > 0 ? prevKey.sum / prevKey.n : null;
    e.providers.push({
      provider: r.provider,
      sentiment: r.sentimentScore,
      delta:
        r.sentimentScore != null && prevAvg != null
          ? Math.round((r.sentimentScore - prevAvg) * 100) / 100
          : null,
      quoteSnippets: (r.quoteSnippets as string[]) ?? [],
      notableClaims: (r.notableClaims as string[]) ?? [],
      groundingSources: (r.groundingSources as { uri: string; title: string }[]) ?? [],
      model: r.model,
      answeredAt: r.createdAt.toISOString(),
    });
  }

  for (const e of byEntity.values()) {
    const sentiments = e.providers.map((p) => p.sentiment).filter((s): s is number => s != null);
    const deltas = e.providers.map((p) => p.delta).filter((d): d is number => d != null);
    e.avgSentiment = sentiments.length
      ? Math.round((sentiments.reduce((a, b) => a + b, 0) / sentiments.length) * 100) / 100
      : null;
    e.avgDelta = deltas.length
      ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100
      : null;
  }

  return {
    lastRun: {
      id: latest.id,
      status: latest.status,
      startedAt: latest.startedAt.toISOString(),
      completedAt: latest.completedAt?.toISOString() ?? null,
      trigger: latest.trigger,
    },
    entities: [...byEntity.values()].sort((a, b) =>
      a.entityType === b.entityType ? a.entity.localeCompare(b.entity) : a.entityType === "brand" ? -1 : 1,
    ),
  };
}

export interface TimelinePoint {
  runId: string;
  at: string;
  provider: string;
  sentiment: number;
}

export async function getNarrativeTimeline(
  orgId: string,
  entity: string,
  days = 30,
): Promise<TimelinePoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      runId: aiNarrativeResponsesTable.runId,
      createdAt: aiNarrativeResponsesTable.createdAt,
      provider: aiNarrativeResponsesTable.provider,
      sentiment: aiNarrativeResponsesTable.sentimentScore,
    })
    .from(aiNarrativeResponsesTable)
    .where(
      and(
        eq(aiNarrativeResponsesTable.orgId, orgId),
        eq(aiNarrativeResponsesTable.entity, entity),
        gte(aiNarrativeResponsesTable.createdAt, since),
      ),
    )
    .orderBy(aiNarrativeResponsesTable.createdAt);

  // Average multiple prompts per (run, provider) into one point.
  const byKey = new Map<string, { runId: string; at: Date; provider: string; sum: number; n: number }>();
  for (const r of rows) {
    if (r.sentiment == null) continue;
    const key = `${r.runId}::${r.provider}`;
    const e = byKey.get(key) ?? { runId: r.runId, at: r.createdAt, provider: r.provider, sum: 0, n: 0 };
    e.sum += r.sentiment;
    e.n++;
    byKey.set(key, e);
  }

  return [...byKey.values()]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((e) => ({
      runId: e.runId,
      at: e.at.toISOString(),
      provider: e.provider,
      sentiment: Math.round((e.sum / e.n) * 100) / 100,
    }));
}

// ─── Scheduling helpers (used by the worker) ──────────────────────────────────

/**
 * Find orgs due for a scheduled narrative run: active pro/enterprise
 * subscription, org not paused, and no run within the tier's cadence window.
 */
export async function findDueOrgs(): Promise<{ orgId: string; tier: Tier }[]> {
  const subs = await db
    .select({ orgId: subscriptionsTable.orgId, tier: subscriptionsTable.tier })
    .from(subscriptionsTable)
    .innerJoin(organizationsTable, eq(subscriptionsTable.orgId, organizationsTable.id))
    .where(
      and(
        eq(subscriptionsTable.status, "active"),
        inArray(subscriptionsTable.tier, ["pro", "enterprise"]),
        isNull(organizationsTable.pausedAt),
      ),
    );

  // Highest tier wins when an org somehow has multiple active subscriptions.
  const tierByOrg = new Map<string, Tier>();
  for (const s of subs) {
    const t = s.tier as Tier;
    const existing = tierByOrg.get(s.orgId);
    if (!existing || (existing === "pro" && t === "enterprise")) tierByOrg.set(s.orgId, t);
  }
  if (!tierByOrg.size) return [];

  const due: { orgId: string; tier: Tier }[] = [];
  for (const [orgId, tier] of tierByOrg) {
    const cadence = AI_NARRATIVE_CADENCE_MS[tier];
    if (!cadence) continue;
    const [lastRun] = await db
      .select({ startedAt: aiNarrativeRunsTable.startedAt })
      .from(aiNarrativeRunsTable)
      .where(eq(aiNarrativeRunsTable.orgId, orgId))
      .orderBy(desc(aiNarrativeRunsTable.startedAt))
      .limit(1);
    if (!lastRun || Date.now() - lastRun.startedAt.getTime() >= cadence) {
      due.push({ orgId, tier });
    }
  }
  return due;
}
