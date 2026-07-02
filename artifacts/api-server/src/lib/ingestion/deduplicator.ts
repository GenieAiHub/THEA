import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRedis } from "../redis";
import { logger } from "../logger";

// ─── Content hash ─────────────────────────────────────────────────────────────

export function computeHash(body: string): string {
  return createHash("sha256").update(body.trim()).digest("hex");
}

// ─── Redis Bloom filter (fast path) ──────────────────────────────────────────
// Implemented with GETBIT/SETBIT on a shared Redis bit array.
// No RedisBloom module required — works with vanilla Redis.
// Capacity: 8M bits → ~500K items at <1% false-positive rate (k=7 hashes).

const BLOOM_BITS = 8_000_000;
const BLOOM_HASH_COUNT = 7;
const BLOOM_KEY = "bloom:content-dedup:v1";
const BLOOM_TTL_SEC = 30 * 24 * 3600;

function bloomPositions(hash: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < BLOOM_HASH_COUNT; i++) {
    const buf = createHash("sha256").update(`${hash}:${i}`).digest();
    const pos = buf.readUInt32BE(0) % BLOOM_BITS;
    positions.push(pos);
  }
  return positions;
}

async function bloomContains(hash: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const positions = bloomPositions(hash);
    const pipeline = redis.pipeline();
    for (const pos of positions) {
      pipeline.getbit(BLOOM_KEY, pos);
    }
    const results = await pipeline.exec();
    if (!results) return false;
    return results.every(([err, val]) => !err && val === 1);
  } catch {
    return false;
  }
}

async function bloomAdd(hash: string): Promise<void> {
  try {
    const redis = getRedis();
    const positions = bloomPositions(hash);
    const pipeline = redis.pipeline();
    for (const pos of positions) {
      pipeline.setbit(BLOOM_KEY, pos, 1);
    }
    pipeline.expire(BLOOM_KEY, BLOOM_TTL_SEC);
    await pipeline.exec();
  } catch {
  }
}

// ─── Redis exact-match cache (medium path) ────────────────────────────────────

const REDIS_DEDUP_TTL = 7 * 24 * 60 * 60;
const REDIS_KEY_PREFIX = "dedup:hash:";

async function cacheGet(contentHash: string, orgId: string): Promise<string | null> {
  try {
    const redis = getRedis();
    return await redis.get(`${REDIS_KEY_PREFIX}${orgId}:${contentHash}`);
  } catch {
    return null;
  }
}

export async function cacheHash(contentHash: string, orgId: string, itemId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setex(`${REDIS_KEY_PREFIX}${orgId}:${contentHash}`, REDIS_DEDUP_TTL, itemId);
  } catch {
  }
}

// ─── Main dedup check ────────────────────────────────────────────────────────
// Fast path:  Bloom filter (probabilistic, no DB) — miss = definitely new
// Medium path: Redis exact-match key — hit = confirmed duplicate (with id)
// Slow path:  DB authoritative query — only reached on Bloom filter false-positive
// After insert, call markSeen() to populate both Bloom filter and Redis cache.

export async function isDuplicate(contentHash: string, orgId: string): Promise<false | string> {
  const bloomHit = await bloomContains(contentHash);
  if (!bloomHit) return false;

  const cached = await cacheGet(contentHash, orgId);
  if (cached) return cached;

  try {
    const existing = await db
      .select({ id: contentItemsTable.id })
      .from(contentItemsTable)
      .where(
        and(
          eq(contentItemsTable.orgId, orgId),
          eq(contentItemsTable.contentHash, contentHash),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const existingId = existing[0]!.id;
      await cacheHash(contentHash, orgId, existingId);
      return existingId;
    }
  } catch (err) {
    logger.warn({ err }, "DB dedup check failed");
  }

  return false;
}

export async function markSeen(contentHash: string, orgId: string, itemId: string): Promise<void> {
  await bloomAdd(contentHash);
  await cacheHash(contentHash, orgId, itemId);
}

// ─── Source URL append on duplicate ──────────────────────────────────────────

export async function addSourceUrlToExisting(itemId: string, newSourceUrl: string): Promise<void> {
  try {
    const existing = await db
      .select({ sourceUrls: contentItemsTable.sourceUrls })
      .from(contentItemsTable)
      .where(eq(contentItemsTable.id, itemId))
      .limit(1);

    if (!existing[0]) return;
    const urls: string[] = Array.isArray(existing[0].sourceUrls)
      ? (existing[0].sourceUrls as string[])
      : [];

    if (!urls.includes(newSourceUrl)) {
      await db
        .update(contentItemsTable)
        .set({ sourceUrls: [...urls, newSourceUrl] })
        .where(eq(contentItemsTable.id, itemId));
    }
  } catch (err) {
    logger.warn({ err, itemId }, "Failed to append sourceUrl to duplicate item");
  }
}
