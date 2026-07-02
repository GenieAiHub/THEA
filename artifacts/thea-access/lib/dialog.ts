import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirmation dialog.
 *
 * react-native-web does not implement Alert.alert with buttons, so on web we
 * use window.confirm; on native we use a two-button Alert.
 */
export function confirmDialog(opts: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  const {
    title,
    message,
    confirmText = "OK",
    cancelText = "Cancel",
    destructive = false,
  } = opts;

  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    const ok = typeof window !== "undefined" ? window.confirm(text) : false;
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Cross-platform message alert (window.alert on web, Alert.alert on native). */
export function notify(title: string, message?: string): void {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined") window.alert(text);
    return;
  }
  Alert.alert(title, message);
}
