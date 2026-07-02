import { Router } from "express";
import JSZip from "jszip";
import { db } from "@workspace/db";
import { analysisReportsTable, contentItemsTable, influencerScoresTable } from "@workspace/db/schema";
import { eq, and, gte, desc, sql, count, sum } from "drizzle-orm";
import { chat, type LlmProvider, type LlmMessage } from "../../lib/llm";
import { semanticSearch } from "../../lib/analysis/embeddings";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireTier } from "../../middlewares/featureGate";
import { computeOrganicConfidence } from "../../lib/botDetection";
import { checkDisinformationForKeyword } from "../../lib/disinformation";
import { getQueues } from "../../lib/queues";
import { logger } from "../../lib/logger";
import { generateTalkingPoints } from "../../lib/talkingPoints";
import { generateCounterNarrative } from "../../lib/counterNarrative";
import { draftStatement, regenerateStatement, type StatementTone, type StatementType } from "../../lib/statementDrafter";

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

// ─── POST /api/v1/intelligence/talking-points ─────────────────────────────────
/**
 * Generate structured talking points for a keyword using AI + recent content context.
 *
 * Returns: keyFacts, recommendedPosition, phrasesToAvoid, suggestedQuotes.
 * Results are cached in Redis for 30 minutes per org+keyword.
 */
