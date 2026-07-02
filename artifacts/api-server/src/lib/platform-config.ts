import { db } from "@workspace/db";
import { platformConfigsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { safeDecrypt } from "./crypto";

/**
 * Central platform-config resolver.
 *
 * Every operator-configurable setting (API keys, service URLs, tunables) lives
 * in the `platform_configs` table and is editable from the Super Admin UI. This
 * is the single read path used by all clients:
 *
 *   1. An ACTIVE row with a decryptable value wins (admin-managed override).
 *   2. Otherwise we fall back to the matching environment variable
 *      (`key.toUpperCase()`), so a fresh deploy that only has env vars still
 *      works and admins can migrate settings into the DB incrementally.
 *   3. Otherwise `null`.
 *
 * Values are cached in-process for 5 minutes; `clearConfigCache(key)` is called
 * by the admin write path so edits take effect within one request. We never
 * auto-write env values back into the DB — the DB is the override, env is the
 * base. PLATFORM_ENCRYPTION_KEY / ADMIN_INTERNAL_TOKEN and core infra vars
 * (DATABASE_URL, REDIS_URL, PORT, …) intentionally stay env-only.
 */

const CONFIG_TTL_MS = 5 * 60 * 1000;
const configCache = new Map<string, { value: string | null; expiresAt: number }>();

/** Environment fallback for a config key (`brave_api_key` → `BRAVE_API_KEY`). */
function envFallback(key: string): string | null {
  const v = process.env[key.toUpperCase()];
  return v != null && v !== "" ? v : null;
}

/**
 * Resolve a platform config value: active DB row (decrypted) if present,
 * otherwise the environment variable, otherwise null. Cached for 5 minutes.
 */
export async function getPlatformConfig(key: string): Promise<string | null> {
  const cached = configCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const rows = await db
    .select()
    .from(platformConfigsTable)
    .where(and(eq(platformConfigsTable.key, key), eq(platformConfigsTable.isActive, true)))
    .limit(1);

  const row = rows[0];
  const dbValue = row ? safeDecrypt(row.encryptedValue) : null;
  const value = dbValue != null && dbValue !== "" ? dbValue : envFallback(key);

  configCache.set(key, { value, expiresAt: Date.now() + CONFIG_TTL_MS });
  return value;
}

/** Numeric config with a default when unset or non-numeric. */
export async function getPlatformConfigNumber(key: string, fallback: number): Promise<number> {
  const raw = await getPlatformConfig(key);
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Boolean config — true only for "true"/"1" (case-insensitive). */
export async function getPlatformConfigBool(key: string, fallback = false): Promise<boolean> {
  const raw = await getPlatformConfig(key);
  if (raw == null || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Invalidate cache for a key (or the whole cache). Called by the admin writes. */
export function clearConfigCache(key?: string): void {
  if (key) configCache.delete(key);
  else configCache.clear();
}
