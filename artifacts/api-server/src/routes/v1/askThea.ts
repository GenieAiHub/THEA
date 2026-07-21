import { Router } from "express";
import { db } from "@workspace/db";
import { chatConversationsTable, chatMessagesTable } from "@workspace/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { requireTier } from "../../middlewares/featureGate";
import { chatStream, type LlmMessage, type LlmProvider } from "../../lib/llm";
import { retrieveContext, buildSystemPrompt, NO_DATA_REPLY, type AskTheaCitation } from "../../lib/askThea";
import { checkDailySpendCap } from "../../lib/analysis/classifier";
import { logger } from "../../lib/logger";

/**
 * Ask THEA — conversational AI analyst over the org's collected intelligence.
 * All routes are Pro-tier and strictly scoped to the requesting user's own
 * conversations (org AND user ownership on every query).
 */
const router = Router();
router.use(requireAuth);
router.use(requireTier("pro"));

const VALID_PROVIDERS: LlmProvider[] = ["openai", "gemini", "deepseek"];
const MAX_QUESTION_LENGTH = 4000;
const HISTORY_MESSAGES = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /api/v1/ask-thea/conversations ──────────────────────────────────────
router.get("/conversations", async (req, res) => {
  const rows = await db
    .select()
    .from(chatConversationsTable)
    .where(
      and(
        eq(chatConversationsTable.orgId, req.thea!.org.id),
        eq(chatConversationsTable.userId, req.thea!.user.id),
      ),
    )
    .orderBy(desc(chatConversationsTable.updatedAt))
    .limit(50);

  res.json({ data: rows });
});

// ─── GET /api/v1/ask-thea/conversations/:id ──────────────────────────────────
router.get("/conversations/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const [conversation] = await db
    .select()
    .from(chatConversationsTable)
    .where(
      and(
        eq(chatConversationsTable.id, req.params.id as string),
        eq(chatConversationsTable.orgId, req.thea!.org.id),
        eq(chatConversationsTable.userId, req.thea!.user.id),
      ),
    );

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, conversation.id))
    .orderBy(asc(chatMessagesTable.createdAt));

  res.json({ conversation, messages });
});

// ─── DELETE /api/v1/ask-thea/conversations/:id ───────────────────────────────
router.delete("/conversations/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const deleted = await db
    .delete(chatConversationsTable)
    .where(
      and(
        eq(chatConversationsTable.id, req.params.id as string),
        eq(chatConversationsTable.orgId, req.thea!.org.id),
        eq(chatConversationsTable.userId, req.thea!.user.id),
      ),
    )
    .returning({ id: chatConversationsTable.id });

  if (!deleted.length) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.status(204).end();
});

// ─── POST /api/v1/ask-thea/ask ───────────────────────────────────────────────
/**
 * Ask a question. Responds as a Server-Sent Events stream:
 *   event: meta    → { conversationId }
 *   event: sources → { citations: AskTheaCitation[] }
 *   event: token   → { delta }
 *   event: done    → { conversationId, messageId, provider, model, usage }
 *   event: error   → { error }
 */
