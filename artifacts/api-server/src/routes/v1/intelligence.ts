import { Router } from "express";
import { db } from "@workspace/db";
import { analysisReportsTable, contentItemsTable, influencerScoresTable } from "@workspace/db/schema";
import { eq, and, gte, desc, sql, count, sum } from "drizzle-orm";
import { chat, type LlmProvider, type LlmMessage } from "../../lib/llm";
import { semanticSearch } from "../../lib/analysis/embeddings";
import { requireAuth, requireRole } from "../../middlewares/clerkAuth";
import { requireTier } from "../../middlewares/featureGate";
import { computeOrganicConfidence } from "../../lib/botDetection";
import { checkDisinformationForKeyword } from "../../lib/disinformation";
import { getQueues } from "../../lib/queues";
import { logger } from "../../lib/logger";

const router = Router();
router.use(requireAuth);

router.post("/chat", async (req, res) => {
  const { provider = "openai", messages, model } = req.body as {
    provider?: LlmProvider;
    messages: LlmMessage[];
    model?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages must be a non-empty array" });
    return;
  }

  try {
    const result = await chat(provider, messages, { model, operation: "intelligence/chat" });
    res.json({
      provider: result.provider,
      model: result.model,
      content: result.content,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.promptTokens + result.completionTokens,
      },
      durationMs: result.durationMs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "LLM request failed";
    res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

router.post("/talking-points", async (req, res) => {
  const { topic, provider = "openai", context } = req.body as {
    topic: string; provider?: LlmProvider; context?: string;
  };
  if (!topic) { res.status(400).json({ error: "topic is required" }); return; }

  const systemPrompt = `You are a strategic communications expert for political campaigns and advocacy organisations.
Generate 5-7 concise, compelling talking points on the given topic. Format as a numbered list.
Each point should be punchy, evidence-based, and emotionally resonant.`;

  try {
    const result = await chat(
      provider,
      [{ role: "system", content: systemPrompt }, { role: "user", content: `Topic: ${topic}${context ? `\n\nContext: ${context}` : ""}` }],
      { operation: "talking-points" }
    );
    res.json({ topic, talkingPoints: result.content, provider: result.provider, model: result.model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate talking points";
    res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

router.post("/draft-statement", async (req, res) => {
  const { topic, tone = "professional", audience, provider = "openai" } = req.body as {
    topic: string; tone?: string; audience?: string; provider?: LlmProvider;
  };
  if (!topic) { res.status(400).json({ error: "topic is required" }); return; }

  const systemPrompt = `You are a speechwriter and communications strategist. Draft a concise,
impactful public statement on the given topic. Tone: ${tone}. ${audience ? `Target audience: ${audience}.` : ""}
The statement should be 2-3 paragraphs, clear, and suitable for press release format.`;

  try {
    const result = await chat(
      provider,
      [{ role: "system", content: systemPrompt }, { role: "user", content: `Draft a statement on: ${topic}` }],
      { operation: "draft-statement" }
    );
    res.json({ topic, statement: result.content, provider: result.provider, model: result.model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to draft statement";
    res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

router.post("/search", async (req, res) => {
  const { query, category, limit = 20, minSimilarity = 0.3 } = req.body as {
    query: string; category?: string; limit?: number; minSimilarity?: number;
  };

  if (!query || typeof query !== "string") {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    const results = await semanticSearch(query, req.thea!.org.id, { category, limit, minSimilarity });
    res.json({ query, results, count: results.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Semantic search failed";
    res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

// ─── GET /api/v1/intelligence/organic-confidence ─────────────────────────────
router.get("/organic-confidence", async (req, res) => {
  const { topic, timeframe = "6h" } = req.query as Record<string, string | undefined>;

  if (!topic) {
    res.status(400).json({ error: "topic is required" });
    return;
  }

  const hoursMap: Record<string, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };
  const hours = hoursMap[timeframe] ?? 6;

  const result = await computeOrganicConfidence(req.thea!.org.id, topic, hours);
  res.json({ topic, timeframe, ...result });
});

// ─── GET /api/v1/intelligence/influencers ─────────────────────────────────────
router.get("/influencers", async (req, res) => {
  const { topic, timeframe = "24h", limit: limitStr = "20" } = req.query as Record<string, string | undefined>;

  if (!topic) {
    res.status(400).json({ error: "topic is required" });
    return;
  }

  const hoursMap: Record<string, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };
  const hours = hoursMap[timeframe] ?? 24;
  const limit = Math.min(50, Math.max(1, parseInt(limitStr ?? "20", 10) || 20));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const pattern = `%${topic.replace(/[%_]/g, "\\$&")}%`;
  const orgId = req.thea!.org.id;

  const rows = await db
    .select({
      platform: contentItemsTable.platform,
      author: contentItemsTable.author,
      mentionCount: count(),
      totalEngagement: sql<number>`
        coalesce(sum((${contentItemsTable.engagementMetrics}->>'likes')::numeric), 0) +
        coalesce(sum((${contentItemsTable.engagementMetrics}->>'shares')::numeric), 0) +
        coalesce(sum((${contentItemsTable.engagementMetrics}->>'comments')::numeric), 0)
      `,
      avgBotRisk: sql<number>`coalesce(avg(${contentItemsTable.botRiskScore}), 0)`,
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        sql`${contentItemsTable.author} IS NOT NULL`,
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    )
    .groupBy(contentItemsTable.platform, contentItemsTable.author)
    .orderBy(desc(sql`count(*)`))
    .limit(limit * 3); // over-fetch so we can compute reach score and re-rank

  // Spec formula: log(mentions) × engagement_rate
  // follower counts are not available in content_items; we use mention count as a
  // reach proxy: engagementRate = totalEngagement / max(mentions, 1)
  const influencers = rows
    .filter((r) => r.author)
    .map((r) => {
      const mentions = Number(r.mentionCount);
      const engagement = Number(r.totalEngagement);
      const botRisk = Number(r.avgBotRisk);
      const engagementRate = mentions > 0 ? engagement / mentions : 0;
      const reachScore = Math.log10(mentions + 1) * (engagementRate + 1);
      const isBotFlagged = botRisk > 0.7 ? "true" : "false";

      return {
        platform: r.platform,
        accountHandle: r.author!,
        mentionCount: mentions,
        totalEngagement: Math.round(engagement),
        avgEngagementRate: Math.round(engagementRate * 100) / 100,
        reachScore: Math.round(reachScore * 100) / 100,
        botRisk: Math.round(botRisk * 100) / 100,
        isBotFlagged,
      };
    })
    .sort((a, b) => b.reachScore - a.reachScore)
    .slice(0, limit);

  // Persist influencer scores to influencer_scores table (fire-and-forget)
  // Records are upserted by (orgId, topic, platform, accountHandle) at score time
  const scoredAt = new Date();
  db.insert(influencerScoresTable)
    .values(
      influencers.map((inf) => ({
        orgId,
        topic: topic!,
        platform: inf.platform ?? "unknown",
        accountHandle: inf.accountHandle,
        avgEngagementRate: inf.avgEngagementRate,
        reachScore: inf.reachScore,
        botRisk: inf.botRisk,
        isBotFlagged: inf.isBotFlagged,
        mentionCount: inf.mentionCount,
        scoredAt,
      })),
    )
    .catch((err) => logger.warn({ err, orgId, topic }, "Failed to persist influencer scores"));

  res.json({ topic, timeframe, count: influencers.length, data: influencers });
});

// ─── POST /api/v1/intelligence/check-disinformation ──────────────────────────
router.post(
  "/check-disinformation",
  requireRole("owner", "admin"),
  async (req, res) => {
    const { keyword } = req.body as { keyword: string };
    if (!keyword) {
      res.status(400).json({ error: "keyword is required" });
      return;
    }

    try {
      const results = await checkDisinformationForKeyword(req.thea!.org.id, keyword);
      res.json({ keyword, checked: results.length, results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Disinformation check failed";
      res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
    }
  },
);

// ─── POST /api/v1/intelligence/simulate ──────────────────────────────────────
/**
 * "What If" MiroFish Simulator — Pro/Enterprise only.
 *
 * Accepts a hypothetical scenario, queues a dedicated MiroFish analysis run
 * with the scenario injected as context, and returns a simulation ID for polling.
 *
 * POST body: { scenario_text, category, geography?, provider? }
 * GET  /simulate/:id — poll simulation status and results
 */
router.post(
  "/simulate",
  requireTier("pro"),
  async (req, res) => {
    const { scenario_text, category, geography, provider = "openai" } = req.body as {
      scenario_text: string;
      category: string;
      geography?: string;
      provider?: LlmProvider;
    };

    if (!scenario_text || !category) {
      res.status(400).json({ error: "scenario_text and category are required" });
      return;
    }

    const orgId = req.thea!.org.id;

    // Create a pending analysis report for this simulation
    const [report] = await db
      .insert(analysisReportsTable)
      .values({
        orgId,
        category,
        status: "pending",
        rawReport: JSON.stringify({ scenario_text, geography, type: "simulate" }),
      })
      .returning({ id: analysisReportsTable.id });

    logger.info({ orgId, category, geography, reportId: report!.id }, "What-If simulation queued");

    // Queue the simulation job
    await getQueues().miroFishRuns.add(
      "simulate",
      {
        category,
        triggeredBy: "simulate" as const,
        scenario: scenario_text,
        geography,
        orgId,
        reportId: report!.id,
        provider,
      },
      { priority: 2, attempts: 2 },
    );

    res.status(202).json({
      simulationId: report!.id,
      status: "queued",
      message: "Simulation queued. Poll /simulate/:id for results (typically 5-30 min).",
      pollUrl: `/api/v1/intelligence/simulate/${report!.id}`,
    });
  },
);

// ─── GET /api/v1/intelligence/simulate/:id ────────────────────────────────────
router.get("/simulate/:id", async (req, res) => {
  const [report] = await db
    .select()
    .from(analysisReportsTable)
    .where(
      and(
        eq(analysisReportsTable.id, req.params.id),
        eq(analysisReportsTable.orgId, req.thea!.org.id),
      ),
    )
    .limit(1);

  if (!report) {
    res.status(404).json({ error: "Simulation not found" });
    return;
  }

  const isPending = report.status === "pending" || report.status === "running";
  const scenarioMeta = (() => {
    try { return JSON.parse(report.rawReport ?? "{}"); } catch { return {}; }
  })();

  res.json({
    simulationId: report.id,
    status: report.status,
    category: report.category,
    scenario: scenarioMeta.scenario_text ?? null,
    geography: scenarioMeta.geography ?? null,
    createdAt: report.createdAt,
    completedAt: report.completedAt ?? null,
    ...(isPending
      ? { message: "Simulation still running — check back in a few minutes." }
      : {
          trendingTopics: report.trendingTopics,
          narrativeSummary: report.narrativeSummary,
          sentimentOverall: report.sentimentOverall,
          predictions: report.predictions,
          dominantNarratives: report.dominantNarratives,
          keyEntities: report.keyEntities,
        }),
  });
});

export default router;
