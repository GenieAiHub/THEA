---
name: THEA MMP attribution platform
description: Design decisions for the THEA MMP mobile attribution product (tracking links, ingest, attribution, stats)
---

# THEA MMP platform (portal /mmp, API /api/v1/mmp)

- **Ingest auth is separate from thea_ API keys.** Per-app token prefix `mmpi_` sent via `X-Ingest-Token` header. **Why:** `Bearer thea_` triggers the 1000/day apiKeyRateLimiter in v1/index.ts and thea_ keys are gated behind the enterprise `developer_api` feature — ingest volume would break both. Tokens are stored plaintext (re-displayed in the portal integration guide) with a regenerate endpoint.
- **Attribution:** last click ≤7 days matched by `sha256(app.ipSalt + client IP)` only (UA stored but not matched — browser UA ≠ SDK UA); else organic. Salt is per-app and stable (daily rotation would break the 7-day window). No deviceId matching on clicks — browser clicks never have one.
- **Installs are idempotent** via `unique(appId, deviceId)` + onConflictDoNothing + raced re-fetch. Clicks denormalize orgId+appId to avoid joins for scoping/fingerprint lookup.
- **Public routes** (`/c/:code` redirect, `/ingest/*`) are defined BEFORE `router.use(requireAuth)` in mmp.ts. Redirect validates destinationUrl is http(s) at link creation (open-redirect guard). Prod nginx proxies only `/api/`, so the tracking URL must stay under `/api/v1/mmp/c/:code`.
- **Stats endpoints must apply the appId filter to EVERY aggregate query** — the breakdown organic bucket silently went org-wide when only the links list was filtered (caught in review).
- Revenue is bigint micro-USD; responses cast `::float8 / 1e6` — never serialize the raw bigint to JSON.
- No tier gating: available to all signed-in orgs (TIER_FEATURES has no MMP flag by design).
- Portal page uses plain fetch + react-query (precedent: use-checkout.ts), root-relative `/api/v1/mmp/...`.
- **Retention = event activity** (any event that day counts as active) and D1/D7/D30 use maturity gating — cohorts too young return `null`, UI shows "—", never a misleading 0%. Same rule in creator stats, weekly cohorts and health checks.
- `/health` requires a specific `appId` (400 otherwise); the portal Health tab gates on the header app filter and shows a pick-an-app prompt for "All apps".
- Costs upsert per (linkId, day) — re-posting a day overwrites, which the UI relies on. `costMicro` (bigint) must be destructured OUT of the row before `res.json` or Express throws BigInt-serialization 500.
- `csvEscape` prefixes `'` to values starting with `=+-@\t\r` (spreadsheet formula-injection guard) — keep this if the export code is touched.
- Portal e2e login for tests: /sign-in (NOT /login — that 404s); cookie session then /mmp works.
- **Maturity gating uses N+1-day intervals** (D1→2d, D7→8d, D30→31d): a cohort is only "mature" for day-N once the full [N, N+1) activity window has elapsed. An interval of exactly N days is an off-by-one that counts still-open windows (caught in review).
- **Benchmarks tab** compares app KPIs vs static industry tables keyed by `mmp_apps.category`; pLTV (`/stats/pltv`) fits log curve on observed cumulative ARPU (needs MIN_DENOM installs, note distinguishes "no installs" vs "too few"); media-mix (`/stats/media-mix`) is MMM-lite over per-link cost+revenue with suggested allocation. All clearly labeled as estimates/benchmarks per user directive.
- **SKAN postback receiver is unauthenticated by design** (Apple can't auth): `POST /.well-known/skadnetwork/report` mounted in app.ts before auth, matched to app via `apple_app_id` which has a DB unique constraint (else any org could claim another's App ID and intercept postbacks). PATCH returns 409 on duplicate. Per-app row cap (opportunistic ~2% prune to newest 5000) prevents DB-fill abuse; dedupe on (appId, transactionId, sequenceIndex).
- **Drizzle wraps pg errors**: a unique-violation catch must check `err.cause?.code === "23505"`, not just `err.code` — the top-level error is a DrizzleQueryError and checking only `.code` turns 409s into 500s.
- `drizzle-kit push` prompts interactively (TTY error in shell) when adding a unique constraint to a table with rows — apply the constraint via plain SQL first, then push becomes a no-op.