router.post("/ask", async (req, res) => {
  const { conversationId, message, provider = "openai" } = req.body as {
    conversationId?: string;
    message?: string;
    provider?: LlmProvider;
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  if (message.length > MAX_QUESTION_LENGTH) {
    res.status(400).json({ error: `message must be at most ${MAX_QUESTION_LENGTH} characters` });
    return;
  }
  if (!VALID_PROVIDERS.includes(provider)) {
    res.status(400).json({ error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` });
    return;
  }
  if (conversationId && !UUID_RE.test(conversationId)) {
    res.status(400).json({ error: "conversationId must be a valid UUID" });
    return;
  }

  const orgId = req.thea!.org.id;
  const userId = req.thea!.user.id;
  const question = message.trim();

  // Enforce the platform-wide daily LLM spend cap before doing any paid work.
  const cap = await checkDailySpendCap();
  if (!cap.withinCap) {
    res.status(429).json({ error: "The platform's daily AI budget has been reached — please try again tomorrow." });
    return;
  }

  // Resolve or create the conversation BEFORE switching to SSE so ownership
  // failures surface as normal JSON errors.
  let conversation: { id: string; title: string };
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(chatConversationsTable)
      .where(
        and(
          eq(chatConversationsTable.id, conversationId),
          eq(chatConversationsTable.orgId, orgId),
          eq(chatConversationsTable.userId, userId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    conversation = existing;
  } else {
    const title = question.length > 60 ? `${question.slice(0, 57)}...` : question;
    const [created] = await db
      .insert(chatConversationsTable)
      .values({ orgId, userId, title })
      .returning();
    conversation = created!;
  }

  // Load prior history BEFORE persisting the new user message so the history
  // window and the current question never duplicate each other.
  const history = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, conversation.id))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(HISTORY_MESSAGES);
  history.reverse();

  await db.insert(chatMessagesTable).values({
    conversationId: conversation.id,
    role: "user",
    content: question,
  });
  await db
    .update(chatConversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversationsTable.id, conversation.id));

  // ── Switch to SSE ──────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Heartbeat: retrieval + LLM time-to-first-token can take several seconds,
  // keep intermediaries from timing out the idle connection.
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": heartbeat\n\n");
  }, 15_000);

  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
  });

  const finish = () => {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  };

  sendEvent("meta", { conversationId: conversation.id, title: conversation.title });

  try {
    const context = await retrieveContext(orgId, question);
    sendEvent("sources", { citations: context.citations });

    // Honest failure: nothing relevant collected — reply deterministically
    // without calling the LLM at all.
    if (!context.hasData) {
      sendEvent("token", { delta: NO_DATA_REPLY });
      const [saved] = await db
        .insert(chatMessagesTable)
        .values({
          conversationId: conversation.id,
          role: "assistant",
          content: NO_DATA_REPLY,
          citations: [],
        })
        .returning({ id: chatMessagesTable.id });
      sendEvent("done", { conversationId: conversation.id, messageId: saved?.id, provider: null, model: null, usage: null });
      finish();
      return;
    }

    const llmMessages: LlmMessage[] = [
      { role: "system", content: buildSystemPrompt(req.thea!.org.name, context) },
      ...history.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      })),
      { role: "user", content: question },
    ];

    const result = await chatStream(
      provider,
      llmMessages,
      { operation: "ask-thea", signal: abortController.signal },
      (delta) => sendEvent("token", { delta }),
    );

    // Only keep citations whose markers the model actually used. Matches both
    // single ([S1]) and combined ([S1, S3]) bracket forms. If the model cited
    // nothing, persist an empty list — that is the honest answer.
    const usedCitations: AskTheaCitation[] = context.citations.filter((c) =>
      new RegExp(`\\[[^\\]]*\\b${c.marker}\\b[^\\]]*\\]`).test(result.content),
    );

    const [saved] = await db
      .insert(chatMessagesTable)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: result.content,
        citations: usedCitations,
      })
      .returning({ id: chatMessagesTable.id });

    await db
      .update(chatConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversationsTable.id, conversation.id));

    sendEvent("done", {
      conversationId: conversation.id,
      messageId: saved?.id,
      provider: result.provider,
      model: result.model,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.promptTokens + result.completionTokens,
      },
    });
  } catch (err: unknown) {
    if (!abortController.signal.aborted) {
      logger.warn({ err, orgId, conversationId: conversation.id }, "Ask THEA stream failed");
      // Only forward messages that are safe and actionable for the user
      // (provider configuration / budget problems). Everything else — DB
      // errors, network failures — gets a generic message; details stay
      // in the server log.
      const raw = err instanceof Error ? err.message : "";
      const clientSafe = /not configured|api key|budget|rate limit|quota/i.test(raw) && !raw.includes("Failed query");
      sendEvent("error", {
        error: clientSafe ? raw : "Ask THEA hit an unexpected error — please try again in a moment.",
      });
    }
  } finally {
    finish();
  }
});

export default router;
