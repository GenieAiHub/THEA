---
name: Payments & subscription tier grants
description: How paid PR packages grant internal tiers across Stripe/PayPal/crypto, and the idempotency/expiry rules that keep real-money billing safe
---

# Payments & subscription tier grants

## Plan → tier mapping
Marketing sells three PR packages that each map onto exactly ONE existing internal
tier so all gating (requireTier / TIER_LIMITS) is reused (see `lib/plans.ts`):
- professional → `starter`    (~$99/mo)
- business     → `pro`        (~$499/mo)
- political    → `enterprise` (~$1,999/mo)

**Caveat:** the paid "Professional" package maps to the SAME `starter` tier that
free signups get, so today it grants no extra limits over a free account. This was
an intentional reuse-existing-tiers decision, not a bug — revisit if Professional
needs its own limit band.

## Anti tier-escalation
`/billing/checkout` accepts only `{planKey, interval}` and resolves the Stripe
priceId server-side from env (`priceIdForPlan`). NEVER accept a client-supplied
priceId/tier — that would let a client buy a plan it did not pay for. Invalid
planKey → 400, missing price env → 503.

## Single activation path (PayPal / crypto)
`subscriptionService.activateSubscription()` is the ONLY authoritative tier-grant
path for one-time providers (PayPal capture, USDT tx hash). It:
- writes a durable payments row FIRST, guarded by `unique(provider, provider_ref)`,
- wraps the payment insert + subscription tier update in ONE `db.transaction` (a
  crash between them would take the money yet never grant the tier, then lock the
  customer out forever via the idempotency conflict on retry),
- returns false (idempotent no-op) when the providerRef was already processed.

## Stripe stays separate
Stripe keeps its OWN signature-verified webhook upsert (recurring semantics), NOT
activateSubscription. **Why:** the Stripe subscription id is stable across renewals
and would collide with `unique(provider, provider_ref)`. If Stripe is ever routed
through activateSubscription, use the INVOICE id as providerRef, not the sub id.

## Expiry downgrade (fail-closed) exempts Stripe
`resolveOrgContext` (middlewares/auth.ts) downgrades a non-starter org to starter
for the request once `currentPeriodEnd` lapses — revoking access immediately for
one-time PayPal/crypto plans that don't auto-renew. Stripe subs (rows with a
`stripeSubscriptionId`) are EXEMPT: Stripe drives lifecycle via its own webhooks,
and a hard expiry here would lock out a paying customer at the period boundary if
the renewal webhook is delayed/dropped.

## Operator (admin) grants
`PATCH /admin/orgs/:id/tier` must set `status:"active"` and NULL `currentPeriodEnd`
(manual grants have no billing period) or the expiry check silently downgrades the
org back to starter on the next request.

## Stripe env price IDs
`STRIPE_{STARTER,PRO,ENTERPRISE}_{MONTHLY,ANNUAL}_PRICE_ID` — named by internal
tier, not by plan key. PayPal/crypto use `amountForPlan()` (single up-front charge).
