import { Router, type Request, type Response, type NextFunction } from "express";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import {
  mmpAppsTable,
  mmpTrackingLinksTable,
  mmpClicksTable,
  mmpInstallsTable,
  mmpEventsTable,
  mmpCreatorsTable,
  mmpLinkCostsTable,
  mmpIngestLogTable,
  type MmpApp,
} from "@workspace/db/schema";
import { eq, and, desc, gte, lt, sql, isNull } from "drizzle-orm";
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
  // 10 hex chars (~40 bits) — globally unique short code for the tracking URL.
  return randomBytes(8).toString("hex").slice(0, 10);
}

/** Deep links allow custom app schemes (myapp://…) but never script/data URIs. */
const FORBIDDEN_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:"]);
function isValidDeepLink(value: string): boolean {
  if (value.length > 500) return false;
  try {
    const u = new URL(value);
    return /^[a-z][a-z0-9+.-]*:$/i.test(u.protocol) && !FORBIDDEN_SCHEMES.has(u.protocol.toLowerCase());
  } catch {
    return false;
  }
}

// Ingest-time fraud heuristics (T207)
const CTIT_MIN_MS = 10_000; // click-to-install faster than 10s = bot-like
const CLICK_FLOOD_PER_DAY = 50; // >50 clicks/day from one ipHash = flooding

const INGEST_LOG_RETENTION_MS = 72 * 60 * 60 * 1000;

/**
 * Fire-and-forget ingest log for the SDK debugger. Payload is the JSON body
 * only (the ingest token travels in a header and is never logged), truncated
 * to 2KB. Old rows are pruned opportunistically (~2% of inserts).
 */
function logIngest(entry: {
  orgId?: string | null;
  appId?: string | null;
  kind: "install" | "event" | "uninstall";
  status: "ok" | "rejected";
  reason?: string;
  body?: unknown;
}): void {
  let payload: string | null = null;
  try {
    payload = entry.body === undefined ? null : JSON.stringify(entry.body).slice(0, 2048);
  } catch {
    payload = "[unserializable]";
  }
  void db
    .insert(mmpIngestLogTable)
    .values({
      orgId: entry.orgId ?? null,
      appId: entry.appId ?? null,
      kind: entry.kind,
      status: entry.status,
      reason: entry.reason ?? null,
      payload,
    })
    .then(async () => {
      if (Math.random() < 0.02) {
        await db
          .delete(mmpIngestLogTable)
          .where(lt(mmpIngestLogTable.createdAt, new Date(Date.now() - INGEST_LOG_RETENTION_MS)));
      }
    })
    .catch((err) => logger.warn({ err }, "mmp ingest log write failed"));
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
    logIngest({ orgId: app.orgId, appId: app.id, kind: "install", status: "rejected", reason: "deviceId (string, ≤200 chars) is required", body: req.body });
    res.status(400).json({ error: "deviceId (string, ≤200 chars) is required" });
    return;
  }

  // Idempotent: unique(appId, deviceId) — return the existing install if repeated.
  const [existing] = await db
    .select()
    .from(mmpInstallsTable)
    .where(and(eq(mmpInstallsTable.appId, app.id), eq(mmpInstallsTable.deviceId, deviceId)));
  if (existing) {
    logIngest({ orgId: app.orgId, appId: app.id, kind: "install", status: "ok", reason: "deduplicated", body: req.body });
    res.json({ install: existing, deduplicated: true });
    return;
  }

  // Last-click attribution within the 7-day window, matched by IP hash.
  // NOTE (MVP): fingerprinting by IP is approximate — NAT/carrier IPs reduce accuracy.
  const windowStart = new Date(Date.now() - CLICK_ATTRIBUTION_WINDOW_MS);
  const ipHash = hashIp(app.ipSalt, clientIp(req));
  const [lastClick] = await db
    .select({
      clickId: mmpClicksTable.id,
      linkId: mmpClicksTable.linkId,
      clickAt: mmpClicksTable.createdAt,
      deepLinkUrl: mmpTrackingLinksTable.deepLinkUrl,
    })
    .from(mmpClicksTable)
    .innerJoin(mmpTrackingLinksTable, eq(mmpClicksTable.linkId, mmpTrackingLinksTable.id))
    .where(and(
      eq(mmpClicksTable.appId, app.id),
      eq(mmpClicksTable.ipHash, ipHash),
      gte(mmpClicksTable.createdAt, windowStart),
    ))
    .orderBy(desc(mmpClicksTable.createdAt))
    .limit(1);

  // Ingest-time fraud heuristics — flagged installs stay attributed but are
  // excluded from attributed stats and surfaced in the health monitor.
  let suspectReason: string | null = null;
  if (lastClick) {
    const ctitMs = Date.now() - lastClick.clickAt.getTime();
    if (ctitMs < CTIT_MIN_MS) {
      suspectReason = "ctit_too_short";
    } else {
      const [flood] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(mmpClicksTable)
        .where(and(
          eq(mmpClicksTable.appId, app.id),
          eq(mmpClicksTable.ipHash, ipHash),
          gte(mmpClicksTable.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ));
      if ((flood?.n ?? 0) > CLICK_FLOOD_PER_DAY) {
        suspectReason = "click_flood";
      }
    }
  }

  const [install] = await db
    .insert(mmpInstallsTable)
    .values({
      orgId: app.orgId,
      appId: app.id,
      deviceId,
      attributedLinkId: lastClick?.linkId ?? null,
      attributedClickId: lastClick?.clickId ?? null,
      clickAt: lastClick?.clickAt ?? null,
      method: lastClick ? "fingerprint" : "organic",
      suspectReason,
    })
    .onConflictDoNothing()
    .returning();

  if (!install) {
    // Raced with a concurrent identical ping — fetch the winner.
    const [raced] = await db
      .select()
      .from(mmpInstallsTable)
      .where(and(eq(mmpInstallsTable.appId, app.id), eq(mmpInstallsTable.deviceId, deviceId)));
    logIngest({ orgId: app.orgId, appId: app.id, kind: "install", status: "ok", reason: "deduplicated (raced)", body: req.body });
    res.json({ install: raced, deduplicated: true });
    return;
  }
  logIngest({ orgId: app.orgId, appId: app.id, kind: "install", status: "ok", reason: suspectReason ? `flagged: ${suspectReason}` : undefined, body: req.body });
  res.status(201).json({
    install,
    deduplicated: false,
    // Deferred deep linking: the SDK opens this in-app destination on first launch.
    deepLink: install.attributedLinkId ? lastClick?.deepLinkUrl ?? null : null,
  });
});

