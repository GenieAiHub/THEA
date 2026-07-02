import { Router } from "express";
import { chat, type LlmProvider, type LlmMessage } from "../../lib/llm";
import { semanticSearch } from "../../lib/analysis/embeddings";
import { requireAuth } from "../../middlewares/clerkAuth";

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

router.post("/simulate", async (_req, res) => {
  res.status(501).json({ message: "What-If simulator will be available in Phase 5" });
});

export default router;
