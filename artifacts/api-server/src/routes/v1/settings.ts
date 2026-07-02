import { Router } from "express";
import { db } from "@workspace/db";
import { organizationsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/clerkAuth";

const router = Router();
router.use(requireAuth);

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
  const VALID_ROLES = ["owner", "admin", "analyst"];

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
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

  res.status(202).json({
    message: "Invitation sent",
    email,
    role,
    note: "The user will be provisioned when they sign up via Clerk and authenticate for the first time. Manual seat management via Clerk dashboard is required for enterprise team access control.",
  });
});

router.patch("/team/:userId/role", requireRole("owner"), async (req, res) => {
  const { role } = req.body as { role: string };
  const VALID_ROLES = ["admin", "analyst"];

  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
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
  const [removed] = await db
    .delete(usersTable)
    .where(and(eq(usersTable.id, req.params.userId as string), eq(usersTable.orgId, req.thea!.org.id)))
    .returning();

  if (!removed) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  if (removed.role === "owner") {
    res.status(400).json({ error: "Cannot remove the org owner" });
    return;
  }

  res.status(204).send();
});

export default router;
