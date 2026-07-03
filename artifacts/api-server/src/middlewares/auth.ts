import { type Request, type Response, type NextFunction } from "express";
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { usersTable, organizationsTable, subscriptionsTable, sessionsTable, apiKeysTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { TIER_FEATURES, TIER_LIMITS, type Tier } from "./featureGate";
import { logger } from "../lib/logger";
import type { Organization, User, Subscription } from "@workspace/db/schema";
import { generateSessionToken, hashToken, readSessionCookie, SESSION_TTL_MS } from "../lib/auth";

export interface TheaRequestContext {
  user: User;
  org: Organization;
  subscription: Subscription;
  tier: Tier;
  featureFlags: string[];
}

declare global {
  namespace Express {
    interface Request {
      thea?: TheaRequestContext;
    }
  }
}

function slugify(str: string): string {
  return (
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "org"
  );
}

/**
 * Atomically create a new organization, its owner user, and a starter
 * subscription. Used at registration time.
 */
export async function registerOrgOwner(
  email: string,
  passwordHash: string,
  name?: string | null,
): Promise<{ user: User; org: Organization; subscription: Subscription }> {
  return db.transaction(async (tx) => {
    const orgName = name || email.split("@")[0] || "My Organization";
    const slug = `${slugify(orgName)}-${Date.now().toString(36)}`;

    const [org] = await tx
      .insert(organizationsTable)
      .values({ name: orgName, slug, focus: "general" })
      .returning();

    const [user] = await tx
      .insert(usersTable)
      .values({ orgId: org.id, email, passwordHash, name: name ?? null, role: "owner" })
      .returning();

    const [subscription] = await tx
      .insert(subscriptionsTable)
      .values({ orgId: org.id, tier: "starter", status: "active", ...TIER_LIMITS.starter })
      .returning();

    logger.info({ orgId: org.id, userId: user.id }, "Registered org + owner + subscription");
    return { user, org, subscription };
  });
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ userId, tokenHash, expiresAt });
  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
}

/**
 * Resolve a raw session token to its user, lazily deleting expired sessions.
 */
export async function getUserByToken(token: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.tokenHash, hashToken(token)))
    .limit(1);

  const session = rows[0];
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
    return null;
  }

  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  return userRows[0] ?? null;
}

/**
 * Build the per-request tenant context (org + subscription + tier) for a user.
 */
export async function resolveOrgContext(user: User): Promise<TheaRequestContext | null> {
  const orgRows = await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.orgId)).limit(1);
  if (!orgRows[0]) return null;
  const org = orgRows[0];

  const subRows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.orgId, org.id)).limit(1);
  if (!subRows[0]) return null;
  let subscription = subRows[0];

  let tier = (subscription.tier as Tier) || "starter";

  // Non-recurring plans (PayPal, crypto USDT) are paid up-front for a fixed
  // window with no auto-renew. Once currentPeriodEnd lapses, downgrade to
  // starter for this request so access is revoked immediately (fail closed),
  // even before any background sweep runs.
  //
  // Stripe subscriptions are EXEMPT: their lifecycle is driven by Stripe's own
  // webhooks (customer.subscription.deleted / invoice.payment_failed), and
  // currentPeriodEnd only advances when the renewal webhook lands. Applying the
  // hard expiry here would lock out a paying customer at the exact period
  // boundary if that renewal webhook is delayed or dropped.
  const periodEnd = subscription.currentPeriodEnd;
  const isStripeManaged = !!subscription.stripeSubscriptionId;
  if (
    tier !== "starter" &&
    !isStripeManaged &&
    periodEnd instanceof Date &&
    periodEnd.getTime() < Date.now()
  ) {
    tier = "starter";
    subscription = { ...subscription, tier: "starter", ...TIER_LIMITS.starter };
  }

  return { user, org, subscription, tier, featureFlags: TIER_FEATURES[tier] ?? TIER_FEATURES.starter };
}

