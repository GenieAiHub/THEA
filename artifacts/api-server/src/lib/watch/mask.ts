/**
 * Credential-masking helpers for camera stream URLs. Stream URLs often embed
 * userinfo (rtsp://user:pass@host/...), which must never reach API responses
 * visible to non-admins, persisted error text, or server logs.
 */

export const MASKED_CREDENTIALS = "•••";

/** Masks embedded credentials in a single URL: rtsp://user:pass@h → rtsp://•••@h */
export function maskStreamUrl(url: string): string {
  return url.replace(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^@/\s]+@/, `$1${MASKED_CREDENTIALS}@`);
}

/**
 * Redacts credentials in EVERY URL occurring anywhere inside free-form text
 * (ffmpeg stderr, error messages). Safe on arbitrary text — only rewrites
 * scheme://userinfo@ sequences.
 */
export function redactStreamCredentials(text: string): string {
  return text.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)[^@/\s]+@/g, `$1${MASKED_CREDENTIALS}@`);
}
