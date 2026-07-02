import { db } from "@workspace/db";
import { contentItemsTable, alertsTable } from "@workspace/db/schema";
import { eq, and, gte, lt, desc, sql, avg } from "drizzle-orm";
import { chat } from "./llm";
import { logger } from "./logger";

export interface CounterNarrativeStrategy {
  angle: string;
  rationale: string;
  sampleMessage: string;
  predictedEffectiveness: "high" | "medium" | "low";
  targetAudience: string;
}

export interface CounterNarrativeResult {
  keyword: string;
  dominantNarratives: string[];
  strategies: CounterNarrativeStrategy[];
  generatedAt: string;
}

/**
 * Counter-narrative engine.
 *
 * Triggered automatically when a crisis alert fires (severity >= high).
 * Analyzes dominant negative narrative frames from top negative-sentiment items
 * and returns 3-5 reframing strategies ranked by predicted effectiveness.
 */
export async function generateCounterNarrative(
  orgId: string,
  keyword: string,
  alertId?: string,
): Promise<CounterNarrativeResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pattern = `%${keyword.replace(/[%_]/g, "\\$&")}%`;

  // Fetch negative-sentiment content for this keyword
  const negativeItems = await db
    .select({
      title: contentItemsTable.title,
      body: contentItemsTable.body,
      sentimentScore: contentItemsTable.sentimentScore,
      platform: contentItemsTable.platform,
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        lt(contentItemsTable.sentimentScore, sql`0`),
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    )
    .orderBy(contentItemsTable.sentimentScore)
    .limit(20);

  const negativeContext = negativeItems
    .map((item, i) => `[${i + 1}] ${item.title ?? "(no title)"} (sentiment: ${Number(item.sentimentScore ?? 0).toFixed(2)})\n${(item.body ?? "").slice(0, 300)}`)
    .join("\n\n---\n\n");

  // Fetch alert context if alertId provided
  let alertContext = "";
  if (alertId) {
    const [alert] = await db
      .select({ severity: alertsTable.severity, crisisProbability: alertsTable.crisisProbability, payload: alertsTable.payload })
      .from(alertsTable)
      .where(and(eq(alertsTable.id, alertId), eq(alertsTable.orgId, orgId)));

    if (alert) {
      alertContext = `\nAlert context: severity=${alert.severity}, crisis_probability=${alert.crisisProbability}%`;
    }
  }

  const systemPrompt = `You are a crisis communications strategist with expertise in narrative reframing. 
When a brand, political figure, or organisation faces negative sentiment, your job is to identify the dominant negative narratives and propose effective counter-framing strategies.

Return ONLY a JSON object:
{
  "dominantNarratives": ["narrative 1", "narrative 2", "narrative 3"],
  "strategies": [
    {
      "angle": "Short name for this strategy",
      "rationale": "Why this counter-framing is likely to work",
      "sampleMessage": "60-100 word example message using this angle",
      "predictedEffectiveness": "high|medium|low",
      "targetAudience": "Who this message is designed to reach"
    }
  ]
}

Provide 3-5 strategies, ranked from most to least effective.
Base your prediction of effectiveness on: how directly it addresses the dominant concern, emotional resonance, and whether it pivots to strength or just defends.`;

  const userContent = `Keyword under fire: "${keyword}"${alertContext}

Top negative-sentiment coverage (${negativeItems.length} items):
${negativeContext || "No recent negative coverage found — generate proactive counter-narrative strategies."}`;

  const result = await chat(
    "openai",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    { operation: "counter-narrative", model: "gpt-4o" },
  );

  const cleaned = result.content
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();

  const parsed = JSON.parse(cleaned) as {
    dominantNarratives: string[];
    strategies: CounterNarrativeStrategy[];
  };

  return {
    keyword,
    dominantNarratives: parsed.dominantNarratives ?? [],
    strategies: parsed.strategies ?? [],
    generatedAt: new Date().toISOString(),
  };
}
