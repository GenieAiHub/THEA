import { Router } from "express";
import { chat, type LlmProvider, type LlmMessage } from "../../lib/llm";

const router = Router();

// ─── POST /api/v1/intelligence/chat ──────────────────────────────────────────
// Live LLM chat endpoint — supports both GPT and Gemini.
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
    const status = msg.includes("not configured") ? 400 : 502;
    res.status(status).json({ error: msg });
  }
});

// ─── POST /api/v1/intelligence/talking-points ─────────────────────────────────
router.post("/talking-points", async (req, res) => {
  const { topic, provider = "openai", context } = req.body as {
    topic: string;
    provider?: LlmProvider;
    context?: string;
  };

  if (!topic) { res.status(400).json({ error: "topic is required" }); return; }

  const systemPrompt = `You are a strategic communications expert for political campaigns and advocacy organisations. 
Generate 5-7 concise, compelling talking points on the given topic. Format as a numbered list. 
Each point should be punchy, evidence-based, and emotionally resonant.`;

  try {
    const result = await chat(
      provider,
      [
        { role: "system",  content: systemPrompt },
        { role: "user",    content: `Topic: ${topic}${context ? `\n\nContext: ${context}` : ""}` },
      ],
      { operation: "talking-points" }
    );
    res.json({ topic, talkingPoints: result.content, provider: result.provider, model: result.model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate talking points";
    res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

// ─── POST /api/v1/intelligence/draft-statement ────────────────────────────────
router.post("/draft-statement", async (req, res) => {
  const { topic, tone = "professional", audience, provider = "openai" } = req.body as {
    topic: string;
    tone?: string;
    audience?: string;
    provider?: LlmProvider;
  };

  if (!topic) { res.status(400).json({ error: "topic is required" }); return; }

  const systemPrompt = `You are a speechwriter and communications strategist. Draft a concise, 
impactful public statement on the given topic. Tone: ${tone}. ${audience ? `Target audience: ${audience}.` : ""}
The statement should be 2-3 paragraphs, clear, and suitable for press release format.`;

  try {
    const result = await chat(
      provider,
      [
        { role: "system", content: systemPrompt },
        { role: "user",   content: `Draft a statement on: ${topic}` },
      ],
      { operation: "draft-statement" }
    );
    res.json({ topic, statement: result.content, provider: result.provider, model: result.model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to draft statement";
    res.status(msg.includes("not configured") ? 400 : 502).json({ error: msg });
  }
});

// ─── POST /api/v1/intelligence/simulate ──────────────────────────────────────
router.post("/simulate", async (_req, res) => {
  res.status(501).json({ message: "What-If simulator will be available in Phase 5" });
});

export default router;