/**
 * Resolve org context from a THEA API key (Bearer token auth).
 * Returns null if the key is invalid, inactive, or expired.
 */
async function resolveApiKeyContext(rawKey: string): Promise<TheaRequestContext | null> {
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyRows = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, keyHash), eq(apiKeysTable.isActive, true)))
    .limit(1);

  const key = keyRows[0];
  if (!key) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Update lastUsedAt asynchronously (non-blocking)
  db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, key.id)).catch(() => undefined);

  /**
   * API keys are deliberately scoped to "member" role regardless of scopes array.
   * This means:
   *  - requireAuth-only routes: accessible (read endpoints, trend data, alerts)
   *  - requireRole("owner", "admin") routes: BLOCKED (cannot manage keys, run admin ops)
   * Scope-based RBAC (e.g. "write" scope → "admin" role) is a future enhancement.
   */
  const syntheticUser: User = {
    id: `apik:${key.id}`,
    orgId: key.orgId,
    email: `${key.keyPrefix}@api-key.local`,
    passwordHash: "",
    name: key.name,
    role: "member",
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  };

  return resolveOrgContext(syntheticUser);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // API key auth: Authorization: Bearer thea_<key>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer thea_")) {
    const rawKey = authHeader.slice(7);
    resolveApiKeyContext(rawKey)
      .then((context) => {
        if (!context) {
          res.status(401).json({ error: "Invalid or expired API key" });
          return;
        }
        if (context.org.pausedAt) {
          res.status(403).json({ error: "Organization suspended" });
          return;
        }
        req.thea = context;
        next();
      })
      .catch((err) => {
        logger.error({ err }, "requireAuth: API key resolution error");
        next(err);
      });
    return;
  }

  // Session-token auth: web clients send it as an HttpOnly cookie; native
  // mobile clients send it as `Authorization: Bearer <sessionToken>` (any
  // Bearer value that is not a `thea_` API key is treated as a session token).
  let token = readSessionCookie(req);
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim() || null;
  }
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  getUserByToken(token)
    .then(async (user) => {
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const context = await resolveOrgContext(user);
      if (!context) {
        res.status(403).json({ error: "Organization not found" });
        return;
      }
      if (context.org.pausedAt) {
        res.status(403).json({ error: "Organization suspended" });
        return;
      }
      req.thea = context;
      next();
    })
    .catch((err) => {
      logger.error({ err }, "requireAuth: unhandled error resolving org context");
      next(err);
    });
}

/**
 * Public/optional authentication for consumer-facing endpoints.
 *
 * Unlike {@link requireAuth}, this never rejects the request. When valid
 * credentials (session cookie, session bearer token, or API key) are present it
 * attaches the resolved tenant context to `req.thea`; otherwise it leaves
 * `req.thea` undefined and continues. Routes are then responsible for falling
 * back to platform-only scope (PLATFORM_ORG_ID) for anonymous callers, so the
 * public THEA Markets app can browse and vote on platform markets without login
 * while authenticated users still see their own org content.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer thea_")) {
    const rawKey = authHeader.slice(7);
    resolveApiKeyContext(rawKey)
      .then((context) => {
        if (context) req.thea = context;
        next();
      })
      .catch((err) => {
        logger.error({ err }, "optionalAuth: API key resolution error");
        next();
      });
    return;
  }

  let token = readSessionCookie(req);
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim() || null;
  }
  if (!token) {
    next();
    return;
  }

  getUserByToken(token)
    .then(async (user) => {
      if (user) {
        const context = await resolveOrgContext(user);
        if (context) req.thea = context;
      }
      next();
    })
    .catch((err) => {
      logger.error({ err }, "optionalAuth: error resolving org context");
      next();
    });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.thea?.user.role;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({ error: `Requires one of roles: ${roles.join(", ")}` });
      return;
    }
    next();
  };
}