// POST /api/v1/mmp/ingest/event  { deviceId, name, revenue? (USD) }
router.post("/ingest/event", requireIngestToken, async (req: IngestRequest, res) => {
  const app = req.mmpApp!;
  const { deviceId, name, revenue } = req.body as { deviceId?: string; name?: string; revenue?: number };
  if (!name || typeof name !== "string" || name.length > 100) {
    logIngest({ orgId: app.orgId, appId: app.id, kind: "event", status: "rejected", reason: "name (string, ≤100 chars) is required", body: req.body });
    res.status(400).json({ error: "name (string, ≤100 chars) is required" });
    return;
  }
  if (revenue !== undefined && (typeof revenue !== "number" || !Number.isFinite(revenue) || revenue < 0)) {
    logIngest({ orgId: app.orgId, appId: app.id, kind: "event", status: "rejected", reason: "revenue must be a non-negative number (USD)", body: req.body });
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

  logIngest({
    orgId: app.orgId,
    appId: app.id,
    kind: "event",
    status: "ok",
    reason: deviceId && !installId ? "no matching install for deviceId — event not linked to a cohort" : !deviceId ? "no deviceId — event not linked to an install (retention/LTV will undercount)" : undefined,
    body: req.body,
  });
  res.status(201).json({ event });
});

// POST /api/v1/mmp/ingest/uninstall  { deviceId }
router.post("/ingest/uninstall", requireIngestToken, async (req: IngestRequest, res) => {
  const app = req.mmpApp!;
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId || typeof deviceId !== "string" || deviceId.length > 200) {
    logIngest({ orgId: app.orgId, appId: app.id, kind: "uninstall", status: "rejected", reason: "deviceId (string, ≤200 chars) is required", body: req.body });
    res.status(400).json({ error: "deviceId (string, ≤200 chars) is required" });
    return;
  }

  const [install] = await db
    .select({ id: mmpInstallsTable.id, uninstalledAt: mmpInstallsTable.uninstalledAt })
    .from(mmpInstallsTable)
    .where(and(eq(mmpInstallsTable.appId, app.id), eq(mmpInstallsTable.deviceId, deviceId)));
  if (!install) {
    logIngest({ orgId: app.orgId, appId: app.id, kind: "uninstall", status: "rejected", reason: "no install found for deviceId", body: req.body });
    res.status(404).json({ error: "No install found for deviceId" });
    return;
  }

  if (!install.uninstalledAt) {
    await db
      .update(mmpInstallsTable)
      .set({ uninstalledAt: new Date() })
      .where(eq(mmpInstallsTable.id, install.id));
  }
  logIngest({ orgId: app.orgId, appId: app.id, kind: "uninstall", status: "ok", reason: install.uninstalledAt ? "already recorded" : undefined, body: req.body });
  res.json({ uninstalled: true, alreadyRecorded: Boolean(install.uninstalledAt) });
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
  if (appId && !UUID_RE.test(appId)) {
    res.status(400).json({ error: "appId must be a valid UUID" });
    return;
  }
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
  const { appId, name, channel, destinationUrl, creatorId, deepLinkUrl } = req.body as {
    appId?: string; name?: string; channel?: string; destinationUrl?: string;
    creatorId?: string; deepLinkUrl?: string;
  };
  if (!appId || !name?.trim() || !destinationUrl) {
    res.status(400).json({ error: "appId, name and destinationUrl are required" });
    return;
  }
  if (!isValidHttpUrl(destinationUrl)) {
    res.status(400).json({ error: "destinationUrl must be a valid http(s) URL" });
    return;
  }
  if (deepLinkUrl && (typeof deepLinkUrl !== "string" || !isValidDeepLink(deepLinkUrl))) {
    res.status(400).json({ error: "deepLinkUrl must be a valid URL (custom app schemes allowed; script/data URIs are not)" });
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
  if (creatorId) {
    if (typeof creatorId !== "string" || !UUID_RE.test(creatorId)) {
      res.status(400).json({ error: "creatorId must be a valid id" });
      return;
    }
    const [creator] = await db
      .select({ id: mmpCreatorsTable.id })
      .from(mmpCreatorsTable)
      .where(and(
        eq(mmpCreatorsTable.id, creatorId),
        eq(mmpCreatorsTable.orgId, orgId),
        eq(mmpCreatorsTable.appId, appId),
      ));
    if (!creator) {
      res.status(404).json({ error: "Creator not found for this app" });
      return;
    }
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
      creatorId: creatorId || null,
      deepLinkUrl: deepLinkUrl || null,
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

  const sinceDay = since.toISOString().slice(0, 10);
  const [[clicks], [installs], [events], [spend]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(mmpClicksTable).where(clickWhere),
    db.select({
      n: sql<number>`count(*)::int`,
      attributed: sql<number>`count(*) filter (where ${mmpInstallsTable.attributedLinkId} is not null and ${mmpInstallsTable.suspectReason} is null)::int`,
      organic: sql<number>`count(*) filter (where ${mmpInstallsTable.attributedLinkId} is null)::int`,
      suspect: sql<number>`count(*) filter (where ${mmpInstallsTable.suspectReason} is not null)::int`,
      uninstalls: sql<number>`count(*) filter (where ${mmpInstallsTable.suspectReason} is null and ${mmpInstallsTable.uninstalledAt} is not null)::int`,
    }).from(mmpInstallsTable).where(installWhere),
    db.select({
      n: sql<number>`count(*)::int`,
      revenueUsd: sql<number>`coalesce(sum(${mmpEventsTable.revenueMicro}), 0)::float8 / 1e6`,
    }).from(mmpEventsTable).where(eventWhere),
    db.select({
      spendUsd: sql<number>`coalesce(sum(${mmpLinkCostsTable.costMicro}), 0)::float8 / 1e6`,
    })
      .from(mmpLinkCostsTable)
      .innerJoin(mmpTrackingLinksTable, eq(mmpLinkCostsTable.linkId, mmpTrackingLinksTable.id))
      .where(and(
        eq(mmpLinkCostsTable.orgId, orgId),
        gte(mmpLinkCostsTable.day, sinceDay),
        ...(appId ? [eq(mmpTrackingLinksTable.appId, appId)] : []),
      )),
  ]);

  const spendUsd = spend?.spendUsd ?? 0;
  const revenueUsd = events?.revenueUsd ?? 0;
  const attributed = installs?.attributed ?? 0;
  res.json({
    clicks: clicks?.n ?? 0,
    installs: installs?.n ?? 0,
    attributedInstalls: attributed,
    organicInstalls: installs?.organic ?? 0,
    suspectInstalls: installs?.suspect ?? 0,
    uninstalls: installs?.uninstalls ?? 0,
    events: events?.n ?? 0,
    revenueUsd,
    spendUsd,
    roas: spendUsd > 0 ? revenueUsd / spendUsd : null,
    cpi: attributed > 0 && spendUsd > 0 ? spendUsd / attributed : null,
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

  const sinceDay = since.toISOString().slice(0, 10);
  const [clicksByLink, installsByLink, revenueByLink, spendByLink] = await Promise.all([
    db.select({ linkId: mmpClicksTable.linkId, n: sql<number>`count(*)::int` })
      .from(mmpClicksTable)
      .where(and(
        eq(mmpClicksTable.orgId, orgId),
        gte(mmpClicksTable.createdAt, since),
        ...(appId ? [eq(mmpClicksTable.appId, appId)] : []),
      ))
      .groupBy(mmpClicksTable.linkId),
    db.select({
      linkId: mmpInstallsTable.attributedLinkId,
      n: sql<number>`count(*) filter (where ${mmpInstallsTable.suspectReason} is null)::int`,
      suspects: sql<number>`count(*) filter (where ${mmpInstallsTable.suspectReason} is not null)::int`,
      uninstalls: sql<number>`count(*) filter (where ${mmpInstallsTable.suspectReason} is null and ${mmpInstallsTable.uninstalledAt} is not null)::int`,
    })
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
        isNull(mmpInstallsTable.suspectReason),
        ...(appId ? [eq(mmpEventsTable.appId, appId)] : []),
      ))
      .groupBy(mmpInstallsTable.attributedLinkId),
    db.select({
      linkId: mmpLinkCostsTable.linkId,
      spendUsd: sql<number>`coalesce(sum(${mmpLinkCostsTable.costMicro}), 0)::float8 / 1e6`,
    })
      .from(mmpLinkCostsTable)
      .innerJoin(mmpTrackingLinksTable, eq(mmpLinkCostsTable.linkId, mmpTrackingLinksTable.id))
      .where(and(
        eq(mmpLinkCostsTable.orgId, orgId),
        gte(mmpLinkCostsTable.day, sinceDay),
        ...(appId ? [eq(mmpTrackingLinksTable.appId, appId)] : []),
      ))
      .groupBy(mmpLinkCostsTable.linkId),
  ]);

  const clickMap = new Map(clicksByLink.map((r) => [r.linkId, r.n]));
  const installMap = new Map(installsByLink.map((r) => [r.linkId, r]));
  const revenueMap = new Map(revenueByLink.map((r) => [r.linkId, r.revenueUsd]));
  const spendMap = new Map(spendByLink.map((r) => [r.linkId, r.spendUsd]));

  const data = links.map((l) => {
    const inst = installMap.get(l.id);
    const installsN = inst?.n ?? 0;
    const revenueUsd = revenueMap.get(l.id) ?? 0;
    const spendUsd = spendMap.get(l.id) ?? 0;
    return {
      linkId: l.id,
      appId: l.appId,
      name: l.name,
      channel: l.channel,
      code: l.code,
      creatorId: l.creatorId,
      clicks: clickMap.get(l.id) ?? 0,
      installs: installsN,
      suspectInstalls: inst?.suspects ?? 0,
      uninstalls: inst?.uninstalls ?? 0,
      revenueUsd,
      spendUsd,
      roas: spendUsd > 0 ? revenueUsd / spendUsd : null,
      cpi: installsN > 0 && spendUsd > 0 ? spendUsd / installsN : null,
    };
  });

  // Organic bucket (installs with no attributed link)
  const organicRow = installMap.get(null as unknown as string);
  res.json({
    data,
    organic: {
      installs: organicRow?.n ?? 0,
      uninstalls: organicRow?.uninstalls ?? 0,
      revenueUsd: revenueMap.get(null as unknown as string) ?? 0,
    },
  });
});

// ─── Creators (influencer attribution) ────────────────────────────────────
const CREATOR_PLATFORMS = new Set(["youtube", "tiktok", "instagram", "twitch", "other"]);

router.get("/creators", async (req, res) => {
  const orgId = req.thea!.org.id;
  const rawAppId = (req.query.appId as string | undefined) || undefined;
  const appId = rawAppId && UUID_RE.test(rawAppId) ? rawAppId : undefined;
  const creators = await db
    .select()
    .from(mmpCreatorsTable)
    .where(appId
      ? and(eq(mmpCreatorsTable.orgId, orgId), eq(mmpCreatorsTable.appId, appId))
      : eq(mmpCreatorsTable.orgId, orgId))
    .orderBy(desc(mmpCreatorsTable.createdAt));
  res.json({ count: creators.length, data: creators });
});

router.post("/creators", requireRole("owner", "admin"), async (req, res) => {
  const { appId, name, platform, handle } = req.body as {
    appId?: string; name?: string; platform?: string; handle?: string;
  };
  if (!appId || !UUID_RE.test(appId) || !name?.trim()) {
    res.status(400).json({ error: "appId and name are required" });
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
  const [creator] = await db
    .insert(mmpCreatorsTable)
    .values({
      orgId,
      appId,
      name: name.trim().slice(0, 100),
      platform: CREATOR_PLATFORMS.has(platform || "") ? platform! : "other",
      handle: (handle || "").trim().slice(0, 100) || null,
    })
    .returning();
  res.status(201).json(creator);
});

router.delete("/creators/:id", requireRole("owner", "admin"), async (req, res) => {
  const [creator] = await db
    .delete(mmpCreatorsTable)
    .where(and(eq(mmpCreatorsTable.id, req.params.id as string), eq(mmpCreatorsTable.orgId, req.thea!.org.id)))
    .returning({ id: mmpCreatorsTable.id });
  if (!creator) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }
  res.json({ deleted: true });
});

// Per-creator performance: clicks, installs, D1/D7 retention (mature installs
// only — never reports 0% on cohorts too young to measure), revenue, LTV.
router.get("/creators/stats", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { since, appId } = statsWindow(req);

  const creators = await db
    .select()
    .from(mmpCreatorsTable)
    .where(appId
      ? and(eq(mmpCreatorsTable.orgId, orgId), eq(mmpCreatorsTable.appId, appId))
      : eq(mmpCreatorsTable.orgId, orgId))
    .orderBy(desc(mmpCreatorsTable.createdAt));

  const appFilterInstalls = appId ? sql` and i.app_id = ${appId}` : sql``;
  const appFilterClicks = appId ? sql` and c.app_id = ${appId}` : sql``;

  const [installAgg, clickAgg, revenueAgg] = await Promise.all([
    db.execute(sql`
      select l.creator_id,
        count(*)::int as installs,
        count(*) filter (where i.uninstalled_at is not null)::int as uninstalls,
        count(*) filter (where i.created_at <= now() - interval '2 days')::int as d1_mature,
        count(*) filter (where i.created_at <= now() - interval '2 days' and exists (
          select 1 from mmp_events e where e.install_id = i.id
            and e.created_at >= i.created_at + interval '1 day'
            and e.created_at <  i.created_at + interval '2 days'))::int as d1_active,
        count(*) filter (where i.created_at <= now() - interval '8 days')::int as d7_mature,
        count(*) filter (where i.created_at <= now() - interval '8 days' and exists (
          select 1 from mmp_events e where e.install_id = i.id
            and e.created_at >= i.created_at + interval '7 days'
            and e.created_at <  i.created_at + interval '8 days'))::int as d7_active
      from mmp_installs i
      join mmp_tracking_links l on l.id = i.attributed_link_id
      where i.org_id = ${orgId} and i.created_at >= ${since}
        and i.suspect_reason is null and l.creator_id is not null${appFilterInstalls}
      group by l.creator_id
    `),
    db.execute(sql`
      select l.creator_id, count(*)::int as clicks
      from mmp_clicks c
      join mmp_tracking_links l on l.id = c.link_id
      where c.org_id = ${orgId} and c.created_at >= ${since}
        and l.creator_id is not null${appFilterClicks}
      group by l.creator_id
    `),
    db.execute(sql`
      select l.creator_id, coalesce(sum(e.revenue_micro), 0)::float8 / 1e6 as revenue_usd
      from mmp_events e
      join mmp_installs i on i.id = e.install_id
      join mmp_tracking_links l on l.id = i.attributed_link_id
      where e.org_id = ${orgId} and e.created_at >= ${since}
        and i.suspect_reason is null and l.creator_id is not null${appFilterInstalls}
      group by l.creator_id
    `),
  ]);

  type Row = Record<string, unknown>;
  const instMap = new Map((installAgg.rows as Row[]).map((r) => [String(r.creator_id), r]));
  const clickMap = new Map((clickAgg.rows as Row[]).map((r) => [String(r.creator_id), Number(r.clicks)]));
  const revMap = new Map((revenueAgg.rows as Row[]).map((r) => [String(r.creator_id), Number(r.revenue_usd)]));

  const data = creators.map((c) => {
    const inst = instMap.get(c.id);
    const installs = inst ? Number(inst.installs) : 0;
    const d1Mature = inst ? Number(inst.d1_mature) : 0;
    const d1Active = inst ? Number(inst.d1_active) : 0;
    const d7Mature = inst ? Number(inst.d7_mature) : 0;
    const d7Active = inst ? Number(inst.d7_active) : 0;
    const revenueUsd = revMap.get(c.id) ?? 0;
    return {
      creatorId: c.id,
      appId: c.appId,
      name: c.name,
      platform: c.platform,
      handle: c.handle,
      clicks: clickMap.get(c.id) ?? 0,
      installs,
      uninstalls: inst ? Number(inst.uninstalls) : 0,
      d1Retention: d1Mature > 0 ? d1Active / d1Mature : null,
      d7Retention: d7Mature > 0 ? d7Active / d7Mature : null,
      revenueUsd,
      ltvUsd: installs > 0 ? revenueUsd / installs : null,
    };
  });
  res.json({ count: data.length, data });
});

