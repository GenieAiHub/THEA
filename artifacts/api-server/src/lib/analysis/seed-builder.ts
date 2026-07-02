import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { gte, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

const SEED_ITEM_LIMIT = 100;
const DEFAULT_WINDOW_HOURS = 24;

interface SeedItem {
  title: string | null;
  summary: string | null;
  body: string;
  platform: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
  sentimentScore: number | null;
  engagementScore: number;
  entities: Array<{ name: string; type: string }>;
}

function formatEntityList(entities: unknown): string {
  if (!Array.isArray(entities)) return "";
  return (entities as Array<{ name: string; type: string }>)
    .slice(0, 5)
    .map((e) => `${e.name} (${e.type})`)
    .join(", ");
}

function sentimentLabel(score: number | null): string {
  if (score === null) return "neutral";
  if (score > 0.3) return `positive (${score.toFixed(2)})`;
  if (score < -0.3) return `negative (${score.toFixed(2)})`;
  return `neutral (${score.toFixed(2)})`;
}

export async function buildSeedDocument(
  category: string,
  windowHours = DEFAULT_WINDOW_HOURS
): Promise<{ document: string; itemCount: number }> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const engagementExpr = sql<number>`
    COALESCE(
      (engagement_metrics->>'likes')::float * 1.0 +
      (engagement_metrics->>'shares')::float * 2.0 +
      (engagement_metrics->>'comments')::float * 1.5 +
      (engagement_metrics->>'views')::float * 0.1,
      0
    )
  `;

  const rows = await db
    .select({
      title: contentItemsTable.title,
      summary: contentItemsTable.summary,
      body: contentItemsTable.body,
      platform: contentItemsTable.platform,
      sourceUrl: contentItemsTable.sourceUrl,
      publishedAt: contentItemsTable.publishedAt,
      sentimentScore: contentItemsTable.sentimentScore,
      entities: contentItemsTable.entities,
      engagementScore: engagementExpr,
    })
    .from(contentItemsTable)
    .where(
      and(
        sql`LOWER(${contentItemsTable.category}) = LOWER(${category})`,
        gte(contentItemsTable.collectedAt, since)
      )
    )
    .orderBy(desc(engagementExpr), desc(contentItemsTable.collectedAt))
    .limit(SEED_ITEM_LIMIT);

  if (!rows.length) {
    logger.warn({ category, windowHours }, "No content items found for seed document");
    return {
      document: `# Intelligence Seed — ${category}\n\nNo content available for this window.`,
      itemCount: 0,
    };
  }

  const windowEnd = new Date();
  const windowStart = since;

  const lines: string[] = [
    `# Intelligence Seed Document — ${category}`,
    `**Analysis Window:** ${windowStart.toISOString()} → ${windowEnd.toISOString()}`,
    `**Items:** ${rows.length} articles selected by engagement + recency`,
    `**Generated:** ${windowEnd.toISOString()}`,
    "",
    "---",
    "",
  ];

  rows.forEach((row, idx) => {
    const entities = formatEntityList(row.entities);
    const body = (row.summary || row.body).slice(0, 300);

    lines.push(`## Article ${idx + 1}`);
    lines.push(`**Source:** ${row.platform} | **Sentiment:** ${sentimentLabel(row.sentimentScore)}`);
    if (row.publishedAt) lines.push(`**Published:** ${row.publishedAt.toISOString()}`);
    if (row.title) lines.push(`**Title:** ${row.title}`);
    lines.push(`**Content:** ${body}`);
    if (entities) lines.push(`**Key Entities:** ${entities}`);
    lines.push("");
  });

  const document = lines.join("\n");
  logger.info({ category, windowHours, itemCount: rows.length, docLength: document.length }, "Seed document built");

  return { document, itemCount: rows.length };
}
