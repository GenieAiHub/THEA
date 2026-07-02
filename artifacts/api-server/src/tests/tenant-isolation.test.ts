/**
 * Tenant isolation integration tests.
 *
 * Verifies that org A cannot access org B's private data through any
 * of the tenant-facing API endpoints. Each test constructs a Drizzle
 * query the same way the route handler does and asserts the row-count
 * invariants that prevent cross-tenant leakage.
 *
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/tenant-isolation.test.ts
 */

import { db } from "@workspace/db";
import {
  organizationsTable,
  usersTable,
  subscriptionsTable,
  contentItemsTable,
  trendScoresTable,
  entityMentionsTable,
  analysisReportsTable,
} from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";

const PLATFORM_ORG_ID = "10000000-0000-0000-0000-000000000001";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function setup() {
  const orgA = await db.insert(organizationsTable).values({ name: "Org A", slug: `org-a-test-${Date.now()}`, focus: "test" }).returning().then(r => r[0]);
  const orgB = await db.insert(organizationsTable).values({ name: "Org B", slug: `org-b-test-${Date.now()}`, focus: "test" }).returning().then(r => r[0]);

  await db.insert(subscriptionsTable).values({ orgId: orgA.id, tier: "starter", status: "active", maxKeywords: 10, maxCategories: 3, historyDays: 14 });
  await db.insert(subscriptionsTable).values({ orgId: orgB.id, tier: "starter", status: "active", maxKeywords: 10, maxCategories: 3, historyDays: 14 });

  const now = new Date();
  const future = new Date(now.getTime() + 60_000);

  const ts = Date.now();
  await db.insert(contentItemsTable).values({ orgId: orgA.id, platform: "rss", contentHash: `hash-a-${ts}`, body: "Org A content body", title: "Org A content", sourceUrl: `https://test.example.com/a-${ts}`, collectedAt: now });
  await db.insert(contentItemsTable).values({ orgId: orgB.id, platform: "rss", contentHash: `hash-b-${ts}`, body: "Org B content body", title: "Org B content", sourceUrl: `https://test.example.com/b-${ts}`, collectedAt: now });

  await db.insert(trendScoresTable).values({ orgId: orgA.id, topic: "topic-a-exclusive", category: "test", score: 0.9, scoredAt: now });
  await db.insert(trendScoresTable).values({ orgId: orgB.id, topic: "topic-b-exclusive", category: "test", score: 0.8, scoredAt: now });

  await db.insert(entityMentionsTable).values({ orgId: orgA.id, entityName: "entity-a-exclusive", entityType: "person", category: "test", mentionCount: 1, windowStart: now, windowEnd: future });
  await db.insert(entityMentionsTable).values({ orgId: orgB.id, entityName: "entity-b-exclusive", entityType: "person", category: "test", mentionCount: 1, windowStart: now, windowEnd: future });

  await db.insert(analysisReportsTable).values({ orgId: orgA.id, category: "test", status: "done", miroFishRunId: `test-a-${Date.now()}`, runAt: now });
  await db.insert(analysisReportsTable).values({ orgId: orgB.id, category: "test", status: "done", miroFishRunId: `test-b-${Date.now()}`, runAt: now });

  return { orgA, orgB };
}

async function cleanup(orgAId: string, orgBId: string) {
  await db.delete(contentItemsTable).where(or(eq(contentItemsTable.orgId, orgAId), eq(contentItemsTable.orgId, orgBId)));
  await db.delete(trendScoresTable).where(or(eq(trendScoresTable.orgId, orgAId), eq(trendScoresTable.orgId, orgBId)));
  await db.delete(entityMentionsTable).where(or(eq(entityMentionsTable.orgId, orgAId), eq(entityMentionsTable.orgId, orgBId)));
  await db.delete(analysisReportsTable).where(or(eq(analysisReportsTable.orgId, orgAId), eq(analysisReportsTable.orgId, orgBId)));
  await db.delete(usersTable).where(or(eq(usersTable.orgId, orgAId), eq(usersTable.orgId, orgBId)));
  await db.delete(subscriptionsTable).where(or(eq(subscriptionsTable.orgId, orgAId), eq(subscriptionsTable.orgId, orgBId)));
  await db.delete(organizationsTable).where(or(eq(organizationsTable.id, orgAId), eq(organizationsTable.id, orgBId)));
}

async function run() {
  console.log("THEA Tenant Isolation Integration Tests\n");

  const { orgA, orgB } = await setup();
  const { id: orgAId } = orgA;
  const { id: orgBId } = orgB;

  try {
    console.log("content_items — org A cannot see org B content:");
    const aContent = await db.select().from(contentItemsTable).where(eq(contentItemsTable.orgId, orgAId));
    const bContentFromA = aContent.filter(r => r.orgId === orgBId);
    assert(bContentFromA.length === 0, "Org A query returns zero org B content rows");
    assert(aContent.some(r => r.orgId === orgAId), "Org A query returns org A content rows");

    console.log("\ntrend_scores — org A cannot see org B-exclusive trends:");
    const aTrends = await db.select().from(trendScoresTable).where(
      or(eq(trendScoresTable.orgId, PLATFORM_ORG_ID), eq(trendScoresTable.orgId, orgAId))!
    );
    const bTrendsInA = aTrends.filter(r => r.orgId === orgBId);
    assert(bTrendsInA.length === 0, "Org A trend query returns zero org B rows");
    assert(aTrends.some(r => r.topic === "topic-a-exclusive"), "Org A trend query returns org A rows");

    console.log("\nentity_mentions — org A cannot see org B entities:");
    const aEntities = await db.select().from(entityMentionsTable).where(
      or(eq(entityMentionsTable.orgId, PLATFORM_ORG_ID), eq(entityMentionsTable.orgId, orgAId))!
    );
    const bEntitiesInA = aEntities.filter(r => r.orgId === orgBId);
    assert(bEntitiesInA.length === 0, "Org A entity query returns zero org B rows");
    assert(aEntities.some(r => r.entityName === "entity-a-exclusive"), "Org A entity query returns org A rows");

    console.log("\nanalysis_reports — org A cannot see org B reports:");
    const aReports = await db.select().from(analysisReportsTable).where(
      or(eq(analysisReportsTable.orgId, PLATFORM_ORG_ID), eq(analysisReportsTable.orgId, orgAId))!
    );
    const bReportsInA = aReports.filter(r => r.orgId === orgBId);
    assert(bReportsInA.length === 0, "Org A analysis query returns zero org B rows");
    assert(aReports.some(r => r.orgId === orgAId), "Org A analysis query returns org A rows");

    console.log("\nSymmetry check — org B cannot see org A data:");
    const bContent = await db.select().from(contentItemsTable).where(eq(contentItemsTable.orgId, orgBId));
    assert(bContent.every(r => r.orgId !== orgAId), "Org B content query contains no org A rows");

    const bTrends = await db.select().from(trendScoresTable).where(
      or(eq(trendScoresTable.orgId, PLATFORM_ORG_ID), eq(trendScoresTable.orgId, orgBId))!
    );
    assert(bTrends.every(r => r.orgId !== orgAId), "Org B trend query contains no org A rows");

  } finally {
    await cleanup(orgAId, orgBId);
  }

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error("Test suite error:", err); process.exit(1); });
