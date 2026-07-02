import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Platform-wide configuration store.
 * All values that are marked is_secret=true are AES-256-GCM encrypted
 * before being written to this column.
 */
export const platformConfigsTable = pgTable("platform_configs", {
  id:              uuid("id").primaryKey().defaultRandom(),
  key:             text("key").unique().notNull(),
  encryptedValue:  text("encrypted_value"),
  category:        text("category").notNull().default("general"),
  label:           text("label").notNull(),
  description:     text("description"),
  isSecret:        boolean("is_secret").notNull().default(true),
  isActive:        boolean("is_active").notNull().default(true),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformConfig    = typeof platformConfigsTable.$inferSelect;
export type NewPlatformConfig = typeof platformConfigsTable.$inferInsert;