// ─── Attribution health monitor ───────────────────────────────────────────
// Every check has a minimum-sample gate so small apps aren't spammed with
// false alarms. Score: 100 − 25/critical − 10/warning − 3/info (floor 0).
router.get("/health", async (req, res) => {
  const orgId = req.thea!.org.id;
  const rawAppId = (req.query.appId as string | undefined) || "";
  if (!UUID_RE.test(rawAppId)) {
    res.status(400).json({ error: "appId (uuid) is required" });
    return;
  }
  const appId = rawAppId;
  const [app] = await db
    .select({ id: mmpAppsTable.id, name: mmpAppsTable.name })
    .from(mmpAppsTable)
    .where(and(eq(mmpAppsTable.id, appId), eq(mmpAppsTable.orgId, orgId)));
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [[installStats], [eventStats], dupRows, nameRows, brokenLinkRows] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      suspects: sql<number>`count(*) filter (where ${mmpInstallsTable.suspectReason} is not null)::int`,
      ctitLong: sql<number>`count(*) filter (where ${mmpInstallsTable.clickAt} is not null and ${mmpInstallsTable.createdAt} - ${mmpInstallsTable.clickAt} > interval '6 days')::int`,
      last7Total: sql<number>`count(*) filter (where ${mmpInstallsTable.createdAt} >= now() - interval '7 days')::int`,
      last7Organic: sql<number>`count(*) filter (where ${mmpInstallsTable.createdAt} >= now() - interval '7 days' and ${mmpInstallsTable.attributedLinkId} is null)::int`,
      prevTotal: sql<number>`count(*) filter (where ${mmpInstallsTable.createdAt} < now() - interval '7 days')::int`,
      prevOrganic: sql<number>`count(*) filter (where ${mmpInstallsTable.createdAt} < now() - interval '7 days' and ${mmpInstallsTable.attributedLinkId} is null)::int`,
    }).from(mmpInstallsTable).where(and(
      eq(mmpInstallsTable.orgId, orgId),
      eq(mmpInstallsTable.appId, appId),
      gte(mmpInstallsTable.createdAt, since),
    )),
    db.select({
      total: sql<number>`count(*)::int`,
      last48h: sql<number>`count(*) filter (where ${mmpEventsTable.createdAt} >= now() - interval '48 hours')::int`,
      prior7d: sql<number>`count(*) filter (where ${mmpEventsTable.createdAt} < now() - interval '48 hours' and ${mmpEventsTable.createdAt} >= now() - interval '9 days')::int`,
    }).from(mmpEventsTable).where(and(
      eq(mmpEventsTable.orgId, orgId),
      eq(mmpEventsTable.appId, appId),
      gte(mmpEventsTable.createdAt, since),
    )),
    db.execute(sql`
      select coalesce(count(*), 0)::int as groups
      from (
        select 1
        from mmp_events
        where org_id = ${orgId} and app_id = ${appId} and install_id is not null
          and created_at >= ${since}
        group by install_id, name, date_trunc('minute', created_at)
        having count(*) > 3
      ) t
    `),
    db.execute(sql`
      select name, count(*)::int as total,
        count(*) filter (where revenue_micro > 0)::int as with_rev
      from mmp_events
      where org_id = ${orgId} and app_id = ${appId} and created_at >= ${since}
      group by name
      having count(*) >= 20
    `),
    db.execute(sql`
      select l.id, l.name, count(*)::int as clicks
      from mmp_tracking_links l
      join mmp_clicks c on c.link_id = l.id and c.created_at >= ${since}
      where l.org_id = ${orgId} and l.app_id = ${appId}
      group by l.id, l.name
      having count(*) >= 100 and not exists (
        select 1 from mmp_installs i
        where i.attributed_link_id = l.id and i.suspect_reason is null
          and i.created_at >= ${since}
      )
    `),
  ]);

  type Issue = { id: string; severity: "critical" | "warning" | "info"; title: string; detail: string };
  const issues: Issue[] = [];
  const totalInstalls = installStats?.total ?? 0;
  const suspects = installStats?.suspects ?? 0;

  if (suspects >= 5 && totalInstalls > 0 && suspects / totalInstalls > 0.05) {
    issues.push({
      id: "suspect_installs_high",
      severity: "critical",
      title: "High rate of suspect installs",
      detail: `${suspects} of ${totalInstalls} installs (${((suspects / totalInstalls) * 100).toFixed(1)}%) in the last 30 days were flagged as suspect (CTIT too short or click flooding). Review the flagged links — this pattern usually means click spam or bot traffic.`,
    });
  } else if (suspects > 0) {
    issues.push({
      id: "suspect_installs_present",
      severity: "info",
      title: "Some installs flagged as suspect",
      detail: `${suspects} install(s) in the last 30 days were flagged by fraud heuristics. They are excluded from attributed totals.`,
    });
  }

  const ctitLong = installStats?.ctitLong ?? 0;
  if (ctitLong > 0) {
    issues.push({
      id: "ctit_long_tail",
      severity: "info",
      title: "Installs near the attribution window edge",
      detail: `${ctitLong} install(s) converted more than 6 days after the matched click — close to the 7-day window limit. These may be coincidental IP matches rather than true conversions.`,
    });
  }

  const last7Total = installStats?.last7Total ?? 0;
  const prevTotal = installStats?.prevTotal ?? 0;
  if (last7Total >= 50 && prevTotal >= 50) {
    const last7Share = (installStats?.last7Organic ?? 0) / last7Total;
    const prevShare = (installStats?.prevOrganic ?? 0) / prevTotal;
    if (last7Share - prevShare > 0.25) {
      issues.push({
        id: "organic_share_spike",
        severity: "warning",
        title: "Organic share spiked",
        detail: `Organic installs jumped from ${(prevShare * 100).toFixed(0)}% to ${(last7Share * 100).toFixed(0)}% of installs this week. This often means tracking links stopped firing (broken redirect, changed campaign URLs) so paid installs are landing as organic.`,
      });
    }
  }

  if ((eventStats?.prior7d ?? 0) > 0 && (eventStats?.last48h ?? 0) === 0) {
    issues.push({
      id: "ingest_silence",
      severity: "warning",
      title: "Event ingestion went silent",
      detail: "No events received in the last 48 hours, but the app was sending events before. Check that your server-to-server integration is still running and the ingest token is valid.",
    });
  }

  const dupGroups = Number((dupRows.rows[0] as Record<string, unknown>)?.groups ?? 0);
  if ((eventStats?.total ?? 0) >= 100 && dupGroups >= 5) {
    issues.push({
      id: "duplicate_events",
      severity: "warning",
      title: "Possible duplicate event firing",
      detail: `${dupGroups} install+event combinations fired more than 3 times within a single minute. Your SDK integration may be sending the same event multiple times (missing dedup on retries).`,
    });
  }

  const inconsistentNames = (nameRows.rows as Record<string, unknown>[])
    .filter((r) => {
      const total = Number(r.total);
      const withRev = Number(r.with_rev);
      return total > 0 && withRev / total > 0.5 && withRev < total;
    })
    .map((r) => String(r.name));
  if (inconsistentNames.length > 0) {
    issues.push({
      id: "inconsistent_revenue",
      severity: "info",
      title: "Events with inconsistent revenue tagging",
      detail: `These events usually carry revenue but sometimes arrive without it: ${inconsistentNames.slice(0, 5).join(", ")}. Revenue-based metrics (ROAS, LTV) will undercount.`,
    });
  }

  const brokenLinks = (brokenLinkRows.rows as Record<string, unknown>[]).slice(0, 5);
  if (brokenLinks.length > 0) {
    issues.push({
      id: "links_no_installs",
      severity: "warning",
      title: "Links getting clicks but zero installs",
      detail: `${brokenLinks.length} link(s) with 100+ clicks produced no attributed installs in 30 days: ${brokenLinks.map((l) => String(l.name)).join(", ")}. The store destination may be broken, or the app isn't sending install pings.`,
    });
  }

  const score = Math.max(0, 100
    - 25 * issues.filter((i) => i.severity === "critical").length
    - 10 * issues.filter((i) => i.severity === "warning").length
    - 3 * issues.filter((i) => i.severity === "info").length);

  res.json({
    appId,
    appName: app.name,
    score,
    status: score >= 90 ? "healthy" : score >= 60 ? "degraded" : "critical",
    windowDays: 30,
    sample: { installs: totalInstalls, events: eventStats?.total ?? 0 },
    issues,
  });
});

