import { Router, type Request, type Response, type NextFunction } from "express";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import {
  mmpAppsTable,
  mmpTrackingLinksTable,
  mmpClicksTable,
  mmpInstallsTable,
  mmpEventsTable,
  type MmpApp,
} from "@workspace/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { logger } from "../../lib/logger";

const router = Router();

const CLICK_ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function hashIp(salt: string, ip: string): string {
  return createHash("sha256").update(`${salt}${ip}`).digest("hex");
}

function clientIp(req: Request): string {
  return req.ip || "0.0.0.0";
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function newLinkCode(): string {
  // 10 chars base36 — globally unique short code for the tracking URL.
  return randomBytes(8).toString("hex").slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC — click tracking redirect (no auth; covered by global rate limiter)
// GET /api/v1/mmp/c/:code
// ═══════════════════════════════════════════════════════════════════════════
router.get("/c/:code", async (req, res) => {
  const code = req.params.code as string;
  const [row] = await db
    .select({
      linkId: mmpTrackingLinksTable.id,
      appId: mmpTrackingLinksTable.appId,
      orgId: mmpTrackingLinksTable.orgId,
      destinationUrl: mmpTrackingLinksTable.destinationUrl,
      ipSalt: mmpAppsTable.ipSalt,
    })
    .from(mmpTrackingLinksTable)
    .innerJoin(mmpAppsTable, eq(mmpTrackingLinksTable.appId, mmpAppsTable.id))
    .where(eq(mmpTrackingLinksTable.code, code));

  if (!row) {
    res.status(404).json({ error: "Unknown tracking link" });
    return;
  }

  try {
    await db.insert(mmpClicksTable).values({
      orgId: row.orgId,
      appId: row.appId,
      linkId: row.linkId,
      ipHash: hashIp(row.ipSalt, clientIp(req)),
      userAgent: (req.headers["user-agent"] || "").slice(0, 500) || null,
      referer: (req.headers.referer || "").slice(0, 500) || null,
      country: (req.headers["cf-ipcountry"] as string | undefined) || null,
    });
  } catch (err) {
    logger.warn({ err, code }, "mmp click insert failed — redirecting anyway");
  }

  res.redirect(302, row.destinationUrl);
});

// ═══════════════════════════════════════════════════════════════════════════
// S2S INGEST — authenticated by per-app ingest token (X-Ingest-Token: mmpi_…)
// ═══════════════════════════════════════════════════════════════════════════
interface IngestRequest extends Request {
  mmpApp?: MmpApp;
}

async function requireIngestToken(req: IngestRequest, res: Response, next: NextFunction): Promise<void> {
  const token = (req.headers["x-ingest-token"] as string | undefined)?.trim();
  if (!token || !token.startsWith("mmpi_")) {
    res.status(401).json({ error: "Missing or invalid X-Ingest-Token header" });
    return;
  }
  const [app] = await db.select().from(mmpAppsTable).where(eq(mmpAppsTable.ingestToken, token));
  if (!app) {
    res.status(401).json({ error: "Unknown ingest token" });
    return;
  }
  req.mmpApp = app;
  next();
}

// POST /api/v1/mmp/ingest/install  { deviceId }
router.post("/ingest/install", requireIngestToken, async (req: IngestRequest, res) => {
  const app = req.mmpApp!;
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId || typeof deviceId !== "string" || deviceId.length > 200) {
    res.status(400).json({ error: "deviceId (string, ≤200 chars) is required" });
    return;
  }

  // Idempotent: unique(appId, deviceId) — return the existing install if repeated.
  const [existing] = await db
    .select()
    .from(mmpInstallsTable)
    .where(and(eq(mmpInstallsTable.appId, app.id), eq(mmpInstallsTable.deviceId, deviceId)));
  if (existing) {
    res.json({ install: existing, deduplicated: true });
    return;
  }

  // Last-click attribution within the 7-day window, matched by IP hash.
  // NOTE (MVP): fingerprinting by IP is approximate — NAT/carrier IPs reduce accuracy.
  const windowStart = new Date(Date.now() - CLICK_ATTRIBUTION_WINDOW_MS);
  const ipHash = hashIp(app.ipSalt, clientIp(req));
  const [lastClick] = await db
    .select({ linkId: mmpClicksTable.linkId })
    .from(mmpClicksTable)
    .where(and(
      eq(mmpClicksTable.appId, app.id),
      eq(mmpClicksTable.ipHash, ipHash),
      gte(mmpClicksTable.createdAt, windowStart),
    ))
    .orderBy(desc(mmpClicksTable.createdAt))
    .limit(1);

  const [install] = await db
    .insert(mmpInstallsTable)
    .values({
      orgId: app.orgId,
      appId: app.id,
      deviceId,
      attributedLinkId: lastClick?.linkId ?? null,
      method: lastClick ? "fingerprint" : "organic",
    })
    .onConflictDoNothing()
    .returning();

  if (!install) {
    // Raced with a concurrent identical ping — fetch the winner.
    const [raced] = await db
      .select()
      .from(mmpInstallsTable)
      .where(and(eq(mmpInstallsTable.appId, app.id), eq(mmpInstallsTable.deviceId, deviceId)));
    res.json({ install: raced, deduplicated: true });
    return;
  }
  res.status(201).json({ install, deduplicated: false });
});

// POST /api/v1/mmp/ingest/event  { deviceId, name, revenue? (USD) }
router.post("/ingest/event", requireIngestToken, async (req: IngestRequest, res) => {
  const app = req.mmpApp!;
  const { deviceId, name, revenue } = req.body as { deviceId?: string; name?: string; revenue?: number };
  if (!name || typeof name !== "string" || name.length > 100) {
    res.status(400).json({ error: "name (string, ≤100 chars) is required" });
    return;
  }
  if (revenue !== undefined && (typeof revenue !== "number" || !Number.isFinite(revenue) || revenue < 0)) {
    res.status(400).json({ error: "revenue must be a non-negative number (USD)" });
    return;
  }

  let installId: string | null = null;
  if (deviceId && typeof deviceId === "string") {
    const [install] = await db
      .select({ id: mmpInstallsTable.id })
      .from(mmpInstallsTable)
      .where(and(eq(mmpInstallsTable.appId, app.id), eq(mmpInstallsTable.deviceId, deviceId)));
    installId = install?.id ?? null;
  }

  const [event] = await db
    .insert(mmpEventsTable)
    .values({
      orgId: app.orgId,
      appId: app.id,
      installId,
      name,
      revenueMicro: BigInt(Math.round((revenue ?? 0) * 1_000_000)),
    })
    .returning({ id: mmpEventsTable.id, name: mmpEventsTable.name, createdAt: mmpEventsTable.createdAt });

  res.status(201).json({ event });
});

// ═══════════════════════════════════════════════════════════════════════════
// PORTAL — org-scoped management + analytics (cookie session auth)
// ═══════════════════════════════════════════════════════════════════════════
router.use(requireAuth);

// ─── Apps ─────────────────────────────────────────────────────────────────
router.get("/apps", async (req, res) => {
  const orgId = req.thea!.org.id;
  const apps = await db
    .select()
    .from(mmpAppsTable)
    .where(eq(mmpAppsTable.orgId, orgId))
    .orderBy(desc(mmpAppsTable.createdAt));
  res.json({ count: apps.length, data: apps });
});

router.post("/apps", requireRole("owner", "admin"), async (req, res) => {
  const { name, platform } = req.body as { name?: string; platform?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const plat = ["android", "ios", "web"].includes(platform || "") ? platform! : "android";
  const [app] = await db
    .insert(mmpAppsTable)
    .values({
      orgId: req.thea!.org.id,
      name: name.trim().slice(0, 100),
      platform: plat,
      ingestToken: `mmpi_${randomBytes(24).toString("hex")}`,
      ipSalt: randomBytes(16).toString("hex"),
    })
    .returning();
  res.status(201).json(app);
});

router.post("/apps/:id/regenerate-token", requireRole("owner", "admin"), async (req, res) => {
  const [app] = await db
    .update(mmpAppsTable)
    .set({ ingestToken: `mmpi_${randomBytes(24).toString("hex")}`, updatedAt: new Date() })
    .where(and(eq(mmpAppsTable.id, req.params.id as string), eq(mmpAppsTable.orgId, req.thea!.org.id)))
    .returning();
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }
  res.json(app);
});

router.delete("/apps/:id", requireRole("owner", "admin"), async (req, res) => {
  const [app] = await db
    .delete(mmpAppsTable)
    .where(and(eq(mmpAppsTable.id, req.params.id as string), eq(mmpAppsTable.orgId, req.thea!.org.id)))
    .returning({ id: mmpAppsTable.id });
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }
  res.json({ deleted: true });
});

