import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@workspace/db";
import { llmUsageLogsTable } from "@workspace/db/schema";
import { getPlatformConfig as getConfig, clearConfigCache } from "./platform-config";
import { logger } from "./logger";

export type LlmProvider = "openai" | "gemini";

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
  opts: { model?: string; operation?: string } = {}
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

// ─── Unified dispatcher ───────────────────────────────────────────────────────
export async function chat(
  provider: LlmProvider,
  messages: LlmMessage[],
  opts: { model?: string; operation?: string } = {}
): Promise<LlmResponse> {
  if (provider === "openai") return chatWithGpt(messages, opts);
  if (provider === "gemini") return chatWithGemini(messages, opts);
  throw new Error(`Unknown LLM provider: ${provider}`);
}
