import { pgTable, text, timestamp, uuid, real, index, customType } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { membersTable } from "./members";

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
 * One row PER enrolled face photo (a member may have several for robustness).
 * `embedding` is a 128-d face descriptor from @vladmandic/face-api, matched via
 * pgvector L2 distance. onDelete cascade on memberId implements right-to-be-forgotten.
 */
export const faceEmbeddingsTable = pgTable("face_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 128 }).notNull(),
  quality: real("quality"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("face_embeddings_org_id_idx").on(table.orgId),
  index("face_embeddings_member_id_idx").on(table.memberId),
]);

export const insertFaceEmbeddingSchema = createInsertSchema(faceEmbeddingsTable).omit({ id: true, createdAt: true });
export const selectFaceEmbeddingSchema = createSelectSchema(faceEmbeddingsTable);
export type InsertFaceEmbedding = z.infer<typeof insertFaceEmbeddingSchema>;
export type FaceEmbedding = typeof faceEmbeddingsTable.$inferSelect;
