import { mkdirSync, existsSync } from "node:fs";
import { writeFile, readdir, stat, unlink, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { watchSightingsTable } from "@workspace/db/schema";
import { lt, sql } from "drizzle-orm";
import { logger } from "../logger";
import { getPlatformConfigNumber } from "../platform-config";

/**
 * Snapshot files live OUTSIDE any static-serving root and are only readable
 * through the authenticated, org-scoped route in routes/v1/watch.ts.
 */
export function snapshotRoot(): string {
  return process.env.WATCH_DATA_DIR ?? join(process.cwd(), "data", "security-watch");
}

/** Save a JPEG snapshot; returns the relative path stored in the DB. */
export async function saveSnapshot(orgId: string, jpegBuffer: Buffer): Promise<string> {
  const month = new Date().toISOString().slice(0, 7); // yyyy-mm
  const rel = join(orgId, month, `${randomUUID()}.jpg`);
  const abs = join(snapshotRoot(), rel);
  const dir = join(snapshotRoot(), orgId, month);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await writeFile(abs, jpegBuffer);
  return rel;
}

/**
 * Save a watch-target reference image. Lives under <org>/refs/ which the
 * age-based prune skips (it only touches yyyy-mm dirs), so refs are permanent
 * until the target row is deleted.
 */
export async function saveRefImage(orgId: string, jpegBuffer: Buffer): Promise<string> {
  const rel = join(orgId, "refs", `${randomUUID()}.jpg`);
  const dir = join(snapshotRoot(), orgId, "refs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await writeFile(join(snapshotRoot(), rel), jpegBuffer);
  return rel;
}

/** Resolve a stored relative path to an absolute path, rejecting traversal. */
export function resolveSnapshotPath(relPath: string): string | null {
  const root = resolve(snapshotRoot());
  const abs = resolve(root, relPath);
  if (!abs.startsWith(root + sep)) return null;
  return abs;
}

/**
 * Retention: delete sighting rows older than the configured age, then remove
 * snapshot files older than the same age (covers orphans from deleted rows).
 */
export async function pruneSnapshots(): Promise<void> {
  const retentionDays = await getPlatformConfigNumber("watch_retention_days", 30);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  try {
    const deleted = await db
      .delete(watchSightingsTable)
      .where(lt(watchSightingsTable.createdAt, cutoff))
      .returning({ id: watchSightingsTable.id });
    if (deleted.length > 0) {
      logger.info({ deleted: deleted.length, retentionDays }, "Pruned old watch sightings");
    }
  } catch (err) {
    logger.warn({ err }, "Sighting prune failed");
  }

  // Remove files older than cutoff (walk org/month dirs; month granularity keeps this cheap).
  const root = snapshotRoot();
  if (!existsSync(root)) return;
  try {
    const orgs = await readdir(root);
    for (const org of orgs) {
      const orgDir = join(root, org);
      const months = await readdir(orgDir).catch(() => [] as string[]);
      for (const month of months) {
        if (!/^\d{4}-\d{2}$/.test(month)) continue; // skip refs/ and anything non-monthly
        const monthDir = join(orgDir, month);
        // Entire month older than cutoff month → remove wholesale
        const cutoffMonth = cutoff.toISOString().slice(0, 7);
        if (month < cutoffMonth) {
          await rm(monthDir, { recursive: true, force: true });
          continue;
        }
        if (month > cutoffMonth) continue;
        const files = await readdir(monthDir).catch(() => [] as string[]);
        for (const f of files) {
          const p = join(monthDir, f);
          const s = await stat(p).catch(() => null);
          if (s && s.mtimeMs < cutoff.getTime()) await unlink(p).catch(() => undefined);
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "Snapshot file prune failed");
  }
}

/** Per-org cap: keep only the newest N sightings per org (snapshot files left to age-based prune). */
export async function enforceSightingCap(): Promise<void> {
  const cap = await getPlatformConfigNumber("watch_sightings_cap_per_org", 10000);
  try {
    await db.execute(sql`
      DELETE FROM watch_sightings ws USING (
        SELECT id FROM (
          SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY created_at DESC) AS rn
          FROM watch_sightings
        ) ranked WHERE rn > ${cap}
      ) excess WHERE ws.id = excess.id
    `);
  } catch (err) {
    logger.warn({ err }, "Sighting cap enforcement failed");
  }
}
