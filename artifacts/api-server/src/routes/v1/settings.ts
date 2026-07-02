import { Router } from "express";
import { createClerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { organizationsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/clerkAuth";
import { logger } from "../../lib/logger";

const router = Router();
router.use(requireAuth);

const VALID_ROLES = ["owner", "admin", "analyst"];

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY not configured");
  return createClerkClient({ secretKey });
}

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
      clerkUserId: m.clerkUserId,
      joinedAt: m.createdAt,
    })),
  });
});

router.post("/team/invite", requireRole("owner", "admin"), async (req, res) => {
  const { email, role = "analyst" } = req.body as { email: string; role?: string };

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  if (!VALID_ROLES.includes(role) || role === "owner") {
    res.status(400).json({ error: `role must be one of: ${VALID_ROLES.filter((r) => r !== "owner").join(", ")}` });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, email), eq(usersTable.orgId, req.thea!.org.id)))
    .limit(1);

  if (existing[0]) {
    res.status(409).json({ error: "This email is already a member of your organization" });
    return;
  }

  try {
    const clerkClient = getClerkClient();
    await clerkClient.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/onboarding` : undefined,
      publicMetadata: {
        theaOrgId: req.thea!.org.id,
        theaRole: role,
        invitedBy: req.thea!.user.id,
      },
    });
    logger.info({ orgId: req.thea!.org.id, email, role }, "Clerk invitation sent");
  } catch (err) {
    logger.error({ err, email }, "Failed to create Clerk invitation");
    res.status(502).json({ error: "Failed to send invitation. Please try again." });
    return;
  }

  res.status(202).json({
    message: "Invitation sent",
    email,
    role,
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
