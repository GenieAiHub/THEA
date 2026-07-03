---
name: FB/IG social scraping
description: How Facebook & Instagram scraping is wired into the ingestion pipeline (dual-engine)
---

# Facebook & Instagram scraping

Collectors `instagram.ts` / `facebook.ts` scrape trending posts per category and derive trending hashtags. There is NO official FB/IG trending API (CrowdTangle shut Aug 2024), so scraping is the only option — the operator chose to build BOTH engines.

## Dual-engine design (per collector)
1. **Apify (managed scraper, preferred)** — used when `apify_token` is set. Actor id is operator-overridable (`apify_instagram_actor` / `apify_facebook_actor`). Shared helper `collectors/apify.ts::runApifyActor` POSTs to `run-sync-get-dataset-items` (Bearer header, 240s abort < Apify's ~300s cap) and returns dataset items.
2. **Session-cookie direct scrape (fallback)** — used only if Apify returned nothing/unset. IG: private web API `/api/v1/tags/web_info/` with `instagram_session_cookie` + `x-ig-app-id`. FB: `facebook_session_cookie` against mbasic.

If neither credential is set → WARN + return [] (no mock, no silent fallback), mirroring telegram.ts self-contained config reading.

## Known limitation — Facebook cookie fallback is effectively dead
Meta retired `mbasic.facebook.com` (~mid-2024); it now redirects to www, so the FB cookie path will almost always return 0 items (fails gracefully via the login-wall heuristic). **Apify is the only realistically working FB engine.** `apify/facebook-posts-scraper` expects page/profile startUrls, not hashtag pages — operators may need to point `apify_facebook_actor` at a suitable search actor. IG is the strong hashtag surface.

## Wiring checklist (any new ingestion source needs ALL of these)
- collector file(s)
- `worker.ts`: switch case + import
- `scheduler.ts`: per-category `upsertJobScheduler` (FB/IG use `SOCIAL_SCRAPE_INTERVAL_MS` 3h, `attempts:1` because Apify runs are billable — never auto-retry)
- `routes/v1/crawler.ts`: `validSources` trigger allowlist
- `admin_configs.ts` `DEFAULT_CONFIGS`: every `getPlatformConfig` key must be catalogued (else it won't show in Super Admin)

## Trending hashtags
`collectors/hashtags.ts`: `extractHashtags` (Unicode-aware) stores per-post tags in `rawMetadata.hashtags`; `rankTrendingHashtags` ranks by frequency × log(engagement); `logTrending` logs the run's top-10. Downstream analytics/spike detection consume the stored content — no separate trending table.

## Cost note
2 platforms × ~11 categories × 8 runs/day ≈ 176 Apify runs/day when fully configured. Tune `SOCIAL_SCRAPE_INTERVAL_MS` / `RESULTS_PER_TAG` before enabling a token.
