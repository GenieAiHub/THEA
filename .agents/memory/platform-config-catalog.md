---
name: Platform config resolver & admin catalog
description: How THEA runtime settings are made DB-driven (admin-editable) and how to add/verify new ones
---

All platform runtime settings are DB-driven via the resolver in
`artifacts/api-server/src/lib/platform-config.ts`: `getPlatformConfig(key)`,
`getPlatformConfigNumber(key, fallback)`, `getPlatformConfigBool(key, fallback)`.

Resolution order: `platform_configs` DB row (AES-256-GCM at rest) FIRST, then env
fallback. **Convention: DB key is lowercase; env fallback is `key.toUpperCase()`.**
So `getPlatformConfig("news_api_key")` falls back to `process.env.NEWS_API_KEY`.
~5-min in-process cache; `clearConfigCache(key)` runs on every admin write.

**Why:** operators must manage every API key / URL / setting from the Super Admin
UI without redeploys, while existing env-based deploys keep working unchanged.

Rules (how to apply):
- **Never write env → DB.** The admin PUT only encrypts client-supplied values;
  clearing writes `encryptedValue = NULL` so the resolver falls back to env again.
- The admin catalog `DEFAULT_CONFIGS` in `routes/v1/admin_configs.ts` MUST stay in
  sync with every `getPlatformConfig*` call site. Verify after adding a key:
  `rg -oN 'getPlatformConfig(?:Number|Bool)?\("([a-z0-9_]+)"' -r '$1'` and confirm
  each appears in DEFAULT_CONFIGS (label/description/category/isSecret).
- Superseded keys go in `OBSOLETE_KEYS`; seed deletes them ONLY when
  `encryptedValue IS NULL` (never destroy an operator-entered value).
- `isSecret: true` rows are masked in the API (`value: null`) and shown as SECRET
  in the UI — overwrite-only, never read back.

Env-only (NEVER put in DB): PLATFORM_ENCRYPTION_KEY, ADMIN_INTERNAL_TOKEN,
DATABASE_URL, REDIS_URL, PORT, NODE_ENV, PROVISION_TOKEN, TRUST_PROXY,
CORS_ORIGIN, API_ORIGIN, PLATFORM_ORG_ID, CRAWLEE_STORAGE_DIR.

Gotchas:
- `telegram_bot_token` is bound once when the bot launches at boot, so an admin
  edit needs a **server restart** to re-bind (flagged RESTART REQUIRED in the UI).
  Every other key takes effect within the ~5-min cache TTL, no restart.
- `use_playwright` is DB-driven at runtime but only enables the Playwright crawler
  if Chromium exists in the image; otherwise web-crawler falls back to Cheerio via
  try/catch. Image-level Chromium install is a separate build concern.
- `markets.ts` has its own self-contained readConfig/writeConfig — intentionally
  NOT routed through this resolver.
