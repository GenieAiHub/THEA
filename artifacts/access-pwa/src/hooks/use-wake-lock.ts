import { useEffect, useRef } from "react";
import { releaseWakeLock, requestWakeLock } from "@/lib/wake-lock";

/**
 * Holds a screen wake lock while `active` is true, re-acquiring after the tab
 * regains visibility (the OS drops the sentinel while the page is hidden).
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      sentinelRef.current = await requestWakeLock();
    };

    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void releaseWakeLock(sentinelRef.current);
      sentinelRef.current = null;
    };
  }, [active]);
}
