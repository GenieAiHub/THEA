/**
 * Local notifications via the Notification API + the service worker.
 *
 * This surfaces *local* notifications (e.g. an access-denied alert while the app
 * is open or backgrounded). True server push (VAPID subscription + push events)
 * is intentionally NOT wired: the service worker is generated with Workbox
 * generateSW and has no push/notificationclick handlers. Adding real push means
 * migrating to injectManifest + a backend send path — tracked as a follow-up.
 *
 * We prefer ServiceWorkerRegistration.showNotification (works when installed and
 * backgrounded) and fall back to the Notification constructor.
 */

export type NotifyPermission = "default" | "granted" | "denied" | "unsupported";

const ICON = `${import.meta.env.BASE_URL}pwa-192x192.png`;

export function isNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotifyPermission {
  if (!isNotificationsSupported()) return "unsupported";
  return Notification.permission as NotifyPermission;
}

/** Must be called from a user gesture on most browsers. */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!isNotificationsSupported()) return "unsupported";
  try {
    return (await Notification.requestPermission()) as NotifyPermission;
  } catch {
    return notificationPermission();
  }
}

export interface NotifyInput {
  title: string;
  body?: string;
  tag?: string;
  data?: unknown;
}

/** Shows a local notification. Returns false when permission isn't granted. */
export async function notify(input: NotifyInput): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const options: NotificationOptions = {
    body: input.body,
    tag: input.tag,
    icon: ICON,
    badge: ICON,
    data: input.data,
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(input.title, options);
        return true;
      }
    }
    new Notification(input.title, options);
    return true;
  } catch {
    return false;
  }
}
