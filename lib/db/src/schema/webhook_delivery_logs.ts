import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { webhookRegistrationsTable } from "./webhook_registrations";
import { organizationsTable } from "./organizations";

export const webhookDeliveryLogsTable = pgTable("webhook_delivery_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookRegistrationId: uuid("webhook_registration_id")
    .notNull()
    .references(() => webhookRegistrationsTable.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  targetUrl: text("target_url").notNull(),
  status: text("status").notNull(), // "success" | "failed"
  httpStatus: integer("http_status"),
  attempt: integer("attempt").notNull().default(1),
  responseSnippet: text("response_snippet"),
  deliveredAt: timestamp("delivered_at").notNull().defaultNow(),
});

export const selectWebhookDeliveryLogSchema = createSelectSchema(webhookDeliveryLogsTable);
export type WebhookDeliveryLog = typeof webhookDeliveryLogsTable.$inferSelect;
