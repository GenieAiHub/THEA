/**
 * Clerk webhook handler.
 *
 * PROVISIONING STRATEGY: Webhook-first, JIT as fallback.
 *
 * - user.created fires immediately after Clerk signup/invitation acceptance.
 *   We provision org + user + subscription here so the record exists before
 *   the user's first API call.
 * - Invited users: Clerk copies invitation publicMetadata onto the user, so
 *   event.data.public_metadata contains { theaOrgId, theaRole } set in
 *   settings.ts when the invitation was created. We join the existing org
 *   instead of creating a new one.
 * - clerkAuth.ts JIT provisioning guards against any race: it checks for an
 *   existing user first and skips creation if the webhook already fired.
 *
 * org events: no-op — THEA manages its own org model via the organizations
 * table; Replit-managed Clerk does not enable Clerk Organizations.
 */

import { type Request, type Response } from "express";
import { Webhook } from "svix";
import { db } from "@workspace/db";
import { usersTable, organizationsTable, subscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

interface ClerkUserEvent {
  type: "user.created" | "user.deleted" | "user.updated" | string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    public_metadata?: { theaOrgId?: string; theaRole?: string };
  };
}

function slugify(str: string): string {
  return (
    str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "org"
  );
}

export async function handleClerkWebhook(req: Request, res: Response): Promise<void> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.warn("CLERK_WEBHOOK_SECRET not set — Clerk webhook endpoint is disabled");
    res.status(503).json({ error: "Clerk webhook secret not configured" });
    return;
  }

  const svixId = req.headers["svix-id"] as string;
  const svixTimestamp = req.headers["svix-timestamp"] as string;
  const svixSignature = req.headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: "Missing svix headers" });
    return;
  }

  let event: ClerkUserEvent;
  try {
    const wh = new Webhook(webhookSecret);
    const payload = (req.body as Buffer).toString("utf-8");
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch (err) {
    logger.warn({ err }, "Clerk webhook verification failed");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  logger.info({ type: event.type }, "Clerk webhook received");

  if (event.type === "user.created") {
    const clerkUserId = event.data.id;
    const primaryEmail =
      event.data.email_addresses.find((e) => e.id === event.data.primary_email_address_id)
        ?.email_address ??
      event.data.email_addresses[0]?.email_address ??
      "";
    const fullName = [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null;
    const publicMeta = event.data.public_metadata ?? {};

    // Idempotency guard — JIT provisioning may have already created this user
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkUserId, clerkUserId))
      .limit(1);
    if (existing[0]) {
      logger.info({ clerkUserId }, "Clerk webhook: user already provisioned — skipping");
      res.json({ received: true, action: "skipped", reason: "user already exists" });
      return;
    }

    const invitedOrgId = typeof publicMeta.theaOrgId === "string" ? publicMeta.theaOrgId : null;
    const invitedRole = typeof publicMeta.theaRole === "string" ? publicMeta.theaRole : "member";

    if (invitedOrgId) {
      // Invited user — join existing org with the specified role
      const org = await db.select().from(organizationsTable).where(eq(organizationsTable.id, invitedOrgId)).limit(1);
      if (!org[0]) {
        logger.warn({ clerkUserId, invitedOrgId }, "Clerk webhook: invited org not found — creating standalone org");
      } else {
        await db.insert(usersTable).values({
          orgId: invitedOrgId,
          clerkUserId,
          email: primaryEmail,
          name: fullName,
          role: invitedRole as "owner" | "admin" | "analyst",
        });
        logger.info({ clerkUserId, orgId: invitedOrgId, role: invitedRole }, "Clerk webhook: invited user joined existing org");
        res.json({ received: true, action: "joined", orgId: invitedOrgId, role: invitedRole });
        return;
      }
    }

    // New signup — provision org + user (owner) + starter subscription
    const orgName = fullName || primaryEmail.split("@")[0] || "My Organization";
    const slug = `${slugify(orgName)}-${Date.now().toString(36)}`;

    const [org] = await db
      .insert(organizationsTable)
      .values({ name: orgName, slug, focus: "general" })
      .returning();
    await db.insert(usersTable).values({
      orgId: org.id,
      clerkUserId,
      email: primaryEmail,
      name: fullName,
      role: "owner",
    });
    await db.insert(subscriptionsTable).values({
      orgId: org.id,
      tier: "starter",
      status: "active",
      maxKeywords: 10,
      maxCategories: 3,
      historyDays: 14,
    });

    logger.info({ clerkUserId, orgId: org.id }, "Clerk webhook: provisioned org + user + subscription");
    res.json({ received: true, action: "provisioned", orgId: org.id });
    return;
  }

  if (event.type === "user.deleted") {
    const clerkUserId = event.data.id;
    logger.info({ clerkUserId }, "Clerk user.deleted — no hard-delete per data-retention policy");
    res.json({ received: true, action: "noop", reason: "data retained per retention policy" });
    return;
  }

  // organization.* — no-op: THEA manages its own org model
  if (event.type.startsWith("organization")) {
    logger.info({ type: event.type }, "Clerk org event — no-op (THEA uses its own org model)");
    res.json({ received: true, action: "noop", reason: "THEA uses its own org model" });
    return;
  }

  res.json({ received: true, action: "noop" });
}
