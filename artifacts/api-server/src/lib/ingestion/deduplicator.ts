import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getRedis } from "../redis";
import { logger } from "../logger";

const REDIS_DEDUP_TTL = 7 * 24 * 60 * 60;
const REDIS_KEY_PREFIX = "dedup:hash:";

export function computeHash(body: string): string {
  return createHash("sha256").update(body.trim()).digest("hex");
}

export async function isDuplicate(contentHash: string, orgId: string): Promise<false | string> {
  const redisKey = `${REDIS_KEY_PREFIX}${orgId}:${contentHash}`;

  try {
    const redis = getRedis();
    const cached = await redis.get(redisKey);
    if (cached) return cached;
  } catch (err) {
    logger.warn({ err }, "Redis dedup check failed — falling back to DB");
  }

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
      await cacheHash(contentHash, orgId, existing[0]!.id);
      return existing[0]!.id;
    }
  } catch (err) {
    logger.warn({ err }, "DB dedup check failed");
  }

  return false;
}

export async function cacheHash(contentHash: string, orgId: string, itemId: string): Promise<void> {
  try {
    const redis = getRedis();
    const redisKey = `${REDIS_KEY_PREFIX}${orgId}:${contentHash}`;
    await redis.setex(redisKey, REDIS_DEDUP_TTL, itemId);
  } catch {
  }
}

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
