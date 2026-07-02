import OpenAI from "openai";
import { db } from "@workspace/db";
import { llmUsageLogsTable, contentItemsTable } from "@workspace/db/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { getPlatformConfig as getConfig } from "../platform-config";
import { logger } from "../logger";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const EMBED_BATCH_SIZE = 100;
const COST_PER_1K_TOKENS = 0.00002;

async function logEmbeddingUsage(tokens: number, durationMs: number, status: "success" | "error", error?: string) {
  try {
    await db.insert(llmUsageLogsTable).values({
      model: EMBEDDING_MODEL,
      operation: "embed_batch",
      promptTokens: tokens,
      completionTokens: 0,
      totalTokens: tokens,
      estimatedCostUsd: (tokens / 1000) * COST_PER_1K_TOKENS,
      durationMs,
      status,
      errorMessage: error,
    });
  } catch (err) { logger.warn({ err }, "Failed to log embedding usage"); }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const results = await generateEmbeddingsBatch([text]);
  return results[0] ?? null;
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (!texts.length) return [];

  const apiKey = await getConfig("openai_api_key");
  if (!apiKey) {
    logger.warn("OpenAI API key not configured — skipping embedding generation");
    return texts.map(() => null);
  }

  const client = new OpenAI({ apiKey });
  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batchTexts = texts.slice(i, i + EMBED_BATCH_SIZE);
    const cleanTexts = batchTexts.map((t) => t.replace(/\s+/g, " ").trim().slice(0, 8000));
    const start = Date.now();

    try {
      const resp = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: cleanTexts,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      const durationMs = Date.now() - start;

      for (const item of resp.data) {
        results[i + item.index] = item.embedding;
      }

      await logEmbeddingUsage(resp.usage?.total_tokens ?? 0, durationMs, "success");
    } catch (err) {
      const durationMs = Date.now() - start;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err, batchSize: batchTexts.length }, "Embedding batch failed");
      await logEmbeddingUsage(0, durationMs, "error", msg);
    }
  }

  return results;
}

export async function embedPendingItems(limit = 200): Promise<number> {
  const items = await db
    .select({
      id: contentItemsTable.id,
      title: contentItemsTable.title,
      summary: contentItemsTable.summary,
      body: contentItemsTable.body,
    })
    .from(contentItemsTable)
    .where(
      and(
        isNotNull(contentItemsTable.processedAt),
        isNull(contentItemsTable.embedding as unknown as Parameters<typeof isNull>[0])
      )
    )
    .limit(limit);

  if (!items.length) return 0;

  const texts = items.map((item) => {
    const parts = [item.title ?? "", item.summary ?? "", item.body.slice(0, 500)].filter(Boolean);
    return parts.join(" ");
  });

  const embeddings = await generateEmbeddingsBatch(texts);
  let stored = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const embedding = embeddings[idx];
    if (!embedding) continue;
    const item = items[idx]!;

    await db
      .update(contentItemsTable)
      .set({ embedding: embedding as unknown as number[] })
      .where(eq(contentItemsTable.id, item.id));

    stored++;
  }

  logger.info({ stored, total: items.length }, "Embedding generation complete");
  return stored;
}

/**
 * Semantic search scoped to a specific org.
 * orgId is REQUIRED — the caller must always provide tenant context.
 * This makes cross-tenant data access architecturally impossible by
 * removing any unscoped code path.
 */
export async function semanticSearch(
  queryText: string,
  orgId: string,
  opts: { category?: string; limit?: number; minSimilarity?: number } = {}
): Promise<Array<{ id: string; similarity: number; title: string | null; summary: string | null; category: string | null; platform: string; publishedAt: Date | null }>> {
  if (!orgId) throw new Error("semanticSearch: orgId is required for tenant isolation");

  const embedding = await generateEmbedding(queryText);
  if (!embedding) return [];

  const { pool } = await import("@workspace/db");

  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(opts.limit ?? 20))));
  const safeMinSimilarity = Math.max(0, Math.min(1, Number(opts.minSimilarity ?? 0.3)));
  const category = typeof opts.category === "string" ? opts.category : null;

  const vectorStr = `[${embedding.join(",")}]`;

  let query: string;
  let params: unknown[];

  if (orgId && category) {
    query = `
      SELECT id, title, summary, category, platform, published_at,
             1 - (embedding <=> $1::vector) AS similarity
      FROM content_items
      WHERE processed_at IS NOT NULL
        AND embedding IS NOT NULL
        AND org_id = $2
        AND category = $3
        AND 1 - (embedding <=> $1::vector) >= $4
      ORDER BY embedding <=> $1::vector
      LIMIT $5
    `;
    params = [vectorStr, orgId, category, safeMinSimilarity, safeLimit];
  } else if (orgId) {
    query = `
      SELECT id, title, summary, category, platform, published_at,
             1 - (embedding <=> $1::vector) AS similarity
      FROM content_items
      WHERE processed_at IS NOT NULL
        AND embedding IS NOT NULL
        AND org_id = $2
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4
    `;
    params = [vectorStr, orgId, safeMinSimilarity, safeLimit];
  } else if (category) {
    query = `
      SELECT id, title, summary, category, platform, published_at,
             1 - (embedding <=> $1::vector) AS similarity
      FROM content_items
      WHERE processed_at IS NOT NULL
        AND embedding IS NOT NULL
        AND category = $2
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4
    `;
    params = [vectorStr, category, safeMinSimilarity, safeLimit];
  } else {
    query = `
      SELECT id, title, summary, category, platform, published_at,
             1 - (embedding <=> $1::vector) AS similarity
      FROM content_items
      WHERE processed_at IS NOT NULL
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;
    params = [vectorStr, safeMinSimilarity, safeLimit];
  }

  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      similarity: Number(r.similarity),
      title: r.title as string | null,
      summary: r.summary as string | null,
      category: r.category as string | null,
      platform: String(r.platform),
      publishedAt: r.published_at ? new Date(r.published_at as string) : null,
    }));
  } finally {
    client.release();
  }
}
