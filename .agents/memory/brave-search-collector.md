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
