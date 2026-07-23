/**
 * Share-of-voice (ai_sov) alert regression tests.
 *
 * Seeds two synthetic AI narrative runs per scenario (no LLM calls) and
 * asserts detectNarrativeShifts raises the expected ai_sov alerts:
 *   1. SoV drop only (competitor already ahead)      → medium
 *   2. Competitor overtake without a big drop        → high
 *   3. Big drop AND overtake                         → critical
 *   4. Second invocation on the same data            → 0 alerts (24h dedupe)
 *
 * Requires: dev Postgres + Redis (alert-dispatch enqueue). No LLM keys needed.
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/ai-sov-alerts.test.ts
 */

import { db } from "@workspace/db";
import {
  organizationsTable,
  subscriptionsTable,
  aiNarrativePromptsTable,
  aiNarrativeRunsTable,
  aiNarrativeResponsesTable,
  alertsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { detectNarrativeShifts } from "../lib/aiNarrative";

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

interface Scenario {
  name: string;
  brand: string;
  competitor: string;
  /** mentions per entity in the previous run */
  prev: Record<string, number>;
  /** mentions per entity in the current run */
  cur: Record<string, number>;
  expectAlert: boolean;
  expectSeverity?: string;
  expectKind?: string;
}

async function seedScenario(s: Scenario): Promise<{ orgId: string; runId: string }> {
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: `SoV Test ${s.name}`, slug: `sov-test-${s.name}-${Date.now()}`, focus: "test" })
    .returning();
  await db.insert(subscriptionsTable).values({
    orgId: org.id,
    tier: "pro",
    status: "active",
    maxKeywords: 10,
    maxCategories: 3,
    historyDays: 30,
  });

  await db.insert(aiNarrativePromptsTable).values([
    { orgId: org.id, entity: s.brand, entityType: "brand", promptText: `What can you tell me about ${s.brand}?` },
    {
      orgId: org.id,
      entity: s.competitor,
      entityType: "competitor",
      promptText: `What can you tell me about ${s.competitor}?`,
    },
  ]);

  const now = Date.now();
  const [prevRun] = await db
    .insert(aiNarrativeRunsTable)
    .values({
      orgId: org.id,
      status: "completed",
      trigger: "manual",
      startedAt: new Date(now - 2 * 60 * 60 * 1000),
      completedAt: new Date(now - 2 * 60 * 60 * 1000 + 60_000),
    })
    .returning();
  const [curRun] = await db
    .insert(aiNarrativeRunsTable)
    .values({
      orgId: org.id,
      status: "completed",
      trigger: "manual",
      startedAt: new Date(now - 60_000),
      completedAt: new Date(now),
    })
    .returning();

  const mkResponse = (runId: string, mentions: Record<string, number>) => ({
    orgId: org.id,
    runId,
    entity: s.brand,
    provider: "openai",
    model: "test-model",
    responseText: "synthetic test answer",
    sentimentScore: null, // keep sentiment stable so only SoV logic can alert
    shareOfVoice: { mentions },
  });

  await db.insert(aiNarrativeResponsesTable).values([
    mkResponse(prevRun.id, s.prev),
    mkResponse(curRun.id, s.cur),
  ]);

  return { orgId: org.id, runId: curRun.id };
}

async function cleanup(orgIds: string[]) {
  for (const orgId of orgIds) {
    await db.delete(alertsTable).where(eq(alertsTable.orgId, orgId));
    await db.delete(aiNarrativeResponsesTable).where(eq(aiNarrativeResponsesTable.orgId, orgId));
    await db.delete(aiNarrativeRunsTable).where(eq(aiNarrativeRunsTable.orgId, orgId));
    await db.delete(aiNarrativePromptsTable).where(eq(aiNarrativePromptsTable.orgId, orgId));
    await db.delete(subscriptionsTable).where(eq(subscriptionsTable.orgId, orgId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
  }
}

async function run() {
  console.log("THEA Share-of-Voice Alert Regression Tests\n");

  const scenarios: Scenario[] = [
    {
      // Brand drops 40% → 25% (−15pp ≥ 10pp threshold). Competitor was
      // already ahead in the previous run, so no overtake → medium.
      name: "drop-only",
      brand: "DropBrand",
      competitor: "DropComp",
      prev: { DropBrand: 40, DropComp: 60 },
      cur: { DropBrand: 25, DropComp: 75 },
      expectAlert: true,
      expectSeverity: "medium",
      expectKind: "sov_drop",
    },
    {
      // Brand slips only 55% → 48% (−7pp, below drop threshold), but the
      // competitor crosses from below to above → overtake → high.
      name: "overtake",
      brand: "TakeBrand",
      competitor: "TakeComp",
      prev: { TakeBrand: 55, TakeComp: 45 },
      cur: { TakeBrand: 48, TakeComp: 52 },
      expectAlert: true,
      expectSeverity: "high",
      expectKind: "sov_overtake",
    },
    {
      // Brand drops 60% → 40% (−20pp) AND competitor overtakes → critical.
      name: "both",
      brand: "BothBrand",
      competitor: "BothComp",
      prev: { BothBrand: 60, BothComp: 40 },
      cur: { BothBrand: 40, BothComp: 60 },
      expectAlert: true,
      expectSeverity: "critical",
      expectKind: "sov_drop_and_overtake",
    },
    {
      // Stable SoV (small ±2pp wiggle, no overtake) → no alert.
      name: "stable",
      brand: "CalmBrand",
      competitor: "CalmComp",
      prev: { CalmBrand: 51, CalmComp: 49 },
      cur: { CalmBrand: 53, CalmComp: 47 },
      expectAlert: false,
    },
  ];

  const orgIds: string[] = [];
  try {
    for (const s of scenarios) {
      console.log(`Scenario: ${s.name}`);
      const { orgId, runId } = await seedScenario(s);
      orgIds.push(orgId);

      const raised = await detectNarrativeShifts(orgId, runId);
      const alerts = await db
        .select()
        .from(alertsTable)
        .where(and(eq(alertsTable.orgId, orgId), eq(alertsTable.type, "ai_sov")));

      if (s.expectAlert) {
        assert(raised === 1, `raises exactly one alert (got ${raised})`);
        assert(alerts.length === 1, `one ai_sov alert row exists (got ${alerts.length})`);
        const alert = alerts[0];
        assert(alert?.keyword === s.brand, `alert keyword is the brand (${alert?.keyword})`);
        assert(
          alert?.severity === s.expectSeverity,
          `severity is ${s.expectSeverity} (got ${alert?.severity})`,
        );
        const kind = (alert?.payload as { kind?: string } | null)?.kind;
        assert(kind === s.expectKind, `payload kind is ${s.expectKind} (got ${kind})`);

        // Dedupe: re-running on the same data must raise nothing new.
        const raisedAgain = await detectNarrativeShifts(orgId, runId);
        assert(raisedAgain === 0, `second invocation raises nothing (dedupe, got ${raisedAgain})`);
        const alertsAfter = await db
          .select({ id: alertsTable.id })
          .from(alertsTable)
          .where(and(eq(alertsTable.orgId, orgId), eq(alertsTable.type, "ai_sov")));
        assert(alertsAfter.length === 1, `still exactly one alert row after dedupe (got ${alertsAfter.length})`);
      } else {
        assert(raised === 0, `raises no alert (got ${raised})`);
        assert(alerts.length === 0, `no ai_sov alert rows (got ${alerts.length})`);
      }
      console.log("");
    }
  } finally {
    await cleanup(orgIds);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
