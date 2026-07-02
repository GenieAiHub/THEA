import { db } from "@workspace/db";
import { contentItemsTable, watchlistKeywordsTable, organizationsTable, analysisReportsTable, usersTable } from "@workspace/db/schema";
import { eq, and, gte, desc, sql, avg, count, inArray } from "drizzle-orm";
import { chat } from "./llm";
import { getQueues } from "./queues";
import { logger } from "./logger";

export interface CompetitiveBriefingResult {
  orgId: string;
  reportId: string;
  competitorCount: number;
  generatedAt: string;
}

/**
 * Generate weekly competitive narrative briefing for a single org.
 *
 * For each competitor keyword tracked, GPT-4o summarizes:
 *   (a) what narrative did they push
 *   (b) how did it land (sentiment + reach)
 *   (c) what issues they won
 *   (d) what backfired
 *
 * Briefing stored as analysis_report + queued for email delivery.
 */
export async function generateCompetitiveBriefing(orgId: string): Promise<CompetitiveBriefingResult | null> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const org = await db
    .select({ name: organizationsTable.name, focus: organizationsTable.focus })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, orgId))
    .then((r) => r[0]);

  if (!org) return null;

  const competitors = await db
    .select({ keyword: watchlistKeywordsTable.keyword })
    .from(watchlistKeywordsTable)
    .where(
      and(
        eq(watchlistKeywordsTable.orgId, orgId),
        eq(watchlistKeywordsTable.isActive, true),
        eq(watchlistKeywordsTable.type, "competitor"),
      ),
    );

  if (!competitors.length) {
    logger.info({ orgId }, "No competitor keywords tracked — skipping competitive briefing");
    return null;
  }

  const competitorSections: string[] = [];

  for (const comp of competitors) {
    const pattern = `%${comp.keyword.replace(/[%_]/g, "\\$&")}%`;

    const items = await db
      .select({
        title: contentItemsTable.title,
        body: contentItemsTable.body,
        sentimentScore: contentItemsTable.sentimentScore,
        platform: contentItemsTable.platform,
        publishedAt: contentItemsTable.publishedAt,
        engagementMetrics: contentItemsTable.engagementMetrics,
      })
      .from(contentItemsTable)
      .where(
        and(
          eq(contentItemsTable.orgId, orgId),
          gte(contentItemsTable.collectedAt, weekAgo),
          sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
        ),
      )
      .orderBy(desc(contentItemsTable.publishedAt))
      .limit(30);

    if (!items.length) continue;

    const [stats] = await db
      .select({
        avgSentiment: avg(contentItemsTable.sentimentScore),
        totalItems: count(),
      })
      .from(contentItemsTable)
      .where(
        and(
          eq(contentItemsTable.orgId, orgId),
          gte(contentItemsTable.collectedAt, weekAgo),
          sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
        ),
      );

    const contextStr = items
      .slice(0, 15)
      .map((i, n) => {
        const eng = (i.engagementMetrics as Record<string, number> | null) ?? {};
        const reach = (eng.likes ?? 0) + (eng.shares ?? 0) + (eng.comments ?? 0);
        return `[${n + 1}] ${i.title ?? ""} [${i.platform}, sentiment: ${Number(i.sentimentScore ?? 0).toFixed(2)}, engagement: ${reach}]\n${(i.body ?? "").slice(0, 200)}`;
      })
      .join("\n---\n");

    competitorSections.push(
      `## COMPETITOR: "${comp.keyword}"\nItems this week: ${items.length}, Avg sentiment: ${Number(stats?.avgSentiment ?? 0).toFixed(2)}\n\n${contextStr}`,
    );
  }

  if (!competitorSections.length) {
    logger.info({ orgId }, "No competitor content found this week — skipping briefing");
    return null;
  }

  const systemPrompt = `You are a competitive intelligence analyst. Generate a structured weekly competitive narrative briefing.

For EACH competitor section provided, analyse and report:
(a) NARRATIVE PUSHED: What core message or story did they push this week?
(b) HOW IT LANDED: Sentiment trend, reach estimate, audience reaction
(c) WHAT THEY WON: Issues or narratives where they gained ground or positive coverage
(d) WHAT BACKFIRED: Stories, claims, or actions that drew negative reactions

Format your response as a clean briefing document with clear sections per competitor.
Be concise, evidence-based, and actionable. Focus on strategic implications.`;

  const userContent = `Organisation: ${org.name} (${org.focus} sector)\nWeek of: ${weekAgo.toDateString()} — ${new Date().toDateString()}\n\n${competitorSections.join("\n\n")}`;

  const result = await chat(
    "openai",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    { operation: "competitive-briefing", model: "gpt-4o" },
  );

  const [report] = await db
    .insert(analysisReportsTable)
    .values({
      orgId,
      category: "competitive-intelligence",
      status: "completed",
      rawReport: JSON.stringify({
        briefing: result.content,
        competitorCount: competitors.length,
        weekStart: weekAgo.toISOString(),
        type: "competitive-narrative-briefing",
      }),
    })
    .returning({ id: analysisReportsTable.id });

  // Queue email delivery to org admins
  const admins = await db
    .select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(and(eq(usersTable.orgId, orgId), inArray(usersTable.role, ["owner", "admin"])));

  if (admins.length) {
    await getQueues().emailDelivery.add(
      "competitive-briefing-email",
      {
        to: admins.map((a) => ({ email: a.email, name: a.name ?? a.email })),
        subject: `📊 THEA Weekly Competitive Briefing — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`,
        template: "competitive-briefing",
        data: {
          orgName: org.name,
          briefing: result.content,
          reportId: report!.id,
          competitorCount: competitors.length,
          weekStart: weekAgo.toDateString(),
        },
      },
      { priority: 5 },
    ).catch((err) => logger.warn({ err, orgId }, "Failed to queue competitive briefing email"));
  }

  logger.info({ orgId, reportId: report!.id, competitors: competitors.length }, "Competitive narrative briefing generated");

  return {
    orgId,
    reportId: report!.id,
    competitorCount: competitors.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Run competitive briefings for ALL orgs with competitor keywords tracked.
 * Called by the Monday 8am scheduler.
 */
export async function runWeeklyCompetitiveBriefings(): Promise<void> {
  const orgs = await db
    .selectDistinct({ orgId: watchlistKeywordsTable.orgId })
    .from(watchlistKeywordsTable)
    .where(
      and(
        eq(watchlistKeywordsTable.isActive, true),
        eq(watchlistKeywordsTable.type, "competitor"),
      ),
    );

  logger.info({ orgCount: orgs.length }, "Running weekly competitive briefings");

  await Promise.allSettled(
    orgs.map((o) =>
      generateCompetitiveBriefing(o.orgId).catch((err) =>
        logger.warn({ err, orgId: o.orgId }, "Competitive briefing failed for org"),
      ),
    ),
  );
}
