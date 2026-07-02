import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface OrgNotificationConfig {
  slackWebhookUrl?: string;
  smsNumbers?: string[];
  emailEnabled?: boolean;
  slackEnabled?: boolean;
}

export const organizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").default("#6366f1"),
  focus: text("focus").notNull().default("general"),
  clerkOrgId: text("clerk_org_id").unique(),
  categories: jsonb("categories").default([]).$type<string[]>(),
  notificationConfig: jsonb("notification_config").default({}).$type<OrgNotificationConfig>(),
  pausedAt: timestamp("paused_at"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectOrganizationSchema = createSelectSchema(organizationsTable);
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
