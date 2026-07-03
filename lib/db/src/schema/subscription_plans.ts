import { pgTable, text, timestamp, uuid, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Operator-managed catalogue of subscription plans (packages) surfaced in the
 * Super Admin console. Seeded once from the hard-coded PLANS baseline, then fully
 * CRUD-editable by operators.
 *
 * IMPORTANT: this table is the source of truth for the plan CATALOGUE (what plans
 * exist, their display prices, and which internal tier they grant). It is NOT the
 * source of truth for what real customers are CHARGED at checkout — Stripe/PayPal/
 * crypto amounts stay wired to lib/plans.ts (amountForPlan) + env price IDs
 * (priceIdForPlan). Real entitlements always derive from `tier` via TIER_LIMITS /
 * TIER_FEATURES; `features` here is a display-only marketing bullet list.
 */
export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stable slug (e.g. "professional"). Unique so seeding/reads are deterministic.
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  // Internal tier granted by this plan: 'starter' | 'pro' | 'enterprise'.
  tier: text("tier").notNull(),
  // Sticker prices in whole USD (display/catalogue only — see note above).
  priceMonthly: integer("price_monthly").notNull().default(0),
  priceAnnual: integer("price_annual").notNull().default(0),
  // Display-only marketing bullet points.
  features: jsonb("features").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const tierEnum = z.enum(["starter", "pro", "enterprise"]);

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlansTable, {
  tier: tierEnum,
  // Optional on insert — the columns carry DB defaults, so a minimal
  // { key, name, tier } body is valid and any duplicate key still reaches the
  // unique-constraint check (409) rather than being masked by a 400.
  priceMonthly: z.number().int().min(0).optional(),
  priceAnnual: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const selectSubscriptionPlanSchema = createSelectSchema(subscriptionPlansTable);
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
