import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";
import { chat } from "./llm";
import { getRedis } from "./redis";
import { logger } from "./logger";

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

export interface TalkingPointsResult {
  keyword: string;
  keyFacts: string[];
  recommendedPosition: string;
  phrasesToAvoid: string[];
  suggestedQuotes: string[];
  contextItemCount: number;
  cachedAt?: string;
  generatedAt: string;
}

/**
 * Generate structured talking points for a keyword.
 *
 * Flow:
 *   1. Try Redis cache (key: tp:{orgId}:{keyword})
 *   2. Fetch top 30 content items by recency + engagement
 *   3. Construct GPT-4o prompt with full context
 *   4. Parse structured JSON response
 *   5. Cache result for 30 min
 */
export async function generateTalkingPoints(
  orgId: string,
  keyword: string,
  contextOverride?: string,
): Promise<TalkingPointsResult> {
  const cacheKey = `tp:${orgId}:${keyword.toLowerCase().slice(0, 100)}`;

  // ── Cache check ─────────────────────────────────────────────────────────────
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as TalkingPointsResult;
      return { ...parsed, cachedAt: parsed.generatedAt };
    }
  } catch {
    // Redis unavailable — proceed without cache
  }

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const pattern = `%${keyword.replace(/[%_]/g, "\\$&")}%`;

  // ── Fetch top items by recency + engagement ──────────────────────────────────
  // Pull 60 recent items, then re-rank by composite score (engagement + recency)
  const rawItems = await db
    .select({
      title: contentItemsTable.title,
      body: contentItemsTable.body,
      platform: contentItemsTable.platform,
      sentimentScore: contentItemsTable.sentimentScore,
      engagementMetrics: contentItemsTable.engagementMetrics,
      publishedAt: contentItemsTable.publishedAt,
      author: contentItemsTable.author,
      sourceUrl: contentItemsTable.sourceUrl,
      collectedAt: contentItemsTable.collectedAt,
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    )
    .orderBy(
      desc(
        sql`coalesce((${contentItemsTable.engagementMetrics}->>'likes')::numeric, 0) +
            coalesce((${contentItemsTable.engagementMetrics}->>'shares')::numeric, 0) +
            coalesce((${contentItemsTable.engagementMetrics}->>'comments')::numeric, 0)`,
      ),
      desc(contentItemsTable.publishedAt),
    )
    .limit(60);

  // Re-rank by composite score: engagement (60%) + recency (40%)
  const nowMs = Date.now();
  const maxAgeMs = 48 * 60 * 60 * 1000;
  const scoredItems = rawItems
    .map((item) => {
      const eng = (item.engagementMetrics as Record<string, number> | null) ?? {};
      const engScore = ((eng.likes ?? 0) + (eng.shares ?? 0) * 2 + (eng.comments ?? 0)) / 1000;
      const ageMs = nowMs - (item.publishedAt?.getTime() ?? item.collectedAt?.getTime() ?? nowMs);
      const recencyScore = Math.max(0, 1 - ageMs / maxAgeMs);
      return { ...item, _score: engScore * 0.6 + recencyScore * 0.4 };
    })
    .sort((a, b) => b._score - a._score);

  const items = scoredItems.slice(0, 30);

  const contextSnippets = items
    .slice(0, 20)
    .map((item, i) => {
      const engagement = (item.engagementMetrics as Record<string, number> | null) ?? {};
      const totalEng = (engagement.likes ?? 0) + (engagement.shares ?? 0) + (engagement.comments ?? 0);
      const sentiment = item.sentimentScore != null ? ` [sentiment: ${Number(item.sentimentScore).toFixed(2)}]` : "";
      return `[${i + 1}] ${item.title ?? "(no title)"}${sentiment} — ${item.platform ?? "unknown"} (engagement: ${totalEng})\n${(item.body ?? "").slice(0, 300)}`;
    })
    .join("\n\n---\n\n");

  const userContent = contextOverride
    ? `Keyword: "${keyword}"\n\nAdditional context provided:\n${contextOverride}\n\nRecent coverage (${items.length} items):\n${contextSnippets}`
    : `Keyword: "${keyword}"\n\nRecent coverage (${items.length} items):\n${contextSnippets || "No recent coverage found — generate talking points based on the keyword alone."}`;

  const systemPrompt = `You are a strategic communications expert for political campaigns, corporate communications, and advocacy organisations.

Based on the recent media coverage provided, generate structured talking points. Return ONLY a JSON object — no markdown, no explanation.

Format:
{
  "keyFacts": ["fact 1", "fact 2", "fact 3", "fact 4", "fact 5"],
  "recommendedPosition": "One clear paragraph (2-4 sentences) stating the recommended public stance.",
  "phrasesToAvoid": ["phrase 1", "phrase 2", "phrase 3"],
  "suggestedQuotes": [
    "Quote option 1 (punchy, suitable for press conference)",
    "Quote option 2 (empathetic, community-focused)",
    "Quote option 3 (assertive, action-oriented)"
  ]
}

Rules:
- keyFacts: 5 bullet points, evidence-based, drawn from the coverage
- recommendedPosition: clear, defensible, avoids trigger words
- phrasesToAvoid: language that is inflammatory, legally risky, or appears defensive
- suggestedQuotes: 60-120 words each, quotable, emotionally resonant`;

  const result = await chat(
    "openai",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    { operation: "talking-points", model: "gpt-4o" },
  );

  const cleaned = result.content
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();

  const parsed = JSON.parse(cleaned) as {
    keyFacts: string[];
    recommendedPosition: string;
    phrasesToAvoid: string[];
    suggestedQuotes: string[];
  };

  const output: TalkingPointsResult = {
    keyword,
    keyFacts: parsed.keyFacts ?? [],
    recommendedPosition: parsed.recommendedPosition ?? "",
    phrasesToAvoid: parsed.phrasesToAvoid ?? [],
    suggestedQuotes: parsed.suggestedQuotes ?? [],
    contextItemCount: items.length,
    generatedAt: new Date().toISOString(),
  };

  // ── Cache result ─────────────────────────────────────────────────────────────
  try {
    await getRedis().set(cacheKey, JSON.stringify(output), "EX", CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, "Failed to cache talking points");
  }

  return output;
}
