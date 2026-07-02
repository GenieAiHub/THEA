import { db } from "@workspace/db";
import { contentItemsTable, alertsTable, watchlistKeywordsTable, organizationsTable } from "@workspace/db/schema";
import { eq, and, gte, desc, sql, count, avg, ne } from "drizzle-orm";
import { chat } from "./llm";
import { logger } from "./logger";

const RELEVANCE_THRESHOLD = 70;
const ITEMS_TO_SCAN = 20;

export interface NewsjackingOpportunity {
  orgId: string;
  keyword: string;
  trendingStory: string;
  relevanceScore: number;
  suggestedAngle: string;
  alertId: string;
}

/**
 * After each collection cycle, scan trending stories for each org.
 * A trending story that doesn't yet mention the org's brand/keyword but
 * is highly relevant to the org's category = newsjacking opportunity.
 *
 * Flow:
 *   1. For each active org, get their watchlist keywords (brand + competitor types)
 *   2. Find trending stories in their categories from the last 2h
 *   3. For stories NOT mentioning brand keywords, LLM-score relevance
 *   4. If relevance >= 70%, create opportunity alert
 */
export async function detectNewsjackingOpportunities(orgId: string): Promise<NewsjackingOpportunity[]> {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // last 2h

  const org = await db
    .select({ focus: organizationsTable.focus, categories: organizationsTable.categories })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .then((r) => r[0]);

  if (!org) return [];

  const brandKeywords = await db
    .select({ keyword: watchlistKeywordsTable.keyword })
    .from(watchlistKeywordsTable)
    .where(
      and(
        eq(watchlistKeywordsTable.orgId, orgId),
        eq(watchlistKeywordsTable.isActive, true),
        eq(watchlistKeywordsTable.type, "brand"),
      ),
    );

  if (!brandKeywords.length) return [];

  const brandNames = brandKeywords.map((k) => k.keyword);
  const focus = org.focus ?? "general";
  const categories = (org.categories as string[] | null) ?? [focus];

  // Get trending stories — high engagement, not mentioning our brand
  const brandExclusionFilter = brandNames.map((brand) => {
    const p = `%${brand.replace(/[%_]/g, "\\$&")}%`;
    return sql`(${contentItemsTable.title} NOT ILIKE ${p} AND ${contentItemsTable.body} NOT ILIKE ${p})`;
  });

  const trendingStories = await db
    .select({
      title: contentItemsTable.title,
      body: contentItemsTable.body,
      platform: contentItemsTable.platform,
      category: contentItemsTable.category,
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        sql`${contentItemsTable.category} = ANY(ARRAY[${sql.join(categories.map((c) => sql`${c}`), sql`, `)}])`,
        ...brandExclusionFilter,
      ),
    )
    .orderBy(
      desc(
        sql`coalesce((${contentItemsTable.engagementMetrics}->>'likes')::numeric, 0) +
            coalesce((${contentItemsTable.engagementMetrics}->>'shares')::numeric, 0)`,
      ),
    )
    .limit(ITEMS_TO_SCAN);

  if (!trendingStories.length) return [];

  const opportunities: NewsjackingOpportunity[] = [];
  const topStories = trendingStories.slice(0, 5); // Limit LLM calls

  for (const story of topStories) {
    try {
      const prompt = `You are a newsjacking strategist. Assess whether this trending story is a relevant opportunity for a ${focus}-focused organisation.

Story: "${story.title ?? ""}"
${story.body?.slice(0, 400) ?? ""}

Return ONLY a JSON object:
{
  "relevanceScore": 0-100,
  "relevanceReason": "brief explanation",
  "suggestedAngle": "Concrete suggestion: How should the organisation insert themselves into this story? 1-2 sentences."
}

Be strict: only score >70 if the story genuinely creates a credible opportunity.`;

      const result = await chat(
        "openai",
        [{ role: "user", content: prompt }],
        { operation: "newsjacking-detect", model: "gpt-4o-mini" },
      );

      const cleaned = result.content.replace(/^```(?:json)?\s*/im, "").replace(/```\s*$/m, "").trim();
      const parsed = JSON.parse(cleaned) as { relevanceScore: number; relevanceReason: string; suggestedAngle: string };

      if (parsed.relevanceScore >= RELEVANCE_THRESHOLD) {
        const [alert] = await db
          .insert(alertsTable)
          .values({
            orgId,
            keyword: brandNames[0] ?? focus,
            type: "newsjacking",
            severity: parsed.relevanceScore >= 85 ? "high" : "medium",
            status: "new",
            payload: {
              trendingStory: story.title,
              relevanceScore: parsed.relevanceScore,
              relevanceReason: parsed.relevanceReason,
              suggestedAngle: parsed.suggestedAngle,
              platform: story.platform,
              category: story.category,
            },
          })
          .returning();

        opportunities.push({
          orgId,
          keyword: brandNames[0] ?? focus,
          trendingStory: story.title ?? "",
          relevanceScore: parsed.relevanceScore,
          suggestedAngle: parsed.suggestedAngle,
          alertId: alert!.id,
        });

        logger.info({ orgId, relevanceScore: parsed.relevanceScore, story: story.title }, "Newsjacking opportunity detected");
      }
    } catch (err) {
      logger.warn({ err, orgId, story: story.title }, "Newsjacking LLM scoring failed for story");
    }
  }

  return opportunities;
}
