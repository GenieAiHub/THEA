import { pgTable, text, timestamp, uuid, bigint, index, unique, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

/**
 * THEA MMP — mobile measurement / attribution platform.
 *
 * An org registers apps, creates campaign tracking links, and sends
 * server-to-server install/event pings authenticated by the app's ingest
 * token. Clicks on tracking links are recorded publicly (302 redirect) and
 * installs are attributed to the last matching click within a 7-day window
 * via IP-hash + user-agent fingerprinting (or marked organic).
 */
export const mmpAppsTable = pgTable("mmp_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  platform: text("platform").notNull().default("android"), // android | ios | web
  /** S2S ingest auth token (prefix mmpi_). Write-only scope for this app. */
  ingestToken: text("ingest_token").notNull().unique(),
  /** Per-app random salt for click/install IP hashing (stable so the 7-day window matches). */
  ipSalt: text("ip_salt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mmp_apps_org_idx").on(table.orgId),
]);

/** Influencers / creators whose campaigns are measured via dedicated tracking links. */
export const mmpCreatorsTable = pgTable("mmp_creators", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => mmpAppsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** youtube | tiktok | instagram | twitch | other */
  platform: text("platform").notNull().default("other"),
  handle: text("handle"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mmp_creators_org_idx").on(table.orgId),
  index("mmp_creators_app_idx").on(table.appId),
]);

export const mmpTrackingLinksTable = pgTable("mmp_tracking_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => mmpAppsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channel: text("channel").notNull().default("other"), // e.g. facebook_ads | google_ads | tiktok_ads | email | influencer | other
  /** Globally-unique short code used in the public tracking URL. */
  code: text("code").notNull().unique(),
  /** http(s) destination the click 302s to (store page / landing page). */
  destinationUrl: text("destination_url").notNull(),
  /** Optional creator this link belongs to (influencer attribution). */
  creatorId: uuid("creator_id")
    .references(() => mmpCreatorsTable.id, { onDelete: "set null" }),
  /**
   * Optional deferred deep link returned to the SDK on an attributed install.
   * Custom schemes allowed (myapp://…) — javascript:/data: rejected at API layer.
   */
  deepLinkUrl: text("deep_link_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mmp_tracking_links_org_idx").on(table.orgId),
  index("mmp_tracking_links_app_idx").on(table.appId),
  index("mmp_tracking_links_creator_idx").on(table.creatorId),
]);

export const mmpClicksTable = pgTable("mmp_clicks", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Denormalized for org scoping + fingerprint matching without joins. */
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => mmpAppsTable.id, { onDelete: "cascade" }),
  linkId: uuid("link_id")
    .notNull()
    .references(() => mmpTrackingLinksTable.id, { onDelete: "cascade" }),
  /** sha256(app.ipSalt + client IP) — never the raw IP. */
  ipHash: text("ip_hash").notNull(),
  userAgent: text("user_agent"),
  referer: text("referer"),
  country: text("country"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mmp_clicks_app_ts_idx").on(table.appId, table.createdAt),
  index("mmp_clicks_link_ts_idx").on(table.linkId, table.createdAt),
  index("mmp_clicks_iphash_ts_idx").on(table.ipHash, table.createdAt),
]);

export const mmpInstallsTable = pgTable("mmp_installs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => mmpAppsTable.id, { onDelete: "cascade" }),
  /** Caller-supplied stable device identifier (IDFV/GAID/app-install UUID). */
  deviceId: text("device_id").notNull(),
  attributedLinkId: uuid("attributed_link_id")
    .references(() => mmpTrackingLinksTable.id, { onDelete: "set null" }),
  /** The exact click matched at attribution time (for CTIT / fraud analysis). */
  attributedClickId: uuid("attributed_click_id")
    .references(() => mmpClicksTable.id, { onDelete: "set null" }),
  /** Denormalized timestamp of the matched click — survives click row deletion. */
  clickAt: timestamp("click_at", { withTimezone: true }),
  /** fingerprint | organic */
  method: text("method").notNull().default("organic"),
  /** Set when ingest-time fraud heuristics fire: ctit_too_short | click_flood */
  suspectReason: text("suspect_reason"),
  /** Set by POST /ingest/uninstall. */
  uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mmp_installs_app_ts_idx").on(table.appId, table.createdAt),
  index("mmp_installs_link_idx").on(table.attributedLinkId),
  unique("mmp_installs_app_device_uq").on(table.appId, table.deviceId),
]);

