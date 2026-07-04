/**
 * Screen Wake Lock — keeps the display awake during an active face scan.
 *
 * Supported on Chrome/Android and iOS Safari >= 16.4. The OS auto-releases the
 * sentinel whenever the page is hidden, so callers must re-acquire on
 * visibilitychange (see the useWakeLock hook). Failure (e.g. low battery, no
 * support) is never fatal — it just means the screen may dim.
 */

export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (!isWakeLockSupported()) return null;
  try {
    return await navigator.wakeLock.request("screen");
  } catch {
    return null;
  }
}

export async function releaseWakeLock(
  sentinel: WakeLockSentinel | null,
): Promise<void> {
  try {
    await sentinel?.release();
  } catch {
    /* Already released or page unloaded — ignore. */
  }
}