// ─── Ad spend / costs (manual + CSV import) ───────────────────────────────
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/costs", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { since, appId } = statsWindow(req);
  const sinceDay = since.toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: mmpLinkCostsTable.id,
      linkId: mmpLinkCostsTable.linkId,
      linkName: mmpTrackingLinksTable.name,
      code: mmpTrackingLinksTable.code,
      appId: mmpTrackingLinksTable.appId,
      day: mmpLinkCostsTable.day,
      costUsd: sql<number>`${mmpLinkCostsTable.costMicro}::float8 / 1e6`,
    })
    .from(mmpLinkCostsTable)
    .innerJoin(mmpTrackingLinksTable, eq(mmpLinkCostsTable.linkId, mmpTrackingLinksTable.id))
    .where(and(
      eq(mmpLinkCostsTable.orgId, orgId),
      gte(mmpLinkCostsTable.day, sinceDay),
      ...(appId ? [eq(mmpTrackingLinksTable.appId, appId)] : []),
    ))
    .orderBy(desc(mmpLinkCostsTable.day))
    .limit(500);
  res.json({ count: rows.length, data: rows });
});

router.post("/costs", requireRole("owner", "admin"), async (req, res) => {
  const { linkId, day, costUsd } = req.body as { linkId?: string; day?: string; costUsd?: number };
  if (!linkId || !UUID_RE.test(linkId) || !day || !DAY_RE.test(day)) {
    res.status(400).json({ error: "linkId (uuid) and day (YYYY-MM-DD) are required" });
    return;
  }
  if (typeof costUsd !== "number" || !Number.isFinite(costUsd) || costUsd < 0 || costUsd > 1e9) {
    res.status(400).json({ error: "costUsd must be a non-negative number" });
    return;
  }
  const orgId = req.thea!.org.id;
  const [link] = await db
    .select({ id: mmpTrackingLinksTable.id })
    .from(mmpTrackingLinksTable)
    .where(and(eq(mmpTrackingLinksTable.id, linkId), eq(mmpTrackingLinksTable.orgId, orgId)));
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }
  const costMicro = BigInt(Math.round(costUsd * 1_000_000));
  const [row] = await db
    .insert(mmpLinkCostsTable)
    .values({ orgId, linkId, day, costMicro })
    .onConflictDoUpdate({
      target: [mmpLinkCostsTable.linkId, mmpLinkCostsTable.day],
      set: { costMicro, updatedAt: new Date() },
    })
    .returning();
  const { costMicro: cm, ...rest } = row!;
  res.status(201).json({ ...rest, costUsd: Number(cm) / 1e6 });
});

