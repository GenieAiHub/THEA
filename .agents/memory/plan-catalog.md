---
name: Plan catalogue + manual comp grants
description: DB-backed subscription plan catalogue and free/comp plan grants in Super Admin — what is authoritative vs. display-only, and the expiry/Stripe interaction rules
---

# Plan catalogue (subscription_plans) + manual grants

Operator-managed `subscription_plans` table backs a CRUD catalogue in Super Admin
plus a "grant any plan to any org for free" (comp) action in the org detail modal.

## What is authoritative vs. display-only
- `subscription_plans` is the source of truth for the **catalogue** only: which
  plans exist, their **display** prices, and which internal `tier` each grants.
- It is **NOT** the source of truth for what customers are **charged** at
  checkout — real Stripe/PayPal/crypto amounts stay wired to `lib/plans.ts`
  (`amountForPlan`) + env price IDs (`priceIdForPlan`).
- Entitlements always derive from `tier` via `TIER_LIMITS`; the plan's `features`
  column is a display-only marketing bullet list.
- **Why:** keeps money handling in code (audited, testable) while letting
  operators freely edit catalogue presentation without risk of changing charges.

## Seed rule
- Seed the 3 baseline plans ONLY when the table is empty (`count()==0`), never
  upsert-per-boot. **Why:** upserting would clobber operator edits and resurrect
  plans an operator deleted. Seeded from `PLANS`, tier→features derived factually
  from `TIER_LIMITS`.

## Manual comp grant semantics (activate-plan route)
- Goes through the single authoritative `activateSubscription` path with
  `provider:"manual"`, `amount:"0.00"`, `providerRef:randomUUID()`, audit metadata.
- `periodEnd` is `Date | null`: **null explicitly CLEARS** `currentPeriodEnd`
  (open-ended comp), a Date sets expiry, undefined leaves unchanged. The route
  always passes Date-or-null (never undefined) so a stale lapsed value can't
  silently downgrade the org back to starter.
- Refuse (409) a comp only when a **LIVE** Stripe sub exists. The guard tests
  `sub.stripeSubscriptionId` truthiness — so the `customer.subscription.deleted`
  webhook MUST clear `stripeSubscriptionId` (and `stripePriceId`) on cancel,
  otherwise any org that EVER subscribed via Stripe is permanently blocked from a
  comp. **Why:** requirement is "block only a live sub"; a canceled sub must free
  the org for manual grants.

## drizzle-zod gotcha
- Overriding a column in `createInsertSchema(table, { col: z.number()... })`
  makes it **required even if the DB column has `.default()`**. Add `.optional()`
  to the override, or a minimal insert body 400s ("expected number, received
  undefined") and a duplicate-key insert never reaches the 409 path.
