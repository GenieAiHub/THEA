import OpenAI from "openai";
import { GoogleGenerativeAI, type Tool } from "@google/generative-ai";
import { db } from "@workspace/db";
import { llmUsageLogsTable } from "@workspace/db/schema";
import { getPlatformConfig as getConfig, clearConfigCache } from "./platform-config";
import { logger } from "./logger";

export type LlmProvider = "openai" | "gemini" | "deepseek";

export interface LlmMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LlmResponse {
  provider: LlmProvider;
  model: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
}

// Config resolution + caching now live in ./platform-config (DB-first, env fallback).
export { clearConfigCache };

// ─── Cost estimation ──────────────────────────────────────────────────────────
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o":              { input: 0.005,   output: 0.015 },
  "gpt-4o-mini":         { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo":         { input: 0.01,    output: 0.03 },
  "gpt-3.5-turbo":       { input: 0.0005,  output: 0.0015 },
  "gemini-1.5-pro":      { input: 0.00125, output: 0.005 },
  "gemini-1.5-flash":    { input: 0.000075,output: 0.0003 },
  "gemini-2.0-flash":    { input: 0.0001,  output: 0.0004 },
  "deepseek-chat":       { input: 0.00027, output: 0.0011 },
  "deepseek-reasoner":   { input: 0.00055, output: 0.00219 },
};

function estimateCost(model: string, prompt: number, completion: number): number {
  const rates = COST_PER_1K[model];
  if (!rates) return 0;
  return (prompt / 1000) * rates.input + (completion / 1000) * rates.output;
}

async function logUsage(params: {
  model: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  status: "success" | "error";
  errorMessage?: string;
}) {
  try {
    await db.insert(llmUsageLogsTable).values({
      model: params.model,
      operation: params.operation,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.promptTokens + params.completionTokens,
      estimatedCostUsd: estimateCost(params.model, params.promptTokens, params.completionTokens),
      durationMs: params.durationMs,
      status: params.status,
      errorMessage: params.errorMessage,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to write LLM usage log");
  }
}

// ─── OpenAI (GPT) ─────────────────────────────────────────────────────────────
export async function chatWithGpt(
  messages: LlmMessage[],
  opts: { model?: string; operation?: string; temperature?: number; jsonMode?: boolean } = {}
): Promise<LlmResponse> {
  const apiKey = await getConfig("openai_api_key");
  if (!apiKey) throw new Error("OpenAI API key is not configured. Add it in Super Admin → API Keys.");

  const model = opts.model ?? (await getConfig("openai_default_model")) ?? "gpt-4o-mini";
  const operation = opts.operation ?? "chat";

  const client = new OpenAI({ apiKey });
  const start = Date.now();

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    });

    const durationMs = Date.now() - start;
    const choice = resp.choices[0];
    const content = choice?.message?.content ?? "";
    const promptTokens = resp.usage?.prompt_tokens ?? 0;
    const completionTokens = resp.usage?.completion_tokens ?? 0;

    await logUsage({ model, operation, promptTokens, completionTokens, durationMs, status: "success" });

    return { provider: "openai", model, content, promptTokens, completionTokens, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await logUsage({ model, operation, promptTokens: 0, completionTokens: 0, durationMs, status: "error", errorMessage: msg });
    throw err;
  }
}

// ─── Google Gemini ────────────────────────────────────────────────────────────
export async function chatWithGemini(
  messages: LlmMessage[],
  opts: { model?: string; operation?: string } = {}
): Promise<LlmResponse> {
  const apiKey = await getConfig("gemini_api_key");
  if (!apiKey) throw new Error("Gemini API key is not configured. Add it in Super Admin → API Keys.");

  const model = opts.model ?? (await getConfig("gemini_default_model")) ?? "gemini-1.5-flash";
  const operation = opts.operation ?? "chat";

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });
  const start = Date.now();

  try {
    // Convert messages — Gemini uses history + current prompt pattern
    const systemMsg = messages.find((m) => m.role === "system");
    const history = messages
      .filter((m) => m.role !== "system")
      .slice(0, -1)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const lastMsg = messages.filter((m) => m.role !== "system").at(-1);
    const promptText = lastMsg?.content ?? "";
    const systemInstruction = systemMsg?.content;

    const chat = genModel.startChat({
      history,
      ...(systemInstruction ? { systemInstruction } : {}),
    });

    const result = await chat.sendMessage(promptText);
    const durationMs = Date.now() - start;
    const content = result.response.text();
    const usageMeta = result.response.usageMetadata;
    const promptTokens = usageMeta?.promptTokenCount ?? 0;
    const completionTokens = usageMeta?.candidatesTokenCount ?? 0;

    await logUsage({ model, operation, promptTokens, completionTokens, durationMs, status: "success" });

    return { provider: "gemini", model, content, promptTokens, completionTokens, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await logUsage({ model, operation, promptTokens: 0, completionTokens: 0, durationMs, status: "error", errorMessage: msg });
    throw err;
  }
}

