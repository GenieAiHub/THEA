import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * A "member" / "person" managed by an org (e.g. gym/club member, attendee,
 * customer). DISTINCT from THEA's B2B staff `users`. Faces enrolled for these
 * members power the mobile face-scan access-control flow.
 */
export const membersTable = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  externalRef: text("external_ref"),
  status: text("status").notNull().default("active"),
  // Biometric consent — REQUIRED before any face can be enrolled.
  consentGivenAt: timestamp("consent_given_at"),
  consentVersion: text("consent_version"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("members_org_id_idx").on(table.orgId),
  index("members_org_status_idx").on(table.orgId, table.status),
]);

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectMemberSchema = createSelectSchema(membersTable);
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
