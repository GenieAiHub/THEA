import { pgTable, text, timestamp, uuid, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * A service or area that access can be granted to via a face scan
 * (e.g. "Main Gym", "VIP Lounge", "Pool"). Org-scoped.
 */
export const accessPointsTable = pgTable("access_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("access_points_org_id_idx").on(table.orgId),
]);

export const insertAccessPointSchema = createInsertSchema(accessPointsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectAccessPointSchema = createSelectSchema(accessPointsTable);
export type InsertAccessPoint = z.infer<typeof insertAccessPointSchema>;
export type AccessPoint = typeof accessPointsTable.$inferSelect;
