import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { organizationsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { hashPassword } from "../../lib/auth";
import { logger } from "../../lib/logger";

const router = Router();
router.use(requireAuth);

const VALID_ROLES = ["owner", "admin", "analyst"];

router.get("/org", async (req, res) => {
  const { org, subscription, tier } = req.thea!;
  res.json({
    data: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      brandColor: org.brandColor,
      focus: org.focus,
      onboardingCompleted: !!org.onboardingCompletedAt,
      isPaused: !!org.pausedAt,
      tier,
      maxKeywords: subscription.maxKeywords,
      maxCategories: subscription.maxCategories,
      historyDays: subscription.historyDays,
      createdAt: org.createdAt,
    },
  });
});

router.patch("/org", requireRole("owner", "admin"), async (req, res) => {
  const { name, logoUrl, brandColor } = req.body as {
    name?: string;
    logoUrl?: string;
    brandColor?: string;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (logoUrl !== undefined) updates.logoUrl = logoUrl;
  if (brandColor !== undefined) updates.brandColor = brandColor;

  const [updated] = await db
    .update(organizationsTable)
    .set(updates)
    .where(eq(organizationsTable.id, req.thea!.org.id))
    .returning();

  res.json({ data: updated });
});

router.get("/team", async (req, res) => {
  const members = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.orgId, req.thea!.org.id));

  res.json({
    data: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      joinedAt: m.createdAt,
    })),
  });
});

router.post("/team/invite", requireRole("owner", "admin"), async (req, res) => {
  const { email: rawEmail, role = "analyst" } = req.body as { email?: string; role?: string };
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  if (!VALID_ROLES.includes(role) || role === "owner") {
    res.status(400).json({ error: `role must be one of: ${VALID_ROLES.filter((r) => r !== "owner").join(", ")}` });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing[0]) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(tempPassword);

  const [member] = await db
    .insert(usersTable)
    .values({ orgId: req.thea!.org.id, email, passwordHash, name: null, role })
    .returning();

  logger.info({ orgId: req.thea!.org.id, userId: member.id, role }, "Team member account created");

  res.status(201).json({
    data: { id: member.id, email: member.email, role: member.role },
    tempPassword,
    message: "Member account created. Share this temporary password securely — they can sign in immediately.",
  });
});

router.patch("/team/:userId/role", requireRole("owner"), async (req, res) => {
  const { role } = req.body as { role: string };
  const updatableRoles = ["admin", "analyst"];

  if (!updatableRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${updatableRoles.join(", ")}` });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(usersTable.id, req.params.userId as string), eq(usersTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  res.json({ data: { id: updated.id, email: updated.email, role: updated.role } });
});

router.delete("/team/:userId", requireRole("owner", "admin"), async (req, res) => {
  const userId = req.params.userId as string;
  const orgId = req.thea!.org.id;

  const [target] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.orgId, orgId)))
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  if (target.role === "owner") {
    res.status(400).json({ error: "Cannot remove the org owner" });
    return;
  }

  await db
    .delete(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.orgId, orgId)));

  res.status(204).send();
});

export default router;
