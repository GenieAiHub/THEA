import OpenAI from "openai";
import { db } from "@workspace/db";
import { platformConfigsTable, llmUsageLogsTable, contentItemsTable } from "@workspace/db/schema";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { safeDecrypt } from "../crypto";
import { logger } from "../logger";

const VALID_CATEGORIES = ["Politics", "News", "Technology", "Society", "Media", "Branding", "Entertainment", "Health", "Sports", "Environment", "Crypto"] as const;
type ContentCategory = typeof VALID_CATEGORIES[number];

const CONFIG_TTL_MS = 5 * 60 * 1000;
const configCache = new Map<string, { value: string | null; expiresAt: number }>();

async function getConfig(key: string): Promise<string | null> {
  const cached = configCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const rows = await db.select().from(platformConfigsTable)
    .where(and(eq(platformConfigsTable.key, key), eq(platformConfigsTable.isActive, true))).limit(1);
  const row = rows[0];
  const value = row ? safeDecrypt(row.encryptedValue) : null;
  configCache.set(key, { value, expiresAt: Date.now() + CONFIG_TTL_MS });
  return value;
}

export interface ClassificationResult {
  id: string;
  category: ContentCategory;
  sentiment: number;
  entities: Array<{ name: string; type: "person" | "org" | "location" | "topic"; relevance: number }>;
  summary: string;
  languageConfidence: number;
}

const MALAY_POLITICAL_CONTEXT = `
Malaysian political context (use for Malay-language content):
Parties: UMNO, PKR (Parti Keadilan Rakyat), DAP, Bersatu (PPBM), Amanah, PAS, MCA, MIC, Gerakan
Coalitions: Pakatan Harapan (PH), Perikatan Nasional (PN), Barisan Nasional (BN), Gabungan Parti Sarawak (GPS)
Key figures: Anwar Ibrahim (PM), Muhyiddin Yassin, Najib Razak, Ahmad Zahid Hamidi, Lim Guan Eng, Hadi Awang
Institutions: Dewan Rakyat, Dewan Negara, SPR (Election Commission), MACC (SPRM), Bank Negara
Terms: kerajaan (government), pembangkang (opposition), kawasan (constituency), Bumiputera, 1MDB, BERSIH
`.trim();

const BATCH_SIZE = 20;

function buildSystemPrompt(): string {
  return `You are an expert media analyst specialising in Southeast Asian political and cultural discourse.
For each article in the input array, output a JSON object with key "results" containing an array. Each element must have exactly these fields:
{
  "id": "<the provided id>",
  "category": "<one of: ${VALID_CATEGORIES.join(", ")}>",
  "sentiment": <float from -1.0 (very negative) to 1.0 (very positive)>,
  "entities": [{"name": "string", "type": "person|org|location|topic", "relevance": <float 0-1>}],
  "summary": "<exactly 1-2 sentences summarising the article>",
  "language_confidence": <float 0-1, confidence in your language handling>
}

${MALAY_POLITICAL_CONTEXT}

Rules:
- Always output valid JSON. Never add prose outside the JSON.
- Entities: extract up to 5, ordered by relevance descending.
- Sentiment: be precise; 0 = neutral, > 0 = positive, < 0 = negative.
- Summary: stay factual and concise, 1–2 sentences max.
- For non-English content: classify in the original language's framing.`;
}

async function logClassificationUsage(model: string, promptTokens: number, completionTokens: number, durationMs: number, status: "success" | "error", error?: string) {
  const cost = (promptTokens / 1000) * 0.00015 + (completionTokens / 1000) * 0.0006;
  try {
    await db.insert(llmUsageLogsTable).values({
      model, operation: "classify_batch",
      promptTokens, completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: cost, durationMs, status, errorMessage: error,
    });
  } catch (err) { logger.warn({ err }, "Failed to log LLM usage"); }
}

