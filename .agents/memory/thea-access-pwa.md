---
name: THEA Access PWA (m.thea.quest)
description: Design constraints & non-obvious decisions for the installable access-pwa artifact
---

# THEA Access PWA (artifacts/access-pwa → m.thea.quest)

Single installable mobile-first PWA (iOS + Android, no App Store). Precaches all
code for offline/native-like use. Camera face-scan verified on backend,
geolocation, biometric login (WebAuthn platform passkeys + password fallback).
Accounts = organizations.

## Constraints / decisions (not derivable from code)

- **Served at the subdomain ROOT** (BASE_PATH=/ in prod, previewPath /access-pwa/
  in dev) so the service-worker scope covers the whole origin. Manifest uses
  start_url/scope/id "." + relative icon paths so it works in both dev and prod.
- **API auth is cookie-based**, root-relative `/api/v1/...` via the shared
  `@workspace/api-client-react` customFetch, which omits explicit `credentials` so
  the browser default (`same-origin`) sends the HttpOnly cookie for same-origin
  /api calls in both dev and prod topologies. Server sets an HttpOnly session
  cookie on login/register. Do NOT prepend BASE_URL (that hits the SPA server →
  HTML). See cross-artifact-api-routing.md.
- **The biometric "locked" state is a client-side convenience gate, NOT a
  security boundary.** verifyBiometric() uses a self-generated challenge with no
  server verification; the lock flag lives in localStorage. A device-in-hand
  attacker who clears storage bypasses the lock while the HttpOnly session cookie
  stays valid. Acceptable because no protected data renders while locked and all
  data requires live API calls. **Why:** documented so nobody later assumes lock
  protects data server-side. Hardening = server step-up / shorter session TTL.
- **Geolocation on the Scan page is display-only.** Coords are NOT sent with
  identify() and /v1/access/identify accepts only imageBase64 + accessPointId, so
  location is not persisted to access events. If location-stamped events are
  wanted, add a backend field + wire the client.
- **PWA registration is manual:** VitePWA registerType "prompt" + injectRegister
  null; registerSW lives in src/lib/pwa.ts and is called from main.tsx after
  mount. API routes are NetworkOnly; navigateFallback has a denylist for /api.
- **Deploy:** same nginx `web` Docker target as the other SPAs. Compose service
  `access-pwa` (port 8094) + proxy alias `thea-access-pwa` + Caddy m.thea.quest.
  nginx serves sw.js + manifest.webmanifest with Cache-Control:no-cache so
  clients pick up new deploys (the update prompt re-fetches sw.js).
- **API client is the shared generated `@workspace/api-client-react`** (Orval
  codegen fixed). Envelope rules: list endpoints return `{data,total}` (unwrap with
  `.then(r=>r.data)`); `getMember→MemberDetail` and `identifyFace→IdentifyResult`
  return bare (no envelope); `authMe→{data}`. `ApiError`/`ResponseParseError` are
  re-exported from the pkg index — after adding exports, rebuild the composite dist
  (`cd lib/api-client-react && tsc --build`) or consumers won't see them.
- **Offline = 3 layers:** SW precache (app shell) + React Query localStorage
  persistence (`@tanstack/query-sync-storage-persister` + `react-query-persist-client`,
  pinned to the exact react-query version to avoid a dual query-core; gcTime=maxAge=1wk;
  success-only dehydrate) + an AuthContext session snapshot in localStorage
  (`thea.access.session` = {user,org,tier,featureFlags}) that boots the app
  locked/authed offline and registers a one-shot `online` revalidate.
  **Cache buster = APP_CACHE_VERSION only, NEVER per-user.** **Why:** the persisted
  cache is written under the buster active at mount; folding user.id in would make
  an offline relaunch recompute a different buster and discard the cache, breaking
  offline. **How to apply:** enforce per-user isolation by purging cache+snapshot on
  login/register/logout/confirmed-401 (purgePersistedQueryCache), not via the buster.
