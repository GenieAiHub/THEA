import { pgTable, text, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const emailPreferencesTable = pgTable("email_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }).unique(),
  recipients: jsonb("recipients").notNull().default([]),
  digestEnabled: boolean("digest_enabled").notNull().default(true),
  digestFrequency: text("digest_frequency").notNull().default("weekly"),
  digestDay: text("digest_day").default("monday"),
  digestHour: text("digest_hour").default("7"),
  alertEmailEnabled: boolean("alert_email_enabled").notNull().default(true),
  minSeverityForEmail: text("min_severity_for_email").default("medium"),
  phoneNumbers: jsonb("phone_numbers").default([]),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  slackWebhookUrl: text("slack_webhook_url"),
  teamsWebhookUrl: text("teams_webhook_url"),
  telegramChatId: text("telegram_chat_id"),
  whatsappNumbers: jsonb("whatsapp_numbers").default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailPreferenceSchema = createInsertSchema(emailPreferencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectEmailPreferenceSchema = createSelectSchema(emailPreferencesTable);
export type InsertEmailPreference = z.infer<typeof insertEmailPreferenceSchema>;
export type EmailPreference = typeof emailPreferencesTable.$inferSelect;