export async function classifyBatch(
  items: Array<{ id: string; title: string | null; body: string; language: string | null; category?: string | null }>,
  model = "gpt-4o-mini"
): Promise<ClassificationResult[]> {
  const apiKey = await getConfig("openai_api_key");
  if (!apiKey) {
    logger.warn("OpenAI API key not configured — skipping classification");
    return [];
  }

  const client = new OpenAI({ apiKey });
  const results: ClassificationResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const userContent = JSON.stringify(
      batch.map((item) => ({
        id: item.id,
        title: item.title?.slice(0, 300) ?? "",
        body: item.body.slice(0, 500),
        language: item.language ?? "unknown",
        current_category: item.category ?? "unknown",
      }))
    );

    const start = Date.now();
    try {
      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: `Classify these ${batch.length} articles:\n${userContent}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const durationMs = Date.now() - start;
      const raw = resp.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { results?: unknown[] };
      const batchResults = parsed.results ?? [];

      for (const r of batchResults) {
        const res = r as Record<string, unknown>;
        results.push({
          id: String(res.id ?? ""),
          category: (VALID_CATEGORIES.includes(res.category as ContentCategory) ? res.category : "News") as ContentCategory,
          sentiment: Math.max(-1, Math.min(1, Number(res.sentiment ?? 0))),
          entities: Array.isArray(res.entities)
            ? (res.entities as Array<Record<string, unknown>>).slice(0, 5).map((e) => ({
                name: String(e.name ?? ""),
                type: (["person", "org", "location", "topic"].includes(String(e.type)) ? e.type : "topic") as "person" | "org" | "location" | "topic",
                relevance: Math.max(0, Math.min(1, Number(e.relevance ?? 0.5))),
              }))
            : [],
          summary: String(res.summary ?? ""),
          languageConfidence: Math.max(0, Math.min(1, Number(res.language_confidence ?? 0.8))),
        });
      }

      await logClassificationUsage(
        model,
        resp.usage?.prompt_tokens ?? 0,
        resp.usage?.completion_tokens ?? 0,
        durationMs,
        "success"
      );
    } catch (err) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err, batchSize: batch.length }, "Classification batch failed");
      await logClassificationUsage(model, 0, 0, durationMs, "error", msg);
    }
  }

  return results;
}

export async function classifyPendingItems(category?: string, limit = 500): Promise<number> {
  const conditions = [isNull(contentItemsTable.processedAt)];
  if (category) conditions.push(eq(contentItemsTable.category, category));

  const items = await db
    .select({
      id: contentItemsTable.id,
      title: contentItemsTable.title,
      body: contentItemsTable.body,
      language: contentItemsTable.language,
      category: contentItemsTable.category,
    })
    .from(contentItemsTable)
    .where(and(...conditions))
    .limit(limit);

  if (!items.length) return 0;

  const results = await classifyBatch(items);

  for (const r of results) {
    await db
      .update(contentItemsTable)
      .set({
        sentimentScore: r.sentiment,
        entities: r.entities,
        summary: r.summary,
        category: r.category,
        processedAt: new Date(),
      })
      .where(eq(contentItemsTable.id, r.id));
  }

  logger.info({ classified: results.length, total: items.length }, "Classification batch complete");
  return results.length;
}

export async function checkDailySpendCap(): Promise<{ withinCap: boolean; todayUsd: number; capUsd: number }> {
  const capStr = await getConfig("llm_daily_spend_cap_usd");
  const capUsd = parseFloat(capStr ?? "5.0");

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  try {
    const rows = await db
      .select({ total: sql<number>`COALESCE(SUM(estimated_cost_usd), 0)` })
      .from(llmUsageLogsTable)
      .where(
        and(
          eq(llmUsageLogsTable.status, "success"),
          sql`created_at >= ${startOfDay}`
        )
      );
    const todayUsd = Number(rows[0]?.total ?? 0);
    const withinCap = todayUsd < capUsd;

    if (!withinCap) {
      logger.warn({ todayUsd, capUsd }, "LLM daily spend cap reached — bulk classification skipped");
    }

    return { withinCap, todayUsd, capUsd };
  } catch (err) {
    logger.warn({ err }, "Could not check daily spend cap — proceeding");
    return { withinCap: true, todayUsd: 0, capUsd };
  }
}
