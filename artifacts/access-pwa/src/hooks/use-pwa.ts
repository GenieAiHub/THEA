import { useSyncExternalStore } from "react";
import { getPWAState, subscribePWA, type PWAState } from "@/lib/pwa";

/** React binding for the PWA runtime store (install prompt + SW updates). */
export function usePWA(): PWAState {
  return useSyncExternalStore(subscribePWA, getPWAState, getPWAState);
}
