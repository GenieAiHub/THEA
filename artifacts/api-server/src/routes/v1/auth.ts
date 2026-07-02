import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { User, Organization } from "@workspace/db/schema";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  readSessionCookie,
} from "../../lib/auth";
import { createSession, deleteSession, registerOrgOwner, requireAuth } from "../../middlewares/auth";
import { authRateLimiter } from "../../middlewares/rateLimiter";
import { logger } from "../../lib/logger";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Valid-format placeholder hash so login timing is comparable whether or not
// the account exists (mitigates user enumeration via response timing).
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId };
}

function publicOrg(org: Organization) {
  return { id: org.id, name: org.name, slug: org.slug, onboardingCompletedAt: org.onboardingCompletedAt };
}

router.post("/register", authRateLimiter, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { email?: string; password?: string; name?: string };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const password = body.password;

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const { user, org } = await registerOrgOwner(email, passwordHash, name);
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);

  logger.info({ userId: user.id, orgId: org.id }, "New user registered");
  // `token` + `expiresAt` are returned for native mobile clients that cannot
  // use the HttpOnly cookie; web clients keep using the cookie set above.
  res.status(201).json({
    data: { user: publicUser(user), org: publicOrg(org), token, expiresAt: expiresAt.toISOString() },
  });
});

router.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body.password;

  if (!email || typeof password !== "string" || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = rows[0];
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ data: { user: publicUser(user), token, expiresAt: expiresAt.toISOString() } });
});

router.post("/logout", async (req: Request, res: Response) => {
  const token = readSessionCookie(req);
  if (token) await deleteSession(token);
  clearSessionCookie(res);
  res.json({ data: { success: true } });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const ctx = req.thea!;
  res.json({
    data: {
      user: publicUser(ctx.user),
      org: publicOrg(ctx.org),
      tier: ctx.tier,
      featureFlags: ctx.featureFlags,
    },
  });
});

export default router;
