import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { chat } from "./llm";
import { logger } from "./logger";

export interface DisinformationCheckResult {
  itemId: string;
  claim: string;
  isDisinformation: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * LLM-based disinformation check for a sample of content matching a keyword.
 *
 * For each item:
 *   1. Extract the primary claim from title/body
 *   2. Ask the LLM to assess if it's verifiably false/misleading (0-1 confidence)
 *   3. Flag items with confidence > 0.7 and update content_items.is_disinformation
 *
 * Degrades gracefully if no LLM key is configured — returns empty results.
 */
export async function checkDisinformationForKeyword(
  orgId: string,
  keyword: string,
  maxItems = 10,
): Promise<DisinformationCheckResult[]> {
  const since = new Date(Date.now() - 60 * 60 * 1000); // last 1h
  const pattern = `%${keyword.replace(/[%_]/g, "\\$&")}%`;

  const items = await db
    .select({ id: contentItemsTable.id, title: contentItemsTable.title, body: contentItemsTable.body })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        sql`${contentItemsTable.isDisinformation} = 'false'`,
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    )
    .limit(maxItems);

  if (!items.length) return [];

  const results: DisinformationCheckResult[] = [];

  for (const item of items) {
    const text = [item.title, item.body?.slice(0, 500)].filter(Boolean).join("\n");
    const prompt = `You are a fact-checking assistant. Analyse the following text and determine if it contains a verifiably false or seriously misleading claim about real events, people, or statistics.

Text: """
${text}
"""

Respond ONLY with a JSON object:
{"is_disinformation": boolean, "confidence": 0.0-1.0, "claim": "one-sentence summary of the primary claim", "reasoning": "brief explanation"}

Only flag as disinformation if you are confident the claim is factually false or deliberately misleading. Opinions and speculation are NOT disinformation.`;

    try {
      const result = await chat("openai", [{ role: "user", content: prompt }], {
        operation: "disinformation-check",
        model: "gpt-4o-mini",
      });

      const cleaned = result.content
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/```\s*$/m, "")
        .trim();

      const parsed = JSON.parse(cleaned) as {
        is_disinformation: boolean;
        confidence: number;
        claim: string;
        reasoning: string;
      };

      if (parsed.is_disinformation && parsed.confidence > 0.7) {
        await db
          .update(contentItemsTable)
          .set({ isDisinformation: "true" })
          .where(eq(contentItemsTable.id, item.id));
      }

      results.push({
        itemId: item.id,
        claim: parsed.claim,
        isDisinformation: parsed.is_disinformation && parsed.confidence > 0.7,
        confidence: Math.round(parsed.confidence * 100) / 100,
        reasoning: parsed.reasoning,
      });
    } catch (err) {
      // Graceful degradation: skip this item if LLM call fails
      logger.warn({ err, itemId: item.id }, "Disinformation check failed for item — skipping");
    }
  }

  return results;
}