export const mmpEventsTable = pgTable("mmp_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .notNull()
    .references(() => mmpAppsTable.id, { onDelete: "cascade" }),
  installId: uuid("install_id")
    .references(() => mmpInstallsTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  /** Revenue in micro-USD (1 USD = 1_000_000), bigint per wallet-ledger convention. */
  revenueMicro: bigint("revenue_micro", { mode: "bigint" }).notNull().default(sql`0`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mmp_events_app_ts_idx").on(table.appId, table.createdAt),
  index("mmp_events_install_idx").on(table.installId),
  index("mmp_events_name_idx").on(table.name),
]);

/** Daily ad spend per tracking link (manual entry or CSV import) for ROAS/CPI. */
export const mmpLinkCostsTable = pgTable("mmp_link_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  linkId: uuid("link_id")
    .notNull()
    .references(() => mmpTrackingLinksTable.id, { onDelete: "cascade" }),
  /** Calendar day (UTC) the spend applies to. */
  day: date("day").notNull(),
  /** Spend in micro-USD (1 USD = 1_000_000). */
  costMicro: bigint("cost_micro", { mode: "bigint" }).notNull().default(sql`0`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mmp_link_costs_org_idx").on(table.orgId),
  unique("mmp_link_costs_link_day_uq").on(table.linkId, table.day),
]);

/**
 * Rolling ingest log for the SDK debugger — every ingest hit (accepted or
 * rejected) with a truncated, token-redacted payload. Time-capped: rows older
 * than 72h are deleted opportunistically on insert.
 */
export const mmpIngestLogTable = pgTable("mmp_ingest_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Nullable — unknown-token rejects have no resolved app/org. */
  orgId: uuid("org_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  appId: uuid("app_id")
    .references(() => mmpAppsTable.id, { onDelete: "cascade" }),
  /** install | event | uninstall */
  kind: text("kind").notNull(),
  /** ok | rejected */
  status: text("status").notNull(),
  /** Rejection reason (validation error) when status = rejected. */
  reason: text("reason"),
  /** JSON payload truncated to ~2KB, X-Ingest-Token never included. */
  payload: text("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mmp_ingest_log_app_ts_idx").on(table.appId, table.createdAt),
  index("mmp_ingest_log_ts_idx").on(table.createdAt),
]);

export const insertMmpAppSchema = createInsertSchema(mmpAppsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectMmpAppSchema = createSelectSchema(mmpAppsTable);
export type InsertMmpApp = z.infer<typeof insertMmpAppSchema>;
export type MmpApp = typeof mmpAppsTable.$inferSelect;

export const insertMmpTrackingLinkSchema = createInsertSchema(mmpTrackingLinksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectMmpTrackingLinkSchema = createSelectSchema(mmpTrackingLinksTable);
export type InsertMmpTrackingLink = z.infer<typeof insertMmpTrackingLinkSchema>;
export type MmpTrackingLink = typeof mmpTrackingLinksTable.$inferSelect;

export const insertMmpClickSchema = createInsertSchema(mmpClicksTable).omit({ id: true, createdAt: true });
export type InsertMmpClick = z.infer<typeof insertMmpClickSchema>;
export type MmpClick = typeof mmpClicksTable.$inferSelect;

export const insertMmpInstallSchema = createInsertSchema(mmpInstallsTable).omit({ id: true, createdAt: true });
export type InsertMmpInstall = z.infer<typeof insertMmpInstallSchema>;
export type MmpInstall = typeof mmpInstallsTable.$inferSelect;

export const insertMmpEventSchema = createInsertSchema(mmpEventsTable).omit({ id: true, createdAt: true });
export type InsertMmpEvent = z.infer<typeof insertMmpEventSchema>;
export type MmpEvent = typeof mmpEventsTable.$inferSelect;

export const insertMmpCreatorSchema = createInsertSchema(mmpCreatorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectMmpCreatorSchema = createSelectSchema(mmpCreatorsTable);
export type InsertMmpCreator = z.infer<typeof insertMmpCreatorSchema>;
export type MmpCreator = typeof mmpCreatorsTable.$inferSelect;

export const insertMmpLinkCostSchema = createInsertSchema(mmpLinkCostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMmpLinkCost = z.infer<typeof insertMmpLinkCostSchema>;
export type MmpLinkCost = typeof mmpLinkCostsTable.$inferSelect;

export const insertMmpIngestLogSchema = createInsertSchema(mmpIngestLogTable).omit({ id: true, createdAt: true });
export type InsertMmpIngestLog = z.infer<typeof insertMmpIngestLogSchema>;
export type MmpIngestLog = typeof mmpIngestLogTable.$inferSelect;
