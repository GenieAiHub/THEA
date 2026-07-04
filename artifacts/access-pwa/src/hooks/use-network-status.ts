import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/** Reactive online/offline flag driven by the browser's connectivity events. */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
