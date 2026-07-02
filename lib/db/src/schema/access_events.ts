import { pgTable, text, timestamp, uuid, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { membersTable } from "./members";
import { accessPointsTable } from "./access_points";

/**
 * Audit log of every face-scan access attempt. ALWAYS written, whether the
 * decision was granted or denied. memberId/accessPointId are set null (not
 * cascade-deleted) so the audit trail survives member/point deletion.
 */
export const accessEventsTable = pgTable("access_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  accessPointId: uuid("access_point_id").references(() => accessPointsTable.id, { onDelete: "set null" }),
  memberId: uuid("member_id").references(() => membersTable.id, { onDelete: "set null" }),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  distance: real("distance"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("access_events_org_id_idx").on(table.orgId),
  index("access_events_org_created_idx").on(table.orgId, table.createdAt),
]);

export const insertAccessEventSchema = createInsertSchema(accessEventsTable).omit({ id: true, createdAt: true });
export const selectAccessEventSchema = createSelectSchema(accessEventsTable);
export type InsertAccessEvent = z.infer<typeof insertAccessEventSchema>;
export type AccessEvent = typeof accessEventsTable.$inferSelect;
