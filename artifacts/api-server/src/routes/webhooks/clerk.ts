import { type Request, type Response } from "express";
import { Webhook } from "svix";
import { db } from "@workspace/db";
import { usersTable, organizationsTable, subscriptionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

interface ClerkUserCreatedEvent {
  type: "user.created" | "user.deleted" | "user.updated";
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
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

  let event: ClerkUserCreatedEvent;
  try {
    const wh = new Webhook(webhookSecret);
    const payload = (req.body as Buffer).toString("utf-8");
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch (err) {
    logger.warn({ err }, "Clerk webhook verification failed");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  if (event.type === "user.created") {
    const clerkUserId = event.data.id;
    const primaryEmail = event.data.email_addresses.find(
      (e) => e.id === event.data.primary_email_address_id
    )?.email_address ?? event.data.email_addresses[0]?.email_address ?? "";

    const fullName = [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null;

    const existing = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);
    if (existing[0]) {
      res.json({ received: true, action: "skipped", reason: "user already exists" });
      return;
    }

    const orgName = fullName || primaryEmail.split("@")[0] || "My Organization";
    const slug = `${slugify(orgName)}-${Date.now().toString(36)}`;

    const [org] = await db.insert(organizationsTable).values({ name: orgName, slug, focus: "general" }).returning();
    await db.insert(usersTable).values({ orgId: org.id, clerkUserId, email: primaryEmail, name: fullName, role: "owner" });
    await db.insert(subscriptionsTable).values({ orgId: org.id, tier: "starter", status: "active", maxKeywords: 10, maxCategories: 3, historyDays: 14 });

    logger.info({ clerkUserId, orgId: org.id }, "Clerk webhook: provisioned org + user + subscription");
    res.json({ received: true, action: "provisioned", orgId: org.id });
    return;
  }

  if (event.type === "user.deleted") {
    logger.info({ clerkUserId: event.data.id }, "Clerk user.deleted — no automatic cleanup (data retained per policy)");
  }

  res.json({ received: true, action: "noop" });
}
