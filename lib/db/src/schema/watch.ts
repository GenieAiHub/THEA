import {
  pgTable,
  text,
  timestamp,
  uuid,
  real,
  integer,
  boolean,
  jsonb,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

const vector = customType<{ data: number[]; config: { dimensions: number }; configRequired: true; driverData: string }>({
  dataType(config) {
    return `vector(${config.dimensions})`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map(parseFloat);
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

/**
 * Security Watch — camera network visual search.
 *
 * A registered live camera (RTSP/HTTP stream) that the frame sampler polls.
 * Health fields are updated by the sampler on state change only.
 */
export const watchCamerasTable = pgTable("watch_cameras", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location"),
  streamUrl: text("stream_url").notNull(),
  /** How the camera was registered: a standalone IP camera or a DVR/NVR channel. */
  sourceType: text("source_type").notNull().default("ip-camera"), // ip-camera | dvr
  dvrBrand: text("dvr_brand"), // hikvision | dahua | uniview | reolink | generic (dvr only)
  dvrHost: text("dvr_host"), // DVR host:port label for grouping channels (dvr only)
  dvrChannel: integer("dvr_channel"), // 1-based channel number on the DVR (dvr only)
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("offline"), // online | offline | error
  lastSeenAt: timestamp("last_seen_at"),
  lastError: text("last_error"),
  sampleIntervalSec: integer("sample_interval_sec").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("watch_cameras_org_id_idx").on(table.orgId),
]);

/** Per-target alert channel preferences (all optional, default off). */
export interface WatchAlertChannels {
  email?: boolean;
  emails?: string[];
  webhook?: boolean;
  slack?: boolean;
  teams?: boolean;
}

/**
 * What the org is looking for: a person (face reference photos), a vehicle or
 * generic object (reference images matched by class + visual similarity), or a
 * license plate (normalized text matched via OCR).
 */
export const watchTargetsTable = pgTable("watch_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // person | vehicle | object | plate
  plateText: text("plate_text"), // normalized (uppercase alphanumeric) for type=plate
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  minConfidence: real("min_confidence"), // null = per-type default
  cooldownSec: integer("cooldown_sec").notNull().default(300),
  alertChannels: jsonb("alert_channels").$type<WatchAlertChannels>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("watch_targets_org_id_idx").on(table.orgId),
]);

/**
 * Reference images for a watch target. Person targets store a 128-d face
 * descriptor; vehicle/object targets store a 1280-d MobileNetV2 embedding.
 */
export const watchTargetImagesTable = pgTable("watch_target_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => watchTargetsTable.id, { onDelete: "cascade" }),
  imagePath: text("image_path").notNull(),
  faceEmbedding: vector("face_embedding", { dimensions: 128 }),
  objectEmbedding: vector("object_embedding", { dimensions: 1280 }),
  detectedClass: text("detected_class"), // coco-ssd class found in the reference image
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("watch_target_images_org_id_idx").on(table.orgId),
  index("watch_target_images_target_id_idx").on(table.targetId),
]);

/**
 * An uploaded recording being scanned offline. Frames are extracted with
 * ffmpeg and run through the same recognition pipeline as live cameras.
 */
export const watchVideoJobsTable = pgTable("watch_video_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  progress: real("progress").notNull().default(0), // 0..1
  durationSec: real("duration_sec"),
  framesScanned: integer("frames_scanned").notNull().default(0),
  sightingsCount: integer("sightings_count").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("watch_video_jobs_org_id_idx").on(table.orgId),
]);

/**
 * A match of a watch target in a frame (live camera or offline video).
 * target/camera/videoJob FKs are set-null so the audit trail survives deletion,
 * mirroring access_events.
 */
export const watchSightingsTable = pgTable("watch_sightings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  targetId: uuid("target_id").references(() => watchTargetsTable.id, { onDelete: "set null" }),
  cameraId: uuid("camera_id").references(() => watchCamerasTable.id, { onDelete: "set null" }),
  videoJobId: uuid("video_job_id").references(() => watchVideoJobsTable.id, { onDelete: "set null" }),
  matchType: text("match_type").notNull(), // face | object | plate
  detail: text("detail"), // e.g. detected class or OCR'd plate text
  confidence: real("confidence"),
  snapshotPath: text("snapshot_path"),
  videoOffsetSec: real("video_offset_sec"),
  alerted: boolean("alerted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("watch_sightings_org_created_idx").on(table.orgId, table.createdAt),
  index("watch_sightings_target_camera_idx").on(table.targetId, table.cameraId, table.createdAt),
  index("watch_sightings_video_job_idx").on(table.videoJobId),
]);

export const insertWatchCameraSchema = createInsertSchema(watchCamerasTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectWatchCameraSchema = createSelectSchema(watchCamerasTable);
export type InsertWatchCamera = z.infer<typeof insertWatchCameraSchema>;
export type WatchCamera = typeof watchCamerasTable.$inferSelect;

export const insertWatchTargetSchema = createInsertSchema(watchTargetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectWatchTargetSchema = createSelectSchema(watchTargetsTable);
export type InsertWatchTarget = z.infer<typeof insertWatchTargetSchema>;
export type WatchTarget = typeof watchTargetsTable.$inferSelect;

export const insertWatchTargetImageSchema = createInsertSchema(watchTargetImagesTable).omit({ id: true, createdAt: true });
export const selectWatchTargetImageSchema = createSelectSchema(watchTargetImagesTable);
export type InsertWatchTargetImage = z.infer<typeof insertWatchTargetImageSchema>;
export type WatchTargetImage = typeof watchTargetImagesTable.$inferSelect;

export const insertWatchVideoJobSchema = createInsertSchema(watchVideoJobsTable).omit({ id: true, createdAt: true });
export const selectWatchVideoJobSchema = createSelectSchema(watchVideoJobsTable);
export type InsertWatchVideoJob = z.infer<typeof insertWatchVideoJobSchema>;
export type WatchVideoJob = typeof watchVideoJobsTable.$inferSelect;

export const insertWatchSightingSchema = createInsertSchema(watchSightingsTable).omit({ id: true, createdAt: true });
export const selectWatchSightingSchema = createSelectSchema(watchSightingsTable);
export type InsertWatchSighting = z.infer<typeof insertWatchSightingSchema>;
export type WatchSighting = typeof watchSightingsTable.$inferSelect;
