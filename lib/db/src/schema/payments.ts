import { pgTable, text, timestamp, uuid, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * A single completed (or pending) payment against an organization, regardless of
 * provider (Stripe card, PayPal, or on-chain USDT crypto). This is the durable
 * audit trail AND the idempotency / replay guard for subscription activation:
 * the (provider, provider_ref) pair is UNIQUE, so the same Stripe subscription,
 * PayPal capture, or crypto transaction hash can never grant a tier twice.
 */
export const paymentsTable = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    // 'stripe' | 'paypal' | 'crypto'
    provider: text("provider").notNull(),
    // Stripe subscription/invoice id, PayPal capture id, or on-chain tx hash.
    providerRef: text("provider_ref").notNull(),
    // 'professional' | 'business' | 'political'
    planKey: text("plan_key"),
    // Resolved internal tier: 'starter' | 'pro' | 'enterprise'
    tier: text("tier").notNull(),
    // 'monthly' | 'annual' | 'one_time'
    interval: text("interval"),
    // Human-readable amount string (e.g. "99.00"); avoids float precision issues
    // and works for both fiat cents-derived values and 6-decimal USDT amounts.
    amount: text("amount"),
    // 'usd' | 'usdt' | ...
    currency: text("currency"),
    // 'completed' | 'pending' | 'failed'
    status: text("status").notNull().default("completed"),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("payments_provider_ref_uq").on(table.provider, table.providerRef),
    index("payments_org_id_idx").on(table.orgId),
    index("payments_org_created_idx").on(table.orgId, table.createdAt),
  ],
);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export const selectPaymentSchema = createSelectSchema(paymentsTable);
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
