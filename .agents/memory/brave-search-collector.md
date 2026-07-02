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
- Both `"brave"` and `"duckduckgo"` cases in the ingestion worker route to collectBrave (duckduckgo is kept as a fallback alias for stale Redis jobs)
- Scheduler emits sourceType: "brave"
- crawler.ts validSources includes both "brave" and "duckduckgo"
- If BRAVE_API_KEY is not set, the worker logs a WARN and skips (no silent fallback)
