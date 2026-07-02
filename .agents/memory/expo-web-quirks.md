---
name: Expo web platform quirks
description: APIs that silently no-op or throw on react-native-web and must be wrapped by Platform.OS
---

# Expo APIs that break on web

When an Expo app also targets web (react-native-web), several native modules are
stubs on web and must be guarded with `Platform.OS === "web"` branches, or the web
build (the Replit preview / demo surface) breaks in ways that native does not.

## expo-secure-store — THROWS on web
- Its web build is effectively `export default {}`, so `SecureStore.setItemAsync` /
  `getItemAsync` / `deleteItemAsync` throw at runtime on web.
- Symptom: any auth flow that persists a token during login/register throws mid-flow,
  so the user can never sign in on web (generic "Something went wrong").
- **Fix:** a storage wrapper that uses `window.localStorage` on web and SecureStore on
  native. Route ALL token reads/writes/deletes through it.

## Alert.alert — no-op on web
- `Alert.alert` with buttons is not implemented on react-native-web; it does nothing.
- Symptom: destructive confirmations (delete member/face/point) and mutation `onError`
  alerts silently do nothing on web — data-loss actions appear frozen or errors vanish.
- **Fix:** a dialog helper — `window.confirm` (returns Promise<boolean>) and
  `window.alert` on web, `Alert.alert` on native. Make destructive confirms `await` it.

**Why:** these are the two web-only bugs the architect blocked on for THEA Access.
Native iOS/Android were correct; only the web preview was affected.
**How to apply:** whenever an Expo artifact must render in the Replit web preview,
wrap secure-store and Alert usage up front rather than after a failed web demo.
