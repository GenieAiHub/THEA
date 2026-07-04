import { useCallback, useState } from "react";
import {
  isNotificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  type NotifyPermission,
} from "@/lib/notifications";

/** Reactive notification-permission state + a gesture-safe request helper. */
export function useNotifications() {
  const [permission, setPermission] = useState<NotifyPermission>(() =>
    notificationPermission(),
  );

  const request = useCallback(async () => {
    const next = await requestNotificationPermission();
    setPermission(next);
    return next;
  }, []);

  return {
    supported: isNotificationsSupported(),
    permission,
    request,
  };
}
