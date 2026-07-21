---
name: Ask THEA RAG chat
description: SSE contract, honest-failure paths, and error-sanitization rules for the org-scoped AI analyst chat
---

# Ask THEA chat (portal, /api/v1/ask-thea)

- SSE contract: `meta` → `sources` → `token`* → `done` | `error`, 15s heartbeat, AbortController wired to req close. Ownership/spend-cap/validation failures are resolved BEFORE switching to SSE so they return normal JSON status codes.
- Honest paths: if retrieval finds nothing (no content/alerts/crisis/trends), the canned NO_DATA_REPLY is streamed and the LLM is never called. If retrieval has data but the provider key is missing, the config error streams as an `error` event.
- Error sanitization rule: SSE `error` events only forward messages matching /not configured|api key|budget|rate limit|quota/i (and never "Failed query"); everything else gets a generic message with details kept in server logs.
  **Why:** a transient Drizzle failure once streamed the full SQL + params to the client.
  **How to apply:** keep the allowlist in the /ask catch block in sync if llm.ts adds new user-actionable error texts.
- Citations: persist only markers the model actually used (regex matches [S1] and combined [S1, S3] forms); an empty list is the honest answer — never fall back to "all retrieved".
- Tier gating: requireTier responds **402 TIER_REQUIRED**, not 403 — OpenAPI docs for tier-gated paths must say 402.
- Trend scores are 0–100 scale (scorer clamps `raw*100`); Math.round for display is correct.
- Retrieval tenancy: content + trend_scores use the shared platform pool (tenantOr/includePlatform); alerts + crisis_scores are strictly per-org (tenantEq).
