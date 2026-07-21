import { db } from "@workspace/db";
import { alertsTable, crisisScoresTable, trendScoresTable } from "@workspace/db/schema";
import { and, desc, gte } from "drizzle-orm";
import { semanticSearch } from "./analysis/embeddings";
import { tenantEq, tenantOr } from "./tenantScope";
import { logger } from "./logger";

/**
 * Ask THEA — org-scoped retrieval for the AI analyst chat.
 *
 * Combines pgvector semantic search over collected content with structured
 * lookups (recent alerts, crisis scores, trend scores) so both "what is being
 * said about X" and "what happened this week" questions can be grounded.
 *
 * Tenancy: content + trends use the tenantOr convention (platform collection
 * pool is shared with every tenant); alerts and crisis scores are strictly
 * per-org.
 */

export interface AskTheaCitation {
  marker: string; // "S1", "S2", ...
  type: "content" | "alert" | "crisis" | "trend";
  id: string;
  title: string;
  url: string | null; // external source URL for content; null for structured records
  platform: string | null;
  date: string | null; // ISO date of the underlying record
  similarity: number | null;
}

export interface RetrievedContext {
  contextBlock: string;
  citations: AskTheaCitation[];
  hasData: boolean;
}

const CONTENT_LIMIT = 12;
const MIN_SIMILARITY = 0.25;
const STRUCTURED_LIMIT = 8;
const STRUCTURED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function fmtDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export async function retrieveContext(orgId: string, question: string): Promise<RetrievedContext> {
  if (!orgId) throw new Error("retrieveContext: orgId is required for tenant isolation");

  const since = new Date(Date.now() - STRUCTURED_WINDOW_MS);

  const [contentResults, alertRows, crisisRows, trendRows] = await Promise.all([
    semanticSearch(question, orgId, {
      limit: CONTENT_LIMIT,
      minSimilarity: MIN_SIMILARITY,
      includePlatform: true,
    }).catch((err) => {
      // Retrieval must not hard-fail the chat if embeddings are unavailable —
      // structured context can still ground time-based questions.
      logger.warn({ err, orgId }, "Ask THEA: semantic search failed — continuing with structured context only");
      return [];
    }),
    db
      .select()
      .from(alertsTable)
      .where(and(tenantEq(alertsTable.orgId, orgId), gte(alertsTable.createdAt, since)))
      .orderBy(desc(alertsTable.createdAt))
      .limit(STRUCTURED_LIMIT * 2),
    db
      .select()
      .from(crisisScoresTable)
      .where(and(tenantEq(crisisScoresTable.orgId, orgId), gte(crisisScoresTable.scoredAt, since)))
      .orderBy(desc(crisisScoresTable.scoredAt))
      .limit(40),
    db
      .select()
      .from(trendScoresTable)
      .where(and(tenantOr(trendScoresTable.orgId, orgId), gte(trendScoresTable.scoredAt, since)))
      .orderBy(desc(trendScoresTable.scoredAt))
      .limit(120),
  ]);

  const alerts = alertRows.slice(0, STRUCTURED_LIMIT);

  // Latest crisis score per keyword
  const crisisByKeyword = new Map<string, (typeof crisisRows)[number]>();
  for (const row of crisisRows) {
    if (!crisisByKeyword.has(row.keyword)) crisisByKeyword.set(row.keyword, row);
  }
  const crisis = [...crisisByKeyword.values()].slice(0, STRUCTURED_LIMIT);

  // Latest score per topic, ranked by score
  const trendByTopic = new Map<string, (typeof trendRows)[number]>();
  for (const row of trendRows) {
    if (!trendByTopic.has(row.topic)) trendByTopic.set(row.topic, row);
  }
  const trends = [...trendByTopic.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, STRUCTURED_LIMIT);

  const citations: AskTheaCitation[] = [];
  const lines: string[] = [];
  let n = 0;

  if (contentResults.length) {
    lines.push("## Collected content (most relevant to the question)");
    for (const item of contentResults) {
      n += 1;
      const marker = `S${n}`;
      citations.push({
        marker,
        type: "content",
        id: item.id,
        title: item.title || item.summary?.slice(0, 80) || "Untitled item",
        url: item.sourceUrl,
        platform: item.platform,
        date: fmtDate(item.publishedAt),
        similarity: Math.round(item.similarity * 100) / 100,
      });
      const desc = item.summary || item.title || "";
      lines.push(
        `[${marker}] (${item.platform}${item.publishedAt ? `, ${fmtDate(item.publishedAt)}` : ""}${item.category ? `, category: ${item.category}` : ""}) ${item.title ?? ""}${desc && desc !== item.title ? ` — ${desc}` : ""}`.trim()
      );
    }
    lines.push("");
  }

  if (alerts.length) {
    lines.push("## Recent alerts (last 7 days, this organisation)");
    for (const a of alerts) {
      n += 1;
      const marker = `S${n}`;
      citations.push({
        marker,
        type: "alert",
        id: a.id,
        title: `${a.severity.toUpperCase()} ${a.type} alert: ${a.keyword}`,
        url: null,
        platform: null,
        date: fmtDate(a.createdAt),
        similarity: null,
      });
      const details: string[] = [];
      if (a.spikeRatio != null) details.push(`spike ratio ${a.spikeRatio.toFixed(1)}x`);
      if (a.sentimentShift != null) details.push(`sentiment shift ${a.sentimentShift.toFixed(2)}`);
      if (a.crisisProbability != null) details.push(`crisis probability ${(a.crisisProbability * 100).toFixed(0)}%`);
      lines.push(
        `[${marker}] ${fmtDate(a.createdAt)} — ${a.severity} ${a.type} alert for keyword "${a.keyword}" (status: ${a.status}${details.length ? `; ${details.join(", ")}` : ""})`
      );
    }
    lines.push("");
  }

  if (crisis.length) {
    lines.push("## Latest crisis scores (0-100, this organisation)");
    for (const c of crisis) {
      n += 1;
      const marker = `S${n}`;
      citations.push({
        marker,
        type: "crisis",
        id: c.id,
        title: `Crisis score ${Math.round(c.score)} — ${c.keyword}`,
        url: null,
        platform: null,
        date: fmtDate(c.scoredAt),
        similarity: null,
      });
      lines.push(
        `[${marker}] ${fmtDate(c.scoredAt)} — "${c.keyword}": crisis score ${Math.round(c.score)}/100 (velocity ${Math.round(c.velocityScore)}, sentiment ${Math.round(c.sentimentScore)}, bots ${Math.round(c.botScore)}, media pickup ${Math.round(c.mediaPickupScore)}; volume ${Math.round(c.volumeCurrent)} vs baseline ${Math.round(c.volumeBaseline)})`
      );
    }
    lines.push("");
  }

  if (trends.length) {
    lines.push("## Top trending topics (last 7 days)");
    for (const t of trends) {
      n += 1;
      const marker = `S${n}`;
      citations.push({
        marker,
        type: "trend",
        id: t.id,
        title: `Trend: ${t.topic} (score ${Math.round(t.score)})`,
        url: null,
        platform: null,
        date: fmtDate(t.scoredAt),
        similarity: null,
      });
      lines.push(
        `[${marker}] ${fmtDate(t.scoredAt)} — topic "${t.topic}" (${t.category}): trend score ${Math.round(t.score)}, ${t.mentionCount ?? 0} mentions, lifecycle ${t.lifecycleStage ?? "unknown"}${t.sentimentAvg != null ? `, avg sentiment ${t.sentimentAvg.toFixed(2)}` : ""}`
      );
    }
    lines.push("");
  }

  return {
    contextBlock: lines.join("\n"),
    citations,
    hasData: citations.length > 0,
  };
}

