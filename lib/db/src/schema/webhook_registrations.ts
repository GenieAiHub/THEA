import { pgTable, text, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const webhookRegistrationsTable = pgTable("webhook_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: jsonb("events").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  lastDeliveredAt: timestamp("last_delivered_at"),
  failureCount: text("failure_count").default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWebhookRegistrationSchema = createInsertSchema(webhookRegistrationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectWebhookRegistrationSchema = createSelectSchema(webhookRegistrationsTable);
export type InsertWebhookRegistration = z.infer<typeof insertWebhookRegistrationSchema>;
export type WebhookRegistration = typeof webhookRegistrationsTable.$inferSelect;