// ─── Tracking links ──────────────────────────────────────────────────────────
router.get("/links", async (req, res) => {
  const orgId = req.thea!.org.id;
  const appId = req.query.appId as string | undefined;
  const where = appId
    ? and(eq(mmpTrackingLinksTable.orgId, orgId), eq(mmpTrackingLinksTable.appId, appId))
    : eq(mmpTrackingLinksTable.orgId, orgId);
  const links = await db
    .select()
    .from(mmpTrackingLinksTable)
    .where(where)
    .orderBy(desc(mmpTrackingLinksTable.createdAt));
  res.json({ count: links.length, data: links });
});

router.post("/links", requireRole("owner", "admin"), async (req, res) => {
  const { appId, name, channel, destinationUrl } = req.body as {
    appId?: string; name?: string; channel?: string; destinationUrl?: string;
  };
  if (!appId || !name?.trim() || !destinationUrl) {
    res.status(400).json({ error: "appId, name and destinationUrl are required" });
    return;
  }
  if (!isValidHttpUrl(destinationUrl)) {
    res.status(400).json({ error: "destinationUrl must be a valid http(s) URL" });
    return;
  }
  const orgId = req.thea!.org.id;
  const [app] = await db
    .select({ id: mmpAppsTable.id })
    .from(mmpAppsTable)
    .where(and(eq(mmpAppsTable.id, appId), eq(mmpAppsTable.orgId, orgId)));
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }
  const [link] = await db
    .insert(mmpTrackingLinksTable)
    .values({
      orgId,
      appId,
      name: name.trim().slice(0, 100),
      channel: (channel || "other").slice(0, 50),
      code: newLinkCode(),
      destinationUrl,
    })
    .returning();
  res.status(201).json(link);
});