export function buildSystemPrompt(orgName: string, context: RetrievedContext): string {
  return `You are THEA, an intelligence analyst for the organisation "${orgName}". You answer questions using ONLY the collected intelligence provided below — never outside knowledge, guesses, or fabricated facts.

Rules:
1. Ground every claim in the provided context and cite sources inline using their markers, e.g. [S1] or [S2][S5]. Only use markers that exist below (S1 through S${context.citations.length}).
2. If the provided context does not contain enough information to answer, say so plainly and suggest what data the user could collect (e.g. adding watchlist keywords). Do NOT invent an answer.
3. Be concise and analytical: lead with the direct answer, then supporting evidence. Use short paragraphs or bullet points.
4. Numbers, dates and quotes must come verbatim from the context.
5. Today's date is ${new Date().toISOString().slice(0, 10)}.

Collected intelligence context:

${context.contextBlock}`;
}

/** Canned reply when retrieval finds nothing relevant — no LLM call is made. */
export const NO_DATA_REPLY =
  "I couldn't find any collected intelligence relevant to that question — no matching content, alerts, crisis scores or trends in your workspace right now. " +
  "Try adding watchlist keywords for the topics you care about (Watchlist page) so THEA starts collecting and analysing coverage, or ask about a topic that's already being monitored.";