// CSV import: lines of `day,code,cost_usd` (header row optional).
router.post("/costs/import", requireRole("owner", "admin"), async (req, res) => {
  const { csv } = req.body as { csv?: string };
  if (!csv || typeof csv !== "string" || csv.length > 200_000) {
    res.status(400).json({ error: "csv (string, ≤200KB) is required" });
    return;
  }
  const orgId = req.thea!.org.id;
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 1000);

  const links = await db
    .select({ id: mmpTrackingLinksTable.id, code: mmpTrackingLinksTable.code })
    .from(mmpTrackingLinksTable)
    .where(eq(mmpTrackingLinksTable.orgId, orgId));
  const byCode = new Map(links.map((l) => [l.code, l.id]));

  let imported = 0;
  const skipped: { line: number; reason: string }[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx]!;
    const parts = raw.split(",").map((p) => p.trim());
    if (idx === 0 && parts[0]?.toLowerCase() === "day") continue; // header
    const [day, code, costStr] = parts;
    if (!day || !DAY_RE.test(day)) {
      skipped.push({ line: idx + 1, reason: "invalid day (expected YYYY-MM-DD)" });
      continue;
    }
    const linkId = code ? byCode.get(code) : undefined;
    if (!linkId) {
      skipped.push({ line: idx + 1, reason: `unknown link code "${(code || "").slice(0, 20)}"` });
      continue;
    }
    const costUsd = Number(costStr);
    if (!Number.isFinite(costUsd) || costUsd < 0 || costUsd > 1e9) {
      skipped.push({ line: idx + 1, reason: "invalid cost_usd" });
      continue;
    }
    const costMicro = BigInt(Math.round(costUsd * 1_000_000));
    await db
      .insert(mmpLinkCostsTable)
      .values({ orgId, linkId, day, costMicro })
      .onConflictDoUpdate({
        target: [mmpLinkCostsTable.linkId, mmpLinkCostsTable.day],
        set: { costMicro, updatedAt: new Date() },
      });
    imported++;
  }
  res.json({ imported, skipped });
});

