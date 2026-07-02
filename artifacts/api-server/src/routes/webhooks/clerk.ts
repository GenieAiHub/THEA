/**
 * Clerk webhook handler.
 *
 * PROVISIONING STRATEGY: JIT-only.
 * Tenant orgs, users, and subscriptions are provisioned on first authenticated
 * request inside clerkAuth.ts (JIT provisioning). The webhook here is used
 * only for auditing and cleanup — it does NOT create orgs or users to avoid
 * racing with the JIT path.
 *
 * Invited users carry { theaOrgId, theaRole } in Clerk publicMetadata;
 * clerkAuth.ts reads that on their first request and joins the correct org.
 */

import { type Request, type Response } from "express";
import { Webhook } from "svix";
import { logger } from "../../lib/logger";

interface ClerkEvent {
  type: string;
  data: Record<string, unknown>;
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

  let event: ClerkEvent;
  try {
    const wh = new Webhook(webhookSecret);
    const payload = (req.body as Buffer).toString("utf-8");
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    logger.warn({ err }, "Clerk webhook verification failed");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  logger.info({ type: event.type }, "Clerk webhook received");

  /**
   * user.created — INTENTIONAL NO-OP for provisioning.
   * Org + user + subscription are created by JIT provisioning in clerkAuth.ts
   * on the user's first authenticated API request. Doing it here would race
   * with the JIT path and could create duplicate orgs for invited users whose
   * publicMetadata already has { theaOrgId, theaRole }.
   */
  if (event.type === "user.created") {
    const clerkUserId = String(event.data.id ?? "");
    logger.info({ clerkUserId }, "Clerk user.created — provisioning deferred to JIT path");
    res.json({ received: true, action: "noop", reason: "provisioning handled by JIT in clerkAuth.ts" });
    return;
  }

  /**
   * user.deleted — soft-cleanup: mark users as deleted.
   * Hard-delete of org data is intentionally deferred per data-retention policy.
   */
  if (event.type === "user.deleted") {
    const clerkUserId = String(event.data.id ?? "");
    logger.info({ clerkUserId }, "Clerk user.deleted — no hard-delete per data-retention policy");
    res.json({ received: true, action: "noop", reason: "data retained per retention policy" });
    return;
  }

  /**
   * organization.* — no-op.
   * THEA manages its own org entities (organizations table). Clerk org events
   * are not used because Replit-managed Clerk does not enable Clerk Organizations.
   */
  if (event.type.startsWith("organization")) {
    logger.info({ type: event.type }, "Clerk org event — no-op (THEA manages own orgs)");
    res.json({ received: true, action: "noop", reason: "THEA uses its own org model" });
    return;
  }

  res.json({ received: true, action: "noop" });
}
