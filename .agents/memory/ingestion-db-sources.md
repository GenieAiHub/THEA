---
name: Ingestion DB-backed sources
description: RSS worker must read active sources from crawler_sources table, not hardcoded list
---

The `rss-all` and `rss-batch` BullMQ job cases in `worker.ts` must query `crawler_sources WHERE isActive=true AND type='rss'` at job execution time.

**Why:** Admins add/pause/remove RSS sources via the crawler_sources CRUD API. If the worker uses `PRECONFIGURED_SOURCES` (the hardcoded 504-source list), those admin changes never take effect without a redeployment — violating the "no redeployment needed" operational requirement.

**How to apply:** Use `getActiveRssSources(category?)` helper (in `worker.ts`) which queries the DB and falls back to `PRECONFIGURED_SOURCES` / `getSourcesByCategory()` only on DB error. The web-crawler job similarly dispatches only URLs explicitly passed in job data, not a static list.
