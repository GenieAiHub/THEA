import { db } from "@workspace/db";
import { contentItemsTable, alertsTable, watchlistKeywordsTable, journalistsTable } from "@workspace/db/schema";
import { eq, and, gte, desc, sql, count, isNotNull } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Daily journalist scan.
 *
 * Approach:
 *   1. Auto-upsert journalist profiles from recent content item bylines
 *      (name + outlet extracted from author + platform/source)
 *   2. For each org's active keywords, check if a known journalist published
 *      an article mentioning the keyword in the last 24h
 *   3. Create "journalist_signal" alerts for new journalist coverage
 */
export async function runJournalistScan(orgId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // ── Step 1: Auto-populate journalist profiles from bylines ───────────────────
  const bylines = await db
    .select({
      author: contentItemsTable.author,
      platform: contentItemsTable.platform,
      sourceUrl: contentItemsTable.sourceUrl,
      title: contentItemsTable.title,
      collectedAt: contentItemsTable.collectedAt,
    })
    .from(contentItemsTable)
    .where(
      and(
        eq(contentItemsTable.orgId, orgId),
        gte(contentItemsTable.collectedAt, since),
        isNotNull(contentItemsTable.author),
        sql`${contentItemsTable.platform} IN ('rss', 'news', 'web')`,
      ),
    )
    .limit(200);

  // Auto-upsert journalists — grouped by name+outlet
  const seen = new Map<string, { author: string; outlet: string; title: string; url: string; at: Date }>();
  for (const b of bylines) {
    if (!b.author) continue;
    const outlet = deriveOutlet(b.sourceUrl ?? b.platform ?? "unknown");
    const key = `${b.author.toLowerCase()}::${outlet.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, { author: b.author, outlet, title: b.title ?? "", url: b.sourceUrl ?? "", at: b.collectedAt });
    }
  }

  for (const [, { author, outlet, title, url, at }] of seen) {
    await db
      .insert(journalistsTable)
      .values({
        name: author,
        outlet,
        lastSeenAt: at,
        lastArticleTitle: title,
        lastArticleUrl: url,
        articleCountPerMonth: 1,
      })
      .onConflictDoUpdate({
        target: [journalistsTable.name, journalistsTable.outlet],
        set: {
          lastSeenAt: at,
          lastArticleTitle: title,
          lastArticleUrl: url,
          updatedAt: new Date(),
        },
      })
      .catch(() => undefined); // skip if unique constraint issue
  }

  // ── Step 2: Alert when journalist covers a tracked keyword ───────────────────
  const keywords = await db
    .select({ id: watchlistKeywordsTable.id, keyword: watchlistKeywordsTable.keyword })
    .from(watchlistKeywordsTable)
    .where(and(eq(watchlistKeywordsTable.orgId, orgId), eq(watchlistKeywordsTable.isActive, true)));

  for (const kw of keywords) {
    const pattern = `%${kw.keyword.replace(/[%_]/g, "\\$&")}%`;

    const journalistCoverage = await db
      .select({
        author: contentItemsTable.author,
        title: contentItemsTable.title,
        sourceUrl: contentItemsTable.sourceUrl,
        platform: contentItemsTable.platform,
        publishedAt: contentItemsTable.publishedAt,
      })
      .from(contentItemsTable)
      .where(
        and(
          eq(contentItemsTable.orgId, orgId),
          gte(contentItemsTable.collectedAt, since),
          isNotNull(contentItemsTable.author),
          sql`${contentItemsTable.platform} IN ('rss', 'news', 'web')`,
          sql`(${contentItemsTable.title} ILIKE ${pattern} OR ${contentItemsTable.body} ILIKE ${pattern})`,
        ),
      )
      .limit(10);

    for (const item of journalistCoverage) {
      if (!item.author) continue;
      const outlet = deriveOutlet(item.sourceUrl ?? item.platform ?? "unknown");

      await db
        .insert(alertsTable)
        .values({
          orgId,
          keywordId: kw.id,
          keyword: kw.keyword,
          type: "journalist_signal",
          severity: "low",
          status: "new",
          payload: {
            journalistName: item.author,
            outlet,
            articleTitle: item.title,
            articleUrl: item.sourceUrl,
            publishedAt: item.publishedAt?.toISOString(),
          },
        })
        .catch(() => undefined); // idempotent — ignore if already created
    }
  }

  logger.info({ orgId, journalistsUpserted: seen.size }, "Journalist scan complete");
}

function deriveOutlet(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

/**
 * Run journalist scan for ALL orgs.
 */
export async function runJournalistScanAllOrgs(): Promise<void> {
  const orgs = await db
    .selectDistinct({ orgId: watchlistKeywordsTable.orgId })
    .from(watchlistKeywordsTable)
    .where(eq(watchlistKeywordsTable.isActive, true));

  await Promise.allSettled(
    orgs.map((o) =>
      runJournalistScan(o.orgId).catch((err) =>
        logger.warn({ err, orgId: o.orgId }, "Journalist scan failed for org"),
      ),
    ),
  );
}