router.delete("/links/:id", requireRole("owner", "admin"), async (req, res) => {
  const [link] = await db
    .delete(mmpTrackingLinksTable)
    .where(and(eq(mmpTrackingLinksTable.id, req.params.id as string), eq(mmpTrackingLinksTable.orgId, req.thea!.org.id)))
    .returning({ id: mmpTrackingLinksTable.id });
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }
  res.json({ deleted: true });
});

// ─── Stats ────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function statsWindow(req: Request): { since: Date; appId?: string } {
  const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10) || 30, 1), 365);
  const rawAppId = (req.query.appId as string | undefined) || undefined;
  return {
    since: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    appId: rawAppId && UUID_RE.test(rawAppId) ? rawAppId : undefined,
  };
}

router.get("/stats/summary", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { since, appId } = statsWindow(req);

  const clickWhere = and(
    eq(mmpClicksTable.orgId, orgId),
    gte(mmpClicksTable.createdAt, since),
    ...(appId ? [eq(mmpClicksTable.appId, appId)] : []),
  );
  const installWhere = and(
    eq(mmpInstallsTable.orgId, orgId),
    gte(mmpInstallsTable.createdAt, since),
    ...(appId ? [eq(mmpInstallsTable.appId, appId)] : []),
  );
  const eventWhere = and(
    eq(mmpEventsTable.orgId, orgId),
    gte(mmpEventsTable.createdAt, since),
    ...(appId ? [eq(mmpEventsTable.appId, appId)] : []),
  );

  const [[clicks], [installs], [events]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(mmpClicksTable).where(clickWhere),
    db.select({
      n: sql<number>`count(*)::int`,
      attributed: sql<number>`count(*) filter (where ${mmpInstallsTable.attributedLinkId} is not null)::int`,
    }).from(mmpInstallsTable).where(installWhere),
    db.select({
      n: sql<number>`count(*)::int`,
      revenueUsd: sql<number>`coalesce(sum(${mmpEventsTable.revenueMicro}), 0)::float8 / 1e6`,
    }).from(mmpEventsTable).where(eventWhere),
  ]);

  res.json({
    clicks: clicks?.n ?? 0,
    installs: installs?.n ?? 0,
    attributedInstalls: installs?.attributed ?? 0,
    organicInstalls: (installs?.n ?? 0) - (installs?.attributed ?? 0),
    events: events?.n ?? 0,
    revenueUsd: events?.revenueUsd ?? 0,
  });
});

