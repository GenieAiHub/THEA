---
name: Ingestion pipeline architecture
description: Phase 2 collector/dedup/worker design decisions and constraints
---

## Platform System Org
`content_items.org_id` is NOT NULL with a FK to `organizations`. Global/platform content
uses `PLATFORM_ORG_ID = '10000000-0000-0000-0000-000000000001'` (slug: `thea-platform`).
This org is seeded via `ensurePlatformOrg()` called in `index.ts` bootstrap.

**Why:** Phase 2 collects global news — not org-specific. A system org avoids making
the column nullable (which would require a migration and schema change).

**How to apply:** Per-org watchlist ingestion (Phase 5) passes the user's org ID instead
of PLATFORM_ORG_ID to `ingestItems()`.

## Deduplication
SHA-256 of `body.trim()` → `contentHash`. Redis SETNX with 7-day TTL for fast path;
DB query fallback if Redis misses. `isDuplicate()` returns `false | existingId`.

## Collector key-gating pattern
All social/news API collectors take their API key as a param and return `[]` immediately
if the key is falsy. Worker reads from `process.env`, logs a WARN, and skips.
RSS + GDELT always run (no key required).

## Worker source types
`rss-all`, `rss-batch`, `gdelt`, `newsapi`, `mediastack`, `bing-news`,
`twitter`, `reddit`, `youtube`, `serp`, `web-crawler`.

## Scheduler intervals
- RSS all sources: every 15 min
- GDELT all categories: every 15 min
- Social APIs (twitter/reddit/youtube): every 1 hour per category
- News APIs (newsapi/mediastack/bing-news): every 1 hour per category

## Language detection
No `franc` dependency. Custom Unicode-range pattern matching in `language.ts`.
Covers: th, ar, he, ru, hi, ta, ml, bn, el, ko, ja, zh, ms, id, en (default).

## Web crawler
Lightweight `fetch`-based HTTP crawler (no Playwright/Crawlee — too heavy for env).
Politeness: 1-second per-domain delay. HTML-stripped with regex. Jina AI Reader used
as a fallback for full article text in the SerpAPI collector.

## Admin API auth
`POST/PATCH/DELETE /v1/crawler/sources`, `POST /v1/crawler/trigger`, and
`POST /v1/crawler/seed-sources` all require `Authorization: Bearer ADMIN_INTERNAL_TOKEN`.
Read operations (`GET`) are public.