// ─── Cohort retention + cohort LTV ────────────────────────────────────────
// "Retention" here = event activity in the day-N window (the SDK must send
// events with deviceId for this to populate). Immature cohorts return null.
router.get("/stats/retention", async (req, res) => {
  const orgId = req.thea!.org.id;
  const weeks = Math.min(Math.max(parseInt((req.query.weeks as string) || "8", 10) || 8, 1), 12);
  const rawAppId = (req.query.appId as string | undefined) || undefined;
  const appId = rawAppId && UUID_RE.test(rawAppId) ? rawAppId : undefined;
  const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
  const appFilter = appId ? sql` and i.app_id = ${appId}` : sql``;

  const result = await db.execute(sql`
    select to_char(date_trunc('week', i.created_at), 'YYYY-MM-DD') as week,
      count(*)::int as installs,
      count(*) filter (where i.attributed_link_id is not null)::int as paid,
      count(*) filter (where i.attributed_link_id is null)::int as organic,
      count(*) filter (where i.created_at <= now() - interval '2 days')::int as d1_mature,
      count(*) filter (where i.created_at <= now() - interval '2 days' and exists (
        select 1 from mmp_events e where e.install_id = i.id
          and e.created_at >= i.created_at + interval '1 day'
          and e.created_at <  i.created_at + interval '2 days'))::int as d1_active,
      count(*) filter (where i.created_at <= now() - interval '8 days')::int as d7_mature,
      count(*) filter (where i.created_at <= now() - interval '8 days' and exists (
        select 1 from mmp_events e where e.install_id = i.id
          and e.created_at >= i.created_at + interval '7 days'
          and e.created_at <  i.created_at + interval '8 days'))::int as d7_active,
      count(*) filter (where i.created_at <= now() - interval '31 days')::int as d30_mature,
      count(*) filter (where i.created_at <= now() - interval '31 days' and exists (
        select 1 from mmp_events e where e.install_id = i.id
          and e.created_at >= i.created_at + interval '30 days'
          and e.created_at <  i.created_at + interval '31 days'))::int as d30_active
    from mmp_installs i
    where i.org_id = ${orgId} and i.created_at >= ${since}
      and i.suspect_reason is null${appFilter}
    group by 1
    order by 1
  `);

  const data = (result.rows as Record<string, unknown>[]).map((r) => {
    const rate = (mature: unknown, active: unknown) => {
      const m = Number(mature);
      return m > 0 ? Number(active) / m : null;
    };
    return {
      week: String(r.week),
      installs: Number(r.installs),
      paid: Number(r.paid),
      organic: Number(r.organic),
      d1: rate(r.d1_mature, r.d1_active),
      d7: rate(r.d7_mature, r.d7_active),
      d30: rate(r.d30_mature, r.d30_active),
    };
  });
  res.json({ weeks, data });
});

