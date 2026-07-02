import Stripe from "stripe";
import { db } from "@workspace/db";
import { subscriptionsTable, organizationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import type { Tier } from "../middlewares/featureGate";

const TIER_LIMITS: Record<Tier, { maxKeywords: number; maxCategories: number; historyDays: number }> = {
  starter: { maxKeywords: 10, maxCategories: 3, historyDays: 14 },
  pro: { maxKeywords: 50, maxCategories: 7, historyDays: 90 },
  enterprise: { maxKeywords: 9999, maxCategories: 99, historyDays: 3650 },
};

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured — set it in environment variables");
  return new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" as any });
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return secret;
}

function tierFromPriceId(priceId: string): Tier {
  const PRO_PRICES = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  ].filter(Boolean);

  const ENT_PRICES = [
    process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
  ].filter(Boolean);

  if (ENT_PRICES.includes(priceId)) return "enterprise";
  if (PRO_PRICES.includes(priceId)) return "pro";
  return "starter";
}

export async function handleStripeSubscriptionUpsert(
  stripeSub: Stripe.Subscription,
  customerId: string
): Promise<void> {
  const priceId = stripeSub.items.data[0]?.price?.id ?? "";
  const tier = tierFromPriceId(priceId);
  const limits = TIER_LIMITS[tier];

  const existing = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.stripeCustomerId, customerId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(subscriptionsTable)
      .set({
        stripeSubscriptionId: stripeSub.id,
        stripePriceId: priceId,
        tier,
        status: stripeSub.status,
        currentPeriodStart: new Date(((stripeSub as any).current_period_start as number) * 1000),
        currentPeriodEnd: new Date(((stripeSub as any).current_period_end as number) * 1000),
        cancelAtPeriodEnd: String(stripeSub.cancel_at_period_end),
        ...limits,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.stripeCustomerId, customerId));
    logger.info({ customerId, tier, status: stripeSub.status }, "Stripe subscription updated");
  } else {
    // No existing subscription by Stripe customer ID.
    // Recover using thea_org_id embedded in subscription metadata at checkout creation time.
    const orgId = stripeSub.metadata?.thea_org_id;
    if (orgId) {
      const existingByOrg = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.orgId, orgId))
        .limit(1);

      if (existingByOrg[0]) {
        await db
          .update(subscriptionsTable)
          .set({
            stripeCustomerId: customerId,
            stripeSubscriptionId: stripeSub.id,
            stripePriceId: priceId,
            tier,
            status: stripeSub.status,
            currentPeriodStart: new Date(((stripeSub as any).current_period_start as number) * 1000),
            currentPeriodEnd: new Date(((stripeSub as any).current_period_end as number) * 1000),
            cancelAtPeriodEnd: String(stripeSub.cancel_at_period_end),
            ...limits,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionsTable.orgId, orgId));
        logger.info({ customerId, tier, status: stripeSub.status, orgId }, "Stripe subscription linked via metadata (customer ID was missing)");
      } else {
        await db.insert(subscriptionsTable).values({
          orgId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: stripeSub.id,
          stripePriceId: priceId,
          tier,
          status: stripeSub.status,
          currentPeriodStart: new Date(((stripeSub as any).current_period_start as number) * 1000),
          currentPeriodEnd: new Date(((stripeSub as any).current_period_end as number) * 1000),
          cancelAtPeriodEnd: String(stripeSub.cancel_at_period_end),
          ...limits,
        });
        logger.info({ customerId, tier, status: stripeSub.status, orgId }, "Stripe subscription inserted via metadata recovery");
      }
    } else {
      logger.warn({ customerId }, "Stripe subscription upsert: no org found for customer — missing metadata.thea_org_id");
    }
  }
}

export async function handleStripeSubscriptionDeleted(customerId: string): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({ status: "canceled", tier: "starter", ...TIER_LIMITS.starter, updatedAt: new Date() })
    .where(eq(subscriptionsTable.stripeCustomerId, customerId));

  logger.info({ customerId }, "Stripe subscription cancelled — org downgraded to starter");
}

export async function handleStripeInvoicePaymentFailed(customerId: string): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(subscriptionsTable.stripeCustomerId, customerId));

  logger.warn({ customerId }, "Stripe payment failed — subscription marked past_due");
}

export async function createCheckoutSession(
  orgId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripeClient();

  const subRows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.orgId, orgId)).limit(1);
  const orgRows = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  if (!orgRows[0]) throw new Error("Organization not found");

  let customerId = subRows[0]?.stripeCustomerId ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { thea_org_id: orgId },
    });
    customerId = customer.id;
    if (subRows[0]) {
      await db
        .update(subscriptionsTable)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(subscriptionsTable.orgId, orgId));
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { thea_org_id: orgId },
    subscription_data: { metadata: { thea_org_id: orgId } },
  });

  return session.url!;
}

export async function createBillingPortalSession(orgId: string, returnUrl: string): Promise<string> {
  const stripe = getStripeClient();

  const subRows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.orgId, orgId)).limit(1);
  const customerId = subRows[0]?.stripeCustomerId;
  if (!customerId) throw new Error("No Stripe customer found for this organization");

  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}