router.get("/stats/timeseries", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { since, appId } = statsWindow(req);

  const day = (col: unknown) => sql<string>`to_char(date_trunc('day', ${col}), 'YYYY-MM-DD')`;

  const [clicks, installs] = await Promise.all([
    db.select({ day: day(mmpClicksTable.createdAt), n: sql<number>`count(*)::int` })
      .from(mmpClicksTable)
      .where(and(
        eq(mmpClicksTable.orgId, orgId),
        gte(mmpClicksTable.createdAt, since),
        ...(appId ? [eq(mmpClicksTable.appId, appId)] : []),
      ))
      .groupBy(sql`1`).orderBy(sql`1`),
    db.select({ day: day(mmpInstallsTable.createdAt), n: sql<number>`count(*)::int` })
      .from(mmpInstallsTable)
      .where(and(
        eq(mmpInstallsTable.orgId, orgId),
        gte(mmpInstallsTable.createdAt, since),
        ...(appId ? [eq(mmpInstallsTable.appId, appId)] : []),
      ))
      .groupBy(sql`1`).orderBy(sql`1`),
  ]);

  const byDay = new Map<string, { day: string; clicks: number; installs: number }>();
  for (const c of clicks) {
    byDay.set(c.day, { day: c.day, clicks: c.n, installs: 0 });
  }
  for (const i of installs) {
    const row = byDay.get(i.day) || { day: i.day, clicks: 0, installs: 0 };
    row.installs = i.n;
    byDay.set(i.day, row);
  }
  res.json({ data: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)) });
});

router.get("/stats/breakdown", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { since, appId } = statsWindow(req);

  const links = await db
    .select()
    .from(mmpTrackingLinksTable)
    .where(appId
      ? and(eq(mmpTrackingLinksTable.orgId, orgId), eq(mmpTrackingLinksTable.appId, appId))
      : eq(mmpTrackingLinksTable.orgId, orgId));

  const [clicksByLink, installsByLink, revenueByLink] = await Promise.all([
    db.select({ linkId: mmpClicksTable.linkId, n: sql<number>`count(*)::int` })
      .from(mmpClicksTable)
      .where(and(
        eq(mmpClicksTable.orgId, orgId),
        gte(mmpClicksTable.createdAt, since),
        ...(appId ? [eq(mmpClicksTable.appId, appId)] : []),
      ))
      .groupBy(mmpClicksTable.linkId),
    db.select({ linkId: mmpInstallsTable.attributedLinkId, n: sql<number>`count(*)::int` })
      .from(mmpInstallsTable)
      .where(and(
        eq(mmpInstallsTable.orgId, orgId),
        gte(mmpInstallsTable.createdAt, since),
        ...(appId ? [eq(mmpInstallsTable.appId, appId)] : []),
      ))
      .groupBy(mmpInstallsTable.attributedLinkId),
    db.select({
      linkId: mmpInstallsTable.attributedLinkId,
      revenueUsd: sql<number>`coalesce(sum(${mmpEventsTable.revenueMicro}), 0)::float8 / 1e6`,
    })
      .from(mmpEventsTable)
      .innerJoin(mmpInstallsTable, eq(mmpEventsTable.installId, mmpInstallsTable.id))
      .where(and(
        eq(mmpEventsTable.orgId, orgId),
        gte(mmpEventsTable.createdAt, since),
        ...(appId ? [eq(mmpEventsTable.appId, appId)] : []),
      ))
      .groupBy(mmpInstallsTable.attributedLinkId),
  ]);

  const clickMap = new Map(clicksByLink.map((r) => [r.linkId, r.n]));
  const installMap = new Map(installsByLink.map((r) => [r.linkId, r.n]));
  const revenueMap = new Map(revenueByLink.map((r) => [r.linkId, r.revenueUsd]));

  const data = links.map((l) => ({
    linkId: l.id,
    appId: l.appId,
    name: l.name,
    channel: l.channel,
    code: l.code,
    clicks: clickMap.get(l.id) ?? 0,
    installs: installMap.get(l.id) ?? 0,
    revenueUsd: revenueMap.get(l.id) ?? 0,
  }));

  // Organic bucket (installs with no attributed link)
  const organicInstalls = installMap.get(null as unknown as string) ?? 0;
  const organicRevenue = revenueMap.get(null as unknown as string) ?? 0;

  res.json({ data, organic: { installs: organicInstalls, revenueUsd: organicRevenue } });
});

export default router;
