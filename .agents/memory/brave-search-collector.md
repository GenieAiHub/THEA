---
name: Brave Search collector
description: Own-key Brave Search integration replacing DuckDuckGo; no Replit proxy required
---

# Brave Search collector

## The rule
Use `collectBrave(keyword, category, apiKey)` in `src/lib/ingestion/collectors/brave.ts`.
Requires `BRAVE_API_KEY` env var. Does NOT use any Replit integration proxy — intended for self-hosted deployment.

**Why:** The user confirmed their project will be deployed on their own server (not Replit hosting), so they need their own Brave API key and direct integration rather than the Replit-managed proxy.

## How to apply
- `"brave"` and `"duckduckgo"` are now SEPARATE worker cases. `"brave"` → collectBrave (needs BRAVE_API_KEY). `"duckduckgo"` → collectDuckDuckGo (keyless, duck-duck-scrape) — works out of the box.
- The per-keyword search scheduler (`scheduleSearchKeywords`) emits sourceType `"duckduckgo"` so keyword search runs without any API key. watchlist-scan still uses Brave/Bing/SerpAPI when their keys are set.
- crawler.ts validSources includes both "brave" and "duckduckgo"
- If BRAVE_API_KEY is not set, the "brave" case logs a WARN and skips (no silent fallback)
- **Why the split:** DuckDuckGo used to be a dead alias routed to collectBrave (so keyword search silently needed a Brave key). Splitting them makes the keyless path actually run.

## Keyless social-media search (collectSocialSearch)
`collectors/social-search.ts` is a THIRD social-scraping engine (alongside Apify + session cookies): for each platform it runs a `site:<domain> <keyword>` DuckDuckGo query, verifies the result hostname, tags `item.platform` with the real platform, and extracts hashtags from the snippet. Covers ALL platforms (instagram/facebook/twitter+x/tiktok/reddit/linkedin/youtube). No API key/token/cookie. It's the reliable keyless Facebook path (the FB cookie surface is dead — see social-scraping-fb-ig.md).
- Wired as worker case `"social-search"`, scheduled per watchlist keyword right next to the `duckduckgo` web-search scheduler (same SEARCH_INTERVAL_MS), and in crawler.ts validSources.
- Trade-off: snippet-only bodies, empty engagementMetrics + null publishedAt, so engagement-weighted trending underweights these rows. Analytics disambiguate via `rawMetadata.engine="social-search"`.

## DDG shared throttle (REQUIRED)
Every DuckDuckGo query — web search AND social search — MUST go through `throttledDdgSearch` in `collectors/ddg-throttle.ts`, never `search()` from duck-duck-scrape directly.
**Why:** duck-duck-scrape has no rate-limit handling and the BullMQ content-ingestion worker runs QUEUE_CONCURRENCY=10 jobs in parallel; one tick fires ~8 DDG queries per keyword (1 web + 7 social), so uncoordinated bursts trip DDG anomaly detection and soft-block the whole process. The throttle is a module-level serialized promise chain enforcing a ~1.5s min gap; failures don't break the chain.
**How to apply:** any new collector that hits DuckDuckGo imports throttledDdgSearch.