// ─── DeepSeek (OpenAI-compatible) ─────────────────────────────────────────────
export async function chatWithDeepSeek(
  messages: LlmMessage[],
  opts: { model?: string; operation?: string } = {}
): Promise<LlmResponse> {
  const apiKey = await getConfig("deepseek_api_key");
  if (!apiKey) throw new Error("DeepSeek API key is not configured. Add it in Super Admin → API Keys.");

  const model = opts.model ?? (await getConfig("deepseek_default_model")) ?? "deepseek-chat";
  const operation = opts.operation ?? "chat";

  // DeepSeek exposes an OpenAI-compatible Chat Completions API.
  const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  const start = Date.now();

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const durationMs = Date.now() - start;
    const choice = resp.choices[0];
    const content = choice?.message?.content ?? "";
    const promptTokens = resp.usage?.prompt_tokens ?? 0;
    const completionTokens = resp.usage?.completion_tokens ?? 0;

    await logUsage({ model, operation, promptTokens, completionTokens, durationMs, status: "success" });

    return { provider: "deepseek", model, content, promptTokens, completionTokens, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await logUsage({ model, operation, promptTokens: 0, completionTokens: 0, durationMs, status: "error", errorMessage: msg });
    throw err;
  }
}

// ─── Gemini + Google Search grounding ─────────────────────────────────────────
export interface GroundingSource {
  uri: string;
  title: string;
}

export interface GroundedSupport {
  text: string;
  sourceIndices: number[];
}

export interface GroundedResponse {
  model: string;
  text: string;
  sources: GroundingSource[];
  supports: GroundedSupport[];
  webSearchQueries: string[];
}

// The @google/generative-ai@0.24.1 grounding type defs are inaccurate:
// GroundingSupport.segment is declared as `string` but is an object at runtime,
// and the chunk-index field is misspelled `groundingChunckIndices`. We read the
// real runtime shape here rather than trust the SDK types.
interface RuntimeGroundingMetadata {
  groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
  groundingSupports?: Array<{
    segment?: { text?: string };
    groundingChunkIndices?: number[];
  }>;
  webSearchQueries?: string[];
}

/**
 * Gemini grounded with Google Search. Gemini performs live Google searches
 * server-side and returns a synthesized answer plus grounding metadata (the
 * source URLs and the specific sentence each source supports). This is a
 * genuine live-web data path — a plain LLM call has no internet access.
 *
 * Google Search grounding uses the `googleSearch` tool, which requires a Gemini
 * 2.x model (the retired 1.x line used the old `googleSearchRetrieval` tool).
 * The installed SDK's Tool type predates `googleSearch`, but the SDK forwards
 * `tools` verbatim to the REST API, so we pass it through a cast rather than
 * pulling in a second Gemini SDK.
 */
export async function geminiGroundedSearch(
  prompt: string,
  opts: { model?: string; operation?: string } = {}
): Promise<GroundedResponse> {
  const apiKey = await getConfig("gemini_api_key");
  if (!apiKey) throw new Error("Gemini API key is not configured. Add it in Super Admin → API Keys.");

  let model = opts.model ?? (await getConfig("gemini_default_model")) ?? "gemini-2.0-flash";
  // The `googleSearch` grounding tool requires Gemini 2.x — bump legacy models.
  if (model.includes("1.5") || model.includes("1.0")) model = "gemini-2.0-flash";
  const operation = opts.operation ?? "grounded-search";

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model,
    tools: [{ googleSearch: {} }] as unknown as Tool[],
  });
  const start = Date.now();

  try {
    const result = await genModel.generateContent(prompt);
    const durationMs = Date.now() - start;
    const resp = result.response;
    const cand = resp.candidates?.[0];
    const gm = (cand?.groundingMetadata ?? undefined) as RuntimeGroundingMetadata | undefined;

    const sources: GroundingSource[] = (gm?.groundingChunks ?? [])
      .map((c) => ({ uri: c.web?.uri ?? "", title: c.web?.title ?? "" }))
      .filter((s) => s.uri);

    const supports: GroundedSupport[] = (gm?.groundingSupports ?? [])
      .map((s) => ({ text: s.segment?.text ?? "", sourceIndices: s.groundingChunkIndices ?? [] }))
      .filter((s) => s.text);

    let text = "";
    try { text = resp.text(); } catch { text = ""; }

    const usageMeta = resp.usageMetadata;
    const promptTokens = usageMeta?.promptTokenCount ?? 0;
    const completionTokens = usageMeta?.candidatesTokenCount ?? 0;

    await logUsage({ model, operation, promptTokens, completionTokens, durationMs, status: "success" });

    return { model, text, sources, supports, webSearchQueries: gm?.webSearchQueries ?? [] };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await logUsage({ model, operation, promptTokens: 0, completionTokens: 0, durationMs, status: "error", errorMessage: msg });
    throw err;
  }
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────
export async function chat(
  provider: LlmProvider,
  messages: LlmMessage[],
  opts: { model?: string; operation?: string } = {}
): Promise<LlmResponse> {
  if (provider === "openai") return chatWithGpt(messages, opts);
  if (provider === "gemini") return chatWithGemini(messages, opts);
  if (provider === "deepseek") return chatWithDeepSeek(messages, opts);
  throw new Error(`Unknown LLM provider: ${provider}`);
}

