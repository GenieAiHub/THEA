import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ApiError } from "@workspace/api-client-react";

/**
 * Bump when the shape of persisted query data changes so a stale cache from a
 * previous release is discarded on the next load.
 */
export const APP_CACHE_VERSION = "thea-access-v1";

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        if (error instanceof ApiError && error.status === 401) return false;
        return count < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      // Keep results long enough that the persisted cache survives an offline
      // relaunch — react-query drops entries older than gcTime before persisting.
      gcTime: WEEK_MS,
    },
  },
});

/**
 * Persists the query cache to localStorage so the app has data to render while
 * offline. Only successful queries are dehydrated (see App.tsx), and API
 * responses never reach the service-worker Cache Storage (the SW is NetworkOnly
 * for /api), so this is the single device-local copy of cached content.
 */
export const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "thea.access.query-cache",
});

/** Wipes the in-memory and persisted query caches (used on login/logout). */
export async function purgePersistedQueryCache(): Promise<void> {
  try {
    await persister.removeClient();
  } catch {
    /* ignore storage failures */
  }
  queryClient.clear();
}