// Cumulative revenue per install by days-since-install (0..30).
router.get("/stats/cohort-ltv", async (req, res) => {
  const orgId = req.thea!.org.id;
  const { since, appId } = statsWindow(req);
  const appFilter = appId ? sql` and i.app_id = ${appId}` : sql``;

  const [installCountRes, revByAge] = await Promise.all([
    db.execute(sql`
      select count(*)::int as n from mmp_installs i
      where i.org_id = ${orgId} and i.created_at >= ${since}
        and i.suspect_reason is null${appFilter}
    `),
    db.execute(sql`
      select floor(extract(epoch from (e.created_at - i.created_at)) / 86400)::int as age,
        coalesce(sum(e.revenue_micro), 0)::float8 / 1e6 as rev
      from mmp_events e
      join mmp_installs i on i.id = e.install_id
      where i.org_id = ${orgId} and i.created_at >= ${since}
        and i.suspect_reason is null${appFilter}
        and e.created_at >= i.created_at
        and e.created_at < i.created_at + interval '31 days'
      group by 1
      order by 1
    `),
  ]);

  const installCount = Number((installCountRes.rows[0] as Record<string, unknown>)?.n ?? 0);
  const revMap = new Map((revByAge.rows as Record<string, unknown>[]).map((r) => [Number(r.age), Number(r.rev)]));
  const maxAge = Math.min(30, Math.floor((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000)));

  const points: { day: number; ltvUsd: number }[] = [];
  if (installCount > 0) {
    let cum = 0;
    for (let d = 0; d <= maxAge; d++) {
      cum += revMap.get(d) ?? 0;
      points.push({ day: d, ltvUsd: cum / installCount });
    }
  }
  res.json({ installs: installCount, data: points });
});

