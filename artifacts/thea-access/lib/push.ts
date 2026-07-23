import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "./api";
import { storage } from "./storage";

const PUSH_TOKEN_KEY = "theaPushToken";

/**
 * Registers this device for sighting push notifications: asks permission,
 * fetches the Expo push token, and uploads it to the API. Safe to call on
 * every sign-in — the backend upserts. Returns the token, or null when push
 * isn't available (web, simulator, permission denied, missing project id).
 */
export async function registerForSightingPush(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("sighting-alerts", {
        name: "Sighting alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
      });
      await Notifications.setNotificationChannelAsync("intel-alerts", {
        name: "Intelligence alerts",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await api.registerPushToken(token, Platform.OS);
    await storage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch {
    // Push is best-effort: never block sign-in or settings on it.
    return null;
  }
}

/** Removes this device's token from the backend (call on sign-out). */
export async function unregisterSightingPush(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const token = await storage.getItem(PUSH_TOKEN_KEY);
    if (token) {
      await api.unregisterPushToken(token).catch(() => {});
      await storage.deleteItem(PUSH_TOKEN_KEY).catch(() => {});
    }
  } catch {
    // best-effort
  }
}

/** Whether notification permission is currently granted (native only). */
export async function hasPushPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}