// ─── Streaming chat ───────────────────────────────────────────────────────────
export interface LlmStreamOptions {
  model?: string;
  operation?: string;
  /** Abort the provider stream (e.g. when the SSE client disconnects). */
  signal?: AbortSignal;
}

/** Shared streaming implementation for OpenAI-compatible APIs (OpenAI, DeepSeek). */
async function streamOpenAiCompatible(
  provider: LlmProvider,
  client: OpenAI,
  model: string,
  operation: string,
  messages: LlmMessage[],
  signal: AbortSignal | undefined,
  onDelta: (delta: string) => void
): Promise<LlmResponse> {
  const start = Date.now();
  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal }
    );

    let content = "";
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        content += delta;
        onDelta(delta);
      }
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens ?? 0;
        completionTokens = chunk.usage.completion_tokens ?? 0;
      }
    }

    const durationMs = Date.now() - start;
    await logUsage({ model, operation, promptTokens, completionTokens, durationMs, status: "success" });
    return { provider, model, content, promptTokens, completionTokens, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await logUsage({ model, operation, promptTokens: 0, completionTokens: 0, durationMs, status: "error", errorMessage: msg });
    throw err;
  }
}

/**
 * Streaming variant of chat(): emits each text delta through onDelta as it
 * arrives and resolves with the full LlmResponse (usage included) at the end.
 * Usage is logged exactly like the non-streaming path.
 */
export async function chatStream(
  provider: LlmProvider,
  messages: LlmMessage[],
  opts: LlmStreamOptions,
  onDelta: (delta: string) => void
): Promise<LlmResponse> {
  const operation = opts.operation ?? "chat-stream";

  if (provider === "openai") {
    const apiKey = await getConfig("openai_api_key");
    if (!apiKey) throw new Error("OpenAI API key is not configured. Add it in Super Admin → API Keys.");
    const model = opts.model ?? (await getConfig("openai_default_model")) ?? "gpt-4o-mini";
    const client = new OpenAI({ apiKey });
    return streamOpenAiCompatible("openai", client, model, operation, messages, opts.signal, onDelta);
  }

  if (provider === "deepseek") {
    const apiKey = await getConfig("deepseek_api_key");
    if (!apiKey) throw new Error("DeepSeek API key is not configured. Add it in Super Admin → API Keys.");
    const model = opts.model ?? (await getConfig("deepseek_default_model")) ?? "deepseek-chat";
    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
    return streamOpenAiCompatible("deepseek", client, model, operation, messages, opts.signal, onDelta);
  }

  if (provider === "gemini") {
    const apiKey = await getConfig("gemini_api_key");
    if (!apiKey) throw new Error("Gemini API key is not configured. Add it in Super Admin → API Keys.");
    const model = opts.model ?? (await getConfig("gemini_default_model")) ?? "gemini-2.0-flash";

    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });
    const start = Date.now();

    try {
      const systemMsg = messages.find((m) => m.role === "system");
      const history = messages
        .filter((m) => m.role !== "system")
        .slice(0, -1)
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      const lastMsg = messages.filter((m) => m.role !== "system").at(-1);
      const promptText = lastMsg?.content ?? "";

      const chatSession = genModel.startChat({
        history,
        ...(systemMsg?.content ? { systemInstruction: systemMsg.content } : {}),
      });

      const result = await chatSession.sendMessageStream(promptText, { signal: opts.signal });

      let content = "";
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          content += text;
          onDelta(text);
        }
      }

      const final = await result.response;
      const durationMs = Date.now() - start;
      const usageMeta = final.usageMetadata;
      const promptTokens = usageMeta?.promptTokenCount ?? 0;
      const completionTokens = usageMeta?.candidatesTokenCount ?? 0;

      await logUsage({ model, operation, promptTokens, completionTokens, durationMs, status: "success" });
      return { provider: "gemini", model, content, promptTokens, completionTokens, durationMs };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      await logUsage({ model, operation, promptTokens: 0, completionTokens: 0, durationMs, status: "error", errorMessage: msg });
      throw err;
    }
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}
