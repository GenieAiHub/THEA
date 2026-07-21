---
name: Expo Android prebuild packaging for external APK builder
description: How to produce a standalone source+android/ zip from a pnpm-workspace Expo app for the user's self-hosted APK builder
---

Recipe for packaging `artifacts/thea-access` (or any workspace Expo app) into a self-contained archive for the user's VPS APK builder (JDK17, Node 22, pnpm 10, `assembleRelease`):

1. Stage a copy outside the workspace (e.g. `/tmp/<app>-build`) via `tar --exclude=node_modules --exclude=.expo --exclude=dist` (rsync is NOT installed).
2. Rewrite `package.json`: materialize every `catalog:` version from root `pnpm-workspace.yaml` (react/react-dom are pinned exact for Expo), drop `@workspace/*` deps, and rename the package (no `@workspace/` scope) so it installs standalone.
3. Write a staging `.npmrc` with `node-linker=hoisted` — React Native/Expo autolinking breaks with pnpm's default isolated layout.
4. `pnpm install --prefer-offline` in staging (creates a standalone `pnpm-lock.yaml`, ~45s reusing the store), then `CI=1 npx expo prebuild --platform android --no-install`.
5. Zip staging contents excluding `node_modules`, `.git`, `android/**/build`, `android/.gradle`; verify `android/gradlew`, `package.json`, `pnpm-lock.yaml` are present. Result ≈9MB.

**Why:** the workspace package.json is uninstallable outside the monorepo (`catalog:`/`workspace:` protocols), and the builder needs its own lockfile + hoisted node_modules to run Gradle.

**How to apply:** any time the user asks for a fresh APK-builder archive after app changes — re-run the whole staging flow; never zip the workspace dir directly. Also remember to sync any last-minute workspace edits into staging before re-zipping. Standalone builds rely on `EXPO_PUBLIC_DOMAIN` fallback (`m.thea.quest`) in `lib/api.ts` since no env is injected.
