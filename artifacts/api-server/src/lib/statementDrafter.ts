import { db } from "@workspace/db";
import { contentItemsTable, alertsTable, analysisReportsTable } from "@workspace/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { chat } from "./llm";
import { logger } from "./logger";

export type StatementTone = "formal" | "empathetic" | "assertive";
export type StatementType = "press_release" | "social_post" | "internal_memo";

export interface StatementResult {
  draftId: string;
  keyword: string;
  alertId?: string;
  tone: StatementTone;
  type: StatementType;
  draft: string;
  wordCount: number;
  generatedAt: string;
  regenerateUrl: string;
}

const TONE_INSTRUCTIONS: Record<StatementTone, string> = {
  formal:     "Use formal, professional language. Avoid contractions. Address stakeholders by title.",
  empathetic: "Lead with acknowledgment of impact on people. Use warm, human language. Show genuine concern.",
  assertive:  "Be direct and confident. State your position clearly. Do not over-apologise. Show leadership.",
};

const TYPE_FORMATS: Record<StatementType, string> = {
  press_release: `FORMAT: Full press release with: FOR IMMEDIATE RELEASE header, headline, dateline, 3-4 paragraphs of body, boilerplate 'About' section, and media contact placeholder.`,
  social_post:   `FORMAT: 2-3 social media posts optimised for reach. Each post: platform label (Twitter/X, LinkedIn, Facebook), character count, post body. Keep Twitter/X under 280 chars.`,
  internal_memo: `FORMAT: Internal memo with: TO / FROM / DATE / RE: header fields, executive summary (2 sentences), situation overview, recommended actions (numbered list), next steps.`,
};

/**
 * Draft a public statement or press release using AI.
 *
 * If alertId is provided, fetches crisis context to inform the draft.
 * Draft is stored in analysis_reports for retrieval and re-generation.
 */
export async function draftStatement(
  orgId: string,
  keyword: string,
  tone: StatementTone,
  type: StatementType,
  alertId?: string,
  feedback?: string,
): Promise<StatementResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pattern = `%${keyword.replace(/[%_]/g, "\\$&")}%`;

  // Fetch recent content context
  const recentItems = await db
    .select({
      title: contentItemsTable.title,
      body: contentItemsTable.body,
      sentimentScore: contentItemsTable.sentimentScore,
      platform: contentItemsTable.platform,
      publishedAt: contentItemsTable.publishedAt,
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
      ),
    )
    .orderBy(desc(contentItemsTable.publishedAt))
    .limit(10);

  const contextSummary = recentItems
    .map((item) => `- ${item.title ?? "(no title)"} [${item.platform}, sentiment: ${Number(item.sentimentScore ?? 0).toFixed(2)}]`)
    .join("\n");

  // Fetch alert context
  let alertContext = "";
  if (alertId) {
    const [alert] = await db
      .select({ severity: alertsTable.severity, crisisProbability: alertsTable.crisisProbability, type: alertsTable.type })
      .from(alertsTable)
      .where(and(eq(alertsTable.id, alertId), eq(alertsTable.orgId, orgId)));

    if (alert) {
      alertContext = `\nActive alert: type=${alert.type}, severity=${alert.severity}, crisis_probability=${alert.crisisProbability}%`;
    }
  }

  const systemPrompt = `You are a senior communications director and speechwriter.
Draft a ${type.replace("_", " ")} in response to a developing situation.

TONE INSTRUCTION: ${TONE_INSTRUCTIONS[tone]}
${TYPE_FORMATS[type]}

Write the complete draft now. Do not include meta-commentary or notes about what you're doing.`;

  const userContent = [
    `Topic/keyword: "${keyword}"`,
    alertContext,
    recentItems.length > 0 ? `\nRecent media coverage (${recentItems.length} items):\n${contextSummary}` : "",
    feedback ? `\nRevision feedback: ${feedback}` : "",
  ].filter(Boolean).join("\n");

  const result = await chat(
    "openai",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    { operation: "draft-statement", model: "gpt-4o" },
  );

  const draft = result.content.trim();

  // Store draft as an analysis report for retrieval + re-generation
  const [report] = await db
    .insert(analysisReportsTable)
    .values({
      orgId,
      category: keyword,
      status: "completed",
      rawReport: JSON.stringify({ draft, keyword, tone, type, alertId, feedback }),
    })
    .returning({ id: analysisReportsTable.id });

  return {
    draftId: report!.id,
    keyword,
    alertId,
    tone,
    type,
    draft,
    wordCount: draft.split(/\s+/).filter(Boolean).length,
    generatedAt: new Date().toISOString(),
    regenerateUrl: `/api/v1/intelligence/draft-statement?draftId=${report!.id}`,
  };
}

/**
 * Re-generate a statement with feedback, using the original draft as context.
 */
export async function regenerateStatement(
  orgId: string,
  draftId: string,
  feedback: string,
): Promise<StatementResult> {
  const [report] = await db
    .select()
    .from(analysisReportsTable)
    .where(and(eq(analysisReportsTable.id, draftId), eq(analysisReportsTable.orgId, orgId)));

  if (!report) throw new Error("Draft not found");

  const originalData = JSON.parse(report.rawReport ?? "{}") as {
    keyword: string; tone: StatementTone; type: StatementType; alertId?: string; draft: string;
  };

  return draftStatement(
    orgId,
    originalData.keyword,
    originalData.tone ?? "formal",
    originalData.type ?? "press_release",
    originalData.alertId,
    feedback,
  );
}