router.post("/talking-points", async (req, res) => {
  const { keyword, topic, context_override } = req.body as {
    keyword?: string;
    topic?: string;
    context_override?: string;
  };
  const kw = keyword ?? topic;
  if (!kw) { res.status(400).json({ error: "keyword is required" }); return; }

  try {
    const result = await generateTalkingPoints(req.thea!.org.id, kw, context_override);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate talking points";
    res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

// ─── POST /api/v1/intelligence/draft-statement ────────────────────────────────
/**
 * Draft a press release, social post, or internal memo using AI + recent alert/content context.
 *
 * Pass draftId + feedback to regenerate an existing draft with revisions.
 */
router.post("/draft-statement", async (req, res) => {
  const {
    keyword,
    topic,
    tone = "formal",
    type = "press_release",
    alert_id,
    draftId,
    feedback,
  } = req.body as {
    keyword?: string;
    topic?: string;
    tone?: StatementTone;
    type?: StatementType;
    alert_id?: string;
    draftId?: string;
    feedback?: string;
  };

  const orgId = req.thea!.org.id;

  try {
    // Regeneration path
    if (draftId && feedback) {
      const result = await regenerateStatement(orgId, draftId, feedback);
      res.json(result);
      return;
    }

    const kw = keyword ?? topic;
    // Allow alert_id alone (no keyword) — draftStatement resolves keyword from the alert
    if (!kw && !alert_id) { res.status(400).json({ error: "keyword or alert_id is required" }); return; }

    const validTones: StatementTone[] = ["formal", "empathetic", "assertive"];
    const validTypes: StatementType[] = ["press_release", "social_post", "internal_memo"];
    if (!validTones.includes(tone)) { res.status(400).json({ error: `tone must be one of: ${validTones.join(", ")}` }); return; }
    if (!validTypes.includes(type)) { res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` }); return; }

    const result = await draftStatement(orgId, kw, tone, type, alert_id, feedback);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to draft statement";
    res.status(msg.includes("not found") ? 404 : msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

// ─── GET /api/v1/intelligence/draft-statement/:draftId/download ───────────────
/**
 * Download a previously generated draft as plain text or DOCX.
 *
 * GET /api/v1/intelligence/draft-statement/:draftId/download?format=txt (default)
 * GET /api/v1/intelligence/draft-statement/:draftId/download?format=docx
 */
router.get("/draft-statement/:draftId/download", async (req, res) => {
  const { draftId } = req.params as { draftId: string };
  const format = (req.query.format as string ?? "txt").toLowerCase();

  const [report] = await db
    .select()
    .from(analysisReportsTable)
    .where(and(eq(analysisReportsTable.id, draftId), eq(analysisReportsTable.orgId, req.thea!.org.id)));

  if (!report) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  const data = JSON.parse(report.rawReport ?? "{}") as { draft?: string; keyword?: string; type?: string };
  const draft = data.draft ?? "";
  const safeFilename = `statement-${(data.keyword ?? "draft").replace(/[^a-z0-9]/gi, "-").slice(0, 40)}-${draftId.slice(0, 8)}`;

  if (format === "docx") {
    // Build a valid OPC ZIP package (.docx) with required parts
    const xmlEsc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] ?? c));
    const paragraphs = draft
      .split(/\n/)
      .map((line) => `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r></w:p>`)
      .join("");

    const zip = new JSZip();

    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs}<w:sectPr/></w:body></w:document>`);

    zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.docx"`);
    res.send(buf);
    return;
  }

  // Default: plain text
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.txt"`);
  res.send(draft);
});

// ─── POST /api/v1/intelligence/counter-narrative ──────────────────────────────
/**
 * Counter-narrative engine.
 * Triggered by crisis alerts or on-demand.
 * Returns 3-5 reframing strategies ranked by predicted effectiveness.
 */
router.post("/counter-narrative", async (req, res) => {
  const { keyword, alert_id } = req.body as { keyword: string; alert_id?: string };

  if (!keyword) { res.status(400).json({ error: "keyword is required" }); return; }

  try {
    const result = await generateCounterNarrative(req.thea!.org.id, keyword, alert_id);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Counter-narrative generation failed";
    res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

// ─── POST /api/v1/intelligence/test-message ───────────────────────────────────
/**
 * Message resonance testing (Enterprise only).
 *
 * For each variant message, queues a dedicated MiroFish simulation to predict
 * how it will land with the target audience. Returns simulationIds for polling.
 */
router.post("/test-message", requireTier("enterprise"), async (req, res) => {
  const { messages, variants: legacyVariants, category, geography } = req.body as {
    messages?: string[];
    variants?: Array<{ label: string; message: string }>;
    category: string;
    geography?: string;
  };

  if (!category) { res.status(400).json({ error: "category is required" }); return; }

  // Normalise both input shapes into a unified variants array
  let variants: Array<{ label: string; message: string }>;
  if (Array.isArray(messages) && messages.length > 0) {
    variants = messages.map((msg, i) => ({ label: `Message ${i + 1}`, message: String(msg) }));
  } else if (Array.isArray(legacyVariants) && legacyVariants.length > 0) {
    variants = legacyVariants;
  } else {
    res.status(400).json({ error: "messages (string[]) or variants ([{ label, message }]) is required" });
    return;
  }

  if (variants.length < 2 || variants.length > 5) {
    res.status(400).json({ error: "Between 2 and 5 message variants are required" });
    return;
  }

  const orgId = req.thea!.org.id;

  // ── Synchronous LLM-powered side-by-side resonance comparison ──────────────
  const variantBlock = variants
    .map((v, i) => `VARIANT ${i + 1} — "${v.label}":\n${v.message}`)
    .join("\n\n");

  const geoContext = geography ? ` The target geography is ${geography}.` : "";

  const systemPrompt = `You are an expert communications strategist and audience research analyst.
Your role is to evaluate message variants for their predicted resonance with a target audience.
You always return ONLY valid JSON with no markdown, no code fences, no prose outside the JSON object.`;

  const userPrompt = `Evaluate the following ${variants.length} message variants for the category "${category}".${geoContext}

For EACH variant, predict:
- sentimentScore: audience sentiment (−1.0 = very negative, 0 = neutral, 1.0 = very positive)
- reachScore: estimated organic reach amplification (0.0 = low, 1.0 = viral)
- supporterPercent: estimated % of audience who will react positively (0-100)
- detractorPercent: estimated % of audience who will react negatively (0-100)
- keyThemes: array of 2-4 themes the message triggers in the audience
- strengths: array of 1-3 specific strengths
- weaknesses: array of 1-3 specific weaknesses

Then provide an overall:
- recommendedLabel: the label of the best-performing variant
- rationale: 2-3 sentence explanation of why it outperforms the others
- ranking: array of labels ordered best to worst

${variantBlock}

Return ONLY a JSON object matching this exact schema:
{
  "variants": [{ "label": string, "sentimentScore": number, "reachScore": number, "supporterPercent": number, "detractorPercent": number, "keyThemes": string[], "strengths": string[], "weaknesses": string[] }],
  "recommendedLabel": string,
  "rationale": string,
  "ranking": string[]
}`;

  try {
    const llmRes = await chat("openai", [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    let parsed: {
      variants: Array<{ label: string; sentimentScore: number; reachScore: number; supporterPercent: number; detractorPercent: number; keyThemes: string[]; strengths: string[]; weaknesses: string[] }>;
      recommendedLabel: string;
      rationale: string;
      ranking: string[];
    };
    try {
      const clean = llmRes.content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("LLM returned non-JSON response");
    }

    // Persist for audit/retrieval
    await db.insert(analysisReportsTable).values({
      orgId,
      category,
      status: "completed",
      rawReport: JSON.stringify({ type: "message-resonance-test", variants: parsed.variants, recommendedLabel: parsed.recommendedLabel, rationale: parsed.rationale, ranking: parsed.ranking, geography }),
    });

    logger.info({ orgId, variantCount: variants.length, category, recommended: parsed.recommendedLabel }, "Message resonance test completed");

    res.json({
      status: "completed",
      category,
      geography: geography ?? null,
      variantCount: variants.length,
      variants: parsed.variants,
      recommendedLabel: parsed.recommendedLabel,
      rationale: parsed.rationale,
      ranking: parsed.ranking,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Resonance test failed";
    logger.warn({ err, orgId }, "Message resonance test failed");
    res.status(502).json({ error: msg });
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
      // attempts:1 — a full OASIS pipeline is minutes-to-an-hour of real LLM
      // spend; never auto-retry the whole run on failure.
      { priority: 2, attempts: 1 },
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
