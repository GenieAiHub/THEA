import { db } from "@workspace/db";
import { contentItemsTable, alertsTable, watchlistKeywordsTable } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { chat } from "./llm";
import { logger } from "./logger";
import { getQueues } from "./queues";

export interface DisinformationCheckResult {
  itemId: string;
  claim: string;
  isDisinformation: boolean;
  confidence: number;
  reasoning: string;
  source: "claimbuster" | "llm" | "skipped";
}

const CLAIMBUSTER_API_URL = "https://idir.uta.edu/claimbuster/api/v2/score/text/";
const DISINFORMATION_CONFIDENCE_THRESHOLD = 0.7;

/**
 * ClaimBuster API call — first-stage fact-checking.
 *
 * Returns a check-worthy score (0-1) for the claim text.
 * Falls back gracefully if CLAIMBUSTER_API_KEY is not set.
 */
async function checkWithClaimBuster(
  text: string,
): Promise<{ checkWorthy: boolean; score: number } | null> {
  const apiKey = process.env["CLAIMBUSTER_API_KEY"];
  if (!apiKey) return null;

  try {
    const res = await fetch(`${CLAIMBUSTER_API_URL}${encodeURIComponent(text)}`, {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "ClaimBuster API returned non-OK status");
      return null;
    }

    const data = (await res.json()) as {
      results?: Array<{ score: number; text: string }>;
    };
    const topScore = data.results?.[0]?.score ?? 0;
    return { checkWorthy: topScore > 0.5, score: topScore };
  } catch (err) {
    logger.warn({ err }, "ClaimBuster request failed — falling back to LLM");
    return null;
  }
}

/**
 * LLM-based disinformation check — second stage (or sole stage if ClaimBuster unavailable).
 *
 * Only called if:
 *   a) ClaimBuster is unavailable, OR
 *   b) ClaimBuster flagged the text as check-worthy (score > 0.5)
 */
async function checkWithLlm(
  text: string,
): Promise<{ isDisinformation: boolean; confidence: number; claim: string; reasoning: string } | null> {
  const prompt = `You are a fact-checking assistant. Analyse the following text and determine if it contains a verifiably false or seriously misleading factual claim about real events, people, or statistics.

Text: """
${text}
"""

Respond ONLY with a JSON object:
{"isDisinformation": boolean, "confidence": 0.0-1.0, "claim": "one-sentence summary of the primary factual claim", "reasoning": "brief explanation of your assessment"}

Only flag as disinformation if you are confident the claim is factually false or deliberately misleading. Opinions, satire, and speculation are NOT disinformation.`;

  try {
    const result = await chat("openai", [{ role: "user", content: prompt }], {
      operation: "disinformation-check",
      model: "gpt-4o-mini",
    });

    const cleaned = result.content
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/```\s*$/m, "")
      .trim();

    return JSON.parse(cleaned) as {
      isDisinformation: boolean;
      confidence: number;
      claim: string;
      reasoning: string;
    };
  } catch (err) {
    logger.warn({ err }, "LLM disinformation check failed");
    return null;
  }
}

/**
 * Two-stage disinformation pipeline:
 *
 *   Stage 1: ClaimBuster — fast, rule-based check-worthiness scoring
 *             (skipped if CLAIMBUSTER_API_KEY not set)
 *   Stage 2: LLM (GPT-4o-mini) — deep fact-checking for check-worthy claims
 *
 * Items are only flagged in the DB after both stages confirm disinformation.
 * Degrades gracefully to LLM-only if ClaimBuster is not configured.
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

    // Stage 1: ClaimBuster
    const cbResult = await checkWithClaimBuster(text);

    if (cbResult !== null && !cbResult.checkWorthy) {
      // ClaimBuster says not check-worthy — skip LLM call
      results.push({
        itemId: item.id,
        claim: text.slice(0, 150),
        isDisinformation: false,
        confidence: cbResult.score,
        reasoning: "ClaimBuster: not flagged as check-worthy",
        source: "claimbuster",
      });
      continue;
    }

    // Stage 2: LLM (triggered if ClaimBuster flagged or unavailable)
    const llmResult = await checkWithLlm(text);
    if (!llmResult) {
      results.push({
        itemId: item.id,
        claim: text.slice(0, 150),
        isDisinformation: false,
        confidence: 0,
        reasoning: "Both ClaimBuster and LLM unavailable for this item",
        source: "skipped",
      });
      continue;
    }

    const isDisinfo = llmResult.isDisinformation && llmResult.confidence > DISINFORMATION_CONFIDENCE_THRESHOLD;

    if (isDisinfo) {
      await db
        .update(contentItemsTable)
        .set({ isDisinformation: "true" })
        .where(eq(contentItemsTable.id, item.id))
        .catch((err) => logger.warn({ err, itemId: item.id }, "Failed to update isDisinformation flag"));

      // Create a priority alert and queue dispatch for every confirmed disinformation item
      const keywordRow = await db
        .select({ id: watchlistKeywordsTable.id })
        .from(watchlistKeywordsTable)
        .where(
          and(
            eq(watchlistKeywordsTable.orgId, orgId),
            sql`lower(${watchlistKeywordsTable.keyword}) = lower(${keyword})`,
          ),
        )
        .limit(1)
        .then((r) => r[0]);

      const severity = llmResult.confidence >= 0.9 ? "critical" : "high";

      const [alert] = await db
        .insert(alertsTable)
        .values({
          orgId,
          keywordId: keywordRow?.id ?? null,
          keyword,
          type: "disinformation",
          severity,
          crisisProbability: Math.round(llmResult.confidence * 100),
          status: "open",
          payload: {
            claim: llmResult.claim,
            reasoning: llmResult.reasoning,
            confidence: llmResult.confidence,
            itemId: item.id,
          },
        })
        .returning()
        .catch((err) => { logger.warn({ err }, "Failed to create disinformation alert"); return []; });

      if (alert?.id) {
        getQueues().alertDispatch.add(
          "alert-dispatch",
          { alertId: alert.id, orgId, keyword, severity, crisisProbability: Math.round(llmResult.confidence * 100) },
          { priority: severity === "critical" ? 1 : 2 },
        ).catch((err) => logger.warn({ err, alertId: alert.id }, "Failed to queue disinformation alert dispatch"));
      }
    }

    results.push({
      itemId: item.id,
      claim: llmResult.claim,
      isDisinformation: isDisinfo,
      confidence: Math.round(llmResult.confidence * 100) / 100,
      reasoning: llmResult.reasoning,
      source: cbResult !== null ? "claimbuster" : "llm",
    });
  }

  return results;
}
