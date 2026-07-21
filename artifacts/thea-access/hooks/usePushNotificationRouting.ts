import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function extractPath(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  const url = data?.url;
  return typeof url === "string" && url.startsWith("/") ? url : null;
}

/**
 * Deep-links notification taps to their target screen (e.g. a sighting view).
 * Handles both warm taps (listener) and cold starts (last response). Routing
 * is deferred until the session is authed so the login redirect doesn't
 * clobber the navigation.
 */
export function usePushNotificationRouting(ready: boolean): void {
  const router = useRouter();
  const pendingRef = useRef<string | null>(null);
  const handledColdStart = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const path = extractPath(response);
      if (path) pendingRef.current = path;
    });

    if (!handledColdStart.current) {
      handledColdStart.current = true;
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (!response) return;
          const path = extractPath(response);
          if (path) pendingRef.current = path;
        })
        .catch(() => {});
    }

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !ready) return;
    const interval = setInterval(() => {
      const path = pendingRef.current;
      if (path) {
        pendingRef.current = null;
        router.push(path as never);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [ready, router]);
}
