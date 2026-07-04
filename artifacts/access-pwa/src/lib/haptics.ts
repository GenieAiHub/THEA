/**
 * Haptic feedback via the Vibration API.
 *
 * Android Chrome supports navigator.vibrate; iOS Safari has NO web haptics API,
 * so every call degrades to a silent no-op there. The absence of vibration is
 * never an error — callers should fire haptics freely for tactile polish.
 */

export type HapticPattern = "tap" | "select" | "success" | "warning" | "error";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  select: 12,
  success: [18, 40, 26],
  warning: [26, 60, 26],
  error: [40, 55, 40, 55, 40],
};

export function isHapticsSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  );
}

/** Fire a named haptic pattern. Safe to call anywhere; no-ops when unsupported. */
export function haptic(pattern: HapticPattern = "tap"): void {
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* Some engines throw if called outside a user gesture — ignore. */
  }
}
