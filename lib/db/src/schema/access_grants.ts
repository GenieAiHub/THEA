import { pgTable, timestamp, uuid, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { membersTable } from "./members";
import { accessPointsTable } from "./access_points";

/**
 * Grants a member access to a specific access point. A face scan at an access
 * point is only allowed when an active grant exists for the matched member.
 */
export const accessGrantsTable = pgTable("access_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  accessPointId: uuid("access_point_id")
    .notNull()
    .references(() => accessPointsTable.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("access_grants_org_id_idx").on(table.orgId),
  index("access_grants_member_id_idx").on(table.memberId),
  index("access_grants_access_point_id_idx").on(table.accessPointId),
  unique("access_grants_member_point_uq").on(table.memberId, table.accessPointId),
]);

export const insertAccessGrantSchema = createInsertSchema(accessGrantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectAccessGrantSchema = createSelectSchema(accessGrantsTable);
export type InsertAccessGrant = z.infer<typeof insertAccessGrantSchema>;
export type AccessGrant = typeof accessGrantsTable.$inferSelect;
