import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { logger } from "./logger";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.PLATFORM_ENCRYPTION_KEY;
  if (!raw) throw new Error("PLATFORM_ENCRYPTION_KEY is not set — cannot encrypt/decrypt platform configs");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) throw new Error("PLATFORM_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  return buf;
}

/**
 * Encrypt a plaintext string.
 * Returns a single base64 string: iv(12) + tag(16) + ciphertext, all concatenated.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv  = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64 string previously produced by encrypt().
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  const iv        = buf.subarray(0, IV_BYTES);
  const tag       = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher  = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * Safely decrypt — returns null and logs a warning on failure
 * (e.g. wrong key, corrupted value).
 */
export function safeDecrypt(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  try {
    return decrypt(encoded);
  } catch (err) {
    logger.warn({ err }, "Failed to decrypt platform config value");
    return null;
  }
}
