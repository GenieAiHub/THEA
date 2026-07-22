/**
 * Security Watch camera credential-masking + role-gating integration tests.
 *
 * Creates one org with an admin and a member, inserts a camera whose
 * streamUrl embeds rtsp://user:pass@host credentials, then exercises the
 * real HTTP API (dev server) with each user's session token to assert:
 *   - admin GET /watch/cameras returns the FULL stream URL
 *   - member GET /watch/cameras returns rtsp://•••@host (credentials masked)
 *   - member PATCH /watch/cameras/:id is rejected with 403
 *   - member DELETE /watch/cameras/:id is rejected with 403
 *   - admin PATCH with the masked ••• placeholder is rejected with 400
 *
 * Requires the API Server workflow to be running (like tenant-isolation).
 * Run (from workspace root): pnpm dlx tsx artifacts/api-server/src/tests/watch-camera-masking.test.ts
 */

import { db } from "@workspace/db";
import {
  organizationsTable,
  usersTable,
  subscriptionsTable,
  sessionsTable,
  watchCamerasTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateSessionToken, hashToken, SESSION_TTL_MS } from "../lib/auth";

const API_BASE = process.env.WATCH_TEST_API_BASE ?? "http://localhost:80/api";

const SECRET_USER = "camadmin";
const SECRET_PASS = "sup3rS3cret";
const STREAM_HOST = "203.0.113.42:554";
const FULL_STREAM_URL = `rtsp://${SECRET_USER}:${SECRET_PASS}@${STREAM_HOST}/stream1`;
const MASKED_STREAM_URL = `rtsp://•••@${STREAM_HOST}/stream1`;

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

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, json, text };
}

async function setup() {
  const ts = Date.now();
  const [org] = await db
    .insert(organizationsTable)
    .values({ name: "Watch Mask Test Org", slug: `watch-mask-test-${ts}`, focus: "test" })
    .returning();

  await db.insert(subscriptionsTable).values({
    orgId: org.id,
    tier: "starter",
    status: "active",
    maxKeywords: 10,
    maxCategories: 3,
    historyDays: 14,
  });

  const [admin] = await db
    .insert(usersTable)
    .values({ orgId: org.id, email: `watch-admin-${ts}@test.local`, passwordHash: "x", role: "admin" })
    .returning();
  const [member] = await db
    .insert(usersTable)
    .values({ orgId: org.id, email: `watch-member-${ts}@test.local`, passwordHash: "x", role: "member" })
    .returning();

  const adminToken = generateSessionToken();
  const memberToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values([
    { userId: admin.id, tokenHash: hashToken(adminToken), expiresAt },
    { userId: member.id, tokenHash: hashToken(memberToken), expiresAt },
  ]);

  const [camera] = await db
    .insert(watchCamerasTable)
    .values({
      orgId: org.id,
      name: "Mask Test Camera",
      location: "Test Gate",
      streamUrl: FULL_STREAM_URL,
      sampleIntervalSec: 60,
      isActive: false,
    })
    .returning();

  return { org, admin, member, adminToken, memberToken, camera };
}

async function cleanup(orgId: string, tokenHashes: string[]) {
  await db.delete(watchCamerasTable).where(eq(watchCamerasTable.orgId, orgId));
  await db.delete(sessionsTable).where(inArray(sessionsTable.tokenHash, tokenHashes));
  await db.delete(usersTable).where(eq(usersTable.orgId, orgId));
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.orgId, orgId));
  await db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
}

async function run() {
  console.log("THEA Security Watch — Camera Credential Masking & Role Gating Tests\n");
  console.log(`API base: ${API_BASE}\n`);

  const { org, adminToken, memberToken, camera } = await setup();

  try {
    console.log("GET /v1/watch/cameras — admin sees full credentials:");
    const adminList = await api(adminToken, "GET", "/v1/watch/cameras");
    assert(adminList.status === 200, `admin list returns 200 (got ${adminList.status})`);
    const adminCam = adminList.json?.data?.find((c: any) => c.id === camera.id);
    assert(!!adminCam, "admin list includes the test camera");
    assert(adminCam?.streamUrl === FULL_STREAM_URL, "admin sees the FULL rtsp://user:pass@host URL");

    console.log("\nGET /v1/watch/cameras — member sees masked credentials:");
    const memberList = await api(memberToken, "GET", "/v1/watch/cameras");
    assert(memberList.status === 200, `member list returns 200 (got ${memberList.status})`);
    const memberCam = memberList.json?.data?.find((c: any) => c.id === camera.id);
    assert(!!memberCam, "member list includes the test camera");
    assert(memberCam?.streamUrl === MASKED_STREAM_URL, `member sees masked URL rtsp://•••@host (got ${memberCam?.streamUrl})`);
    assert(!memberList.text.includes(SECRET_PASS), "camera password never appears anywhere in the member response body");
    assert(!memberList.text.includes(`${SECRET_USER}:`), "camera username:... userinfo never appears in the member response body");

    console.log("\nPATCH /v1/watch/cameras/:id — member is role-blocked:");
    const memberPatch = await api(memberToken, "PATCH", `/v1/watch/cameras/${camera.id}`, { name: "Hacked Name" });
    assert(memberPatch.status === 403, `member PATCH rejected with 403 (got ${memberPatch.status})`);

    console.log("\nDELETE /v1/watch/cameras/:id — member is role-blocked:");
    const memberDelete = await api(memberToken, "DELETE", `/v1/watch/cameras/${camera.id}`);
    assert(memberDelete.status === 403, `member DELETE rejected with 403 (got ${memberDelete.status})`);
    const [stillThere] = await db.select({ id: watchCamerasTable.id }).from(watchCamerasTable).where(eq(watchCamerasTable.id, camera.id));
    assert(!!stillThere, "camera row still exists after member DELETE attempt");

    console.log("\nPATCH with masked placeholder — rejected so ••• never overwrites real creds:");
    const maskedPatch = await api(adminToken, "PATCH", `/v1/watch/cameras/${camera.id}`, { streamUrl: MASKED_STREAM_URL });
    assert(maskedPatch.status === 400, `admin PATCH with rtsp://•••@host rejected with 400 (got ${maskedPatch.status})`);
    const [afterPatch] = await db.select({ streamUrl: watchCamerasTable.streamUrl }).from(watchCamerasTable).where(eq(watchCamerasTable.id, camera.id));
    assert(afterPatch?.streamUrl === FULL_STREAM_URL, "stored streamUrl unchanged after rejected masked PATCH");

    console.log("\nPATCH /v1/watch/cameras/:id — admin CAN edit (sanity check):");
    const adminPatch = await api(adminToken, "PATCH", `/v1/watch/cameras/${camera.id}`, { name: "Renamed by Admin" });
    assert(adminPatch.status === 200, `admin PATCH returns 200 (got ${adminPatch.status})`);
    assert(adminPatch.json?.name === "Renamed by Admin", "admin PATCH applied the new name");
  } finally {
    await cleanup(org.id, [hashToken(adminToken), hashToken(memberToken)]);
  }

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

run().catch(async (err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