// ─── CSV export ───────────────────────────────────────────────────────────
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Guard against spreadsheet formula injection via attacker-supplied strings.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sendCsv(res: Response, filename: string, header: string[], rows: unknown[][]): void {
  const body = [header.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(body);
}

const EXPORT_LIMIT = 50_000;

router.get("/export/:kind", async (req, res) => {
  const orgId = req.thea!.org.id;
  const kind = req.params.kind as string;
  const { since, appId } = statsWindow(req);
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === "clicks") {
    const rows = await db
      .select({
        id: mmpClicksTable.id,
        appId: mmpClicksTable.appId,
        code: mmpTrackingLinksTable.code,
        linkName: mmpTrackingLinksTable.name,
        channel: mmpTrackingLinksTable.channel,
        country: mmpClicksTable.country,
        referer: mmpClicksTable.referer,
        createdAt: mmpClicksTable.createdAt,
      })
      .from(mmpClicksTable)
      .innerJoin(mmpTrackingLinksTable, eq(mmpClicksTable.linkId, mmpTrackingLinksTable.id))
      .where(and(
        eq(mmpClicksTable.orgId, orgId),
        gte(mmpClicksTable.createdAt, since),
        ...(appId ? [eq(mmpClicksTable.appId, appId)] : []),
      ))
      .orderBy(desc(mmpClicksTable.createdAt))
      .limit(EXPORT_LIMIT);
    sendCsv(res, `mmp-clicks-${stamp}.csv`,
      ["click_id", "app_id", "link_code", "link_name", "channel", "country", "referer", "clicked_at"],
      rows.map((r) => [r.id, r.appId, r.code, r.linkName, r.channel, r.country, r.referer, r.createdAt]));
    return;
  }

  if (kind === "installs") {
    const rows = await db
      .select({
        id: mmpInstallsTable.id,
        appId: mmpInstallsTable.appId,
        deviceId: mmpInstallsTable.deviceId,
        code: mmpTrackingLinksTable.code,
        linkName: mmpTrackingLinksTable.name,
        method: mmpInstallsTable.method,
        suspectReason: mmpInstallsTable.suspectReason,
        clickAt: mmpInstallsTable.clickAt,
        uninstalledAt: mmpInstallsTable.uninstalledAt,
        createdAt: mmpInstallsTable.createdAt,
      })
      .from(mmpInstallsTable)
      .leftJoin(mmpTrackingLinksTable, eq(mmpInstallsTable.attributedLinkId, mmpTrackingLinksTable.id))
      .where(and(
        eq(mmpInstallsTable.orgId, orgId),
        gte(mmpInstallsTable.createdAt, since),
        ...(appId ? [eq(mmpInstallsTable.appId, appId)] : []),
      ))
      .orderBy(desc(mmpInstallsTable.createdAt))
      .limit(EXPORT_LIMIT);
    sendCsv(res, `mmp-installs-${stamp}.csv`,
      ["install_id", "app_id", "device_id", "link_code", "link_name", "method", "suspect_reason", "click_at", "uninstalled_at", "installed_at"],
      rows.map((r) => [r.id, r.appId, r.deviceId, r.code, r.linkName, r.method, r.suspectReason, r.clickAt, r.uninstalledAt, r.createdAt]));
    return;
  }

  if (kind === "events") {
    const rows = await db
      .select({
        id: mmpEventsTable.id,
        appId: mmpEventsTable.appId,
        installId: mmpEventsTable.installId,
        name: mmpEventsTable.name,
        revenueUsd: sql<number>`${mmpEventsTable.revenueMicro}::float8 / 1e6`,
        createdAt: mmpEventsTable.createdAt,
      })
      .from(mmpEventsTable)
      .where(and(
        eq(mmpEventsTable.orgId, orgId),
        gte(mmpEventsTable.createdAt, since),
        ...(appId ? [eq(mmpEventsTable.appId, appId)] : []),
      ))
      .orderBy(desc(mmpEventsTable.createdAt))
      .limit(EXPORT_LIMIT);
    sendCsv(res, `mmp-events-${stamp}.csv`,
      ["event_id", "app_id", "install_id", "name", "revenue_usd", "created_at"],
      rows.map((r) => [r.id, r.appId, r.installId, r.name, r.revenueUsd, r.createdAt]));
    return;
  }

  res.status(400).json({ error: "kind must be one of: clicks, installs, events" });
});

// ─── SDK debugger — recent ingest log (org-scoped, last 72h retained) ─────
router.get("/debug/recent", async (req, res) => {
  const orgId = req.thea!.org.id;
  const rawAppId = (req.query.appId as string | undefined) || undefined;
  const appId = rawAppId && UUID_RE.test(rawAppId) ? rawAppId : undefined;
  const rows = await db
    .select()
    .from(mmpIngestLogTable)
    .where(appId
      ? and(eq(mmpIngestLogTable.orgId, orgId), eq(mmpIngestLogTable.appId, appId))
      : eq(mmpIngestLogTable.orgId, orgId))
    .orderBy(desc(mmpIngestLogTable.createdAt))
    .limit(50);
  res.json({ count: rows.length, data: rows });
});

export default router;
