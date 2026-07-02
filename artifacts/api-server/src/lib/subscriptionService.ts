import { db } from "@workspace/db";
import { subscriptionsTable, paymentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { TIER_LIMITS, type Tier } from "../middlewares/featureGate";
import { logger } from "./logger";

export type PaymentProvider = "stripe" | "paypal" | "crypto";

export interface ActivateSubscriptionArgs {
  orgId: string;
  tier: Tier;
  provider: PaymentProvider;
  /** Unique, provider-scoped reference (Stripe sub id, PayPal capture id, tx hash). */
  providerRef: string;
  planKey?: string;
  interval?: "monthly" | "annual" | "one_time";
  /** Human-readable amount, e.g. "99.00". */
  amount?: string;
  currency?: string;
  periodStart?: Date;
  periodEnd?: Date;
  /** Subscription status to persist (defaults to "active"). */
  status?: string;
  stripe?: {
    customerId?: string;
    subscriptionId?: string;
    priceId?: string;
    cancelAtPeriodEnd?: boolean;
  };
  metadata?: Record<string, unknown>;
}

/**
 * The single, authoritative path for granting a paid tier to an organization.
 *
 * Every payment provider (Stripe, PayPal, crypto) funnels through here so that:
 *  - the tier -> limits mapping is applied in exactly one place (TIER_LIMITS),
 *  - a durable, idempotent payment record is written first (the UNIQUE
 *    (provider, provider_ref) constraint blocks double-granting / replay),
 *  - callers cannot set arbitrary limits or bypass tier derivation.
 *
 * Returns `false` when the payment reference was already processed (idempotent
 * no-op), `true` when a new activation was applied.
 */
export async function activateSubscription(args: ActivateSubscriptionArgs): Promise<boolean> {
  const limits = TIER_LIMITS[args.tier];

  // The payment insert (idempotency guard) and the tier grant MUST commit
  // atomically. As two separate statements, a crash between them would record
  // the payment yet never grant the tier — and every retry would then short
  // circuit on the UNIQUE (provider, provider_ref) conflict, permanently
  // locking out a customer who already paid. The transaction makes both
  // all-or-nothing.
  return await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(paymentsTable)
      .values({
        orgId: args.orgId,
        provider: args.provider,
        providerRef: args.providerRef,
        planKey: args.planKey ?? null,
        tier: args.tier,
        interval: args.interval ?? null,
        amount: args.amount ?? null,
        currency: args.currency ?? null,
        status: "completed",
        metadata: args.metadata ?? {},
      })
      .onConflictDoNothing({ target: [paymentsTable.provider, paymentsTable.providerRef] })
      .returning({ id: paymentsTable.id });

    if (inserted.length === 0) {
      logger.info(
        { orgId: args.orgId, provider: args.provider, providerRef: args.providerRef },
        "activateSubscription: payment already processed — skipping (idempotent)",
      );
      return false;
    }

    await tx
      .update(subscriptionsTable)
      .set({
        tier: args.tier,
        status: args.status ?? "active",
        currentPeriodStart: args.periodStart ?? new Date(),
        ...(args.periodEnd !== undefined ? { currentPeriodEnd: args.periodEnd } : {}),
        ...limits,
        ...(args.stripe?.customerId ? { stripeCustomerId: args.stripe.customerId } : {}),
        ...(args.stripe?.subscriptionId ? { stripeSubscriptionId: args.stripe.subscriptionId } : {}),
        ...(args.stripe?.priceId ? { stripePriceId: args.stripe.priceId } : {}),
        ...(args.stripe?.cancelAtPeriodEnd !== undefined
          ? { cancelAtPeriodEnd: String(args.stripe.cancelAtPeriodEnd) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.orgId, args.orgId));

    logger.info(
      { orgId: args.orgId, tier: args.tier, provider: args.provider, planKey: args.planKey },
      "Subscription activated",
    );
    return true;
  });
}

/**
 * Downgrade an organization to the free starter tier (e.g. cancellation,
 * expiry, or refund). Kept here so downgrade limits stay consistent too.
 */
export async function downgradeToStarter(orgId: string, status: string = "canceled"): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({ tier: "starter", status, ...TIER_LIMITS.starter, updatedAt: new Date() })
    .where(eq(subscriptionsTable.orgId, orgId));
  logger.info({ orgId, status }, "Subscription downgraded to starter");
}
