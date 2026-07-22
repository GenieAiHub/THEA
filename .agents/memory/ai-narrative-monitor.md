---
name: AI Narrative Monitor
description: LLM brand-perception monitoring (OpenAI + grounded Gemini) — queue design, alert dedupe pitfall, stale-run sweep, verification limits in dev.
---

# AI Narrative Monitor (pro+ feature)

Scheduled runs query OpenAI + Gemini (grounded) with prompts about an org's
tracked entities (seeded from watchlist brand/competitor keywords), score each
answer with gpt-4o-mini (JSON mode, temp 0: sentiment/SoV/claims/quotes), store
history, and raise "ai_narrative" alerts on cross-provider sentiment drops
(avg delta ≤ −0.3; −0.5 high, −0.7 critical) through the normal alert-dispatch
pipeline.

Also raises "ai_sov" alerts (share-of-voice): brand SoV drop ≥10pp vs previous
run, or a competitor overtaking the brand (was ≤ brand, now > brand). Severity:
both=critical, overtake or ≥20pp=high, else medium. Same 24h dedupe rule
(type+keyword, ignore status) but on its OWN type so it never collides with
sentiment alerts. Payload carries previousSov/currentSov/sovDelta/overtakenBy.

## Durable rules
- **Dedicated BullMQ queue** ("ai-narrative", concurrency 1, attempts 1 — LLM
  calls are billable, never retry; same rationale as other billable collectors).
  Hourly tick job decides which orgs are due (pro 24h / enterprise 6h cadence).
- **Alert dedupe must NOT filter on status "open"** — the alert-dispatch worker
  flips alerts to "dispatched" within seconds of insert, so a status="open"
  dedupe never matches and every run re-alerts. Dedupe on
  type+keyword+createdAt window only. **Why:** found in architect review; would
  have caused up to 4 duplicate alert blasts/day on enterprise cadence.
- **Stale "running" runs must be swept** — a process restart mid-run leaves the
  run row "running" forever, permanently 409-blocking manual runs and disabling
  the portal "Run now" button. Fix pattern: the hourly tick marks runs stuck
  running > 45 min as failed, and the POST /run 409 guard ignores runs older
  than that cutoff. Apply the same pattern to any future long-running run-row
  status machine.
- Overview `lastRun` intentionally excludes failed runs (UI shows last useful
  data); run history endpoint shows everything including failures.
- Known accepted race: two rapid POST /run both pass the 409 guard (run row is
  created by the worker, not at enqueue). Serialized by concurrency 1;
  owner/admin-only, so accepted.

## Verification limits in dev
Dev has no OpenAI/Gemini keys (platform resolves keys DB-first via Super Admin
platform_configs), so runs fail gracefully ("N provider queries failed") and
real scoring + alert dispatch can only be verified in prod once keys are set.
E2E in dev = seed synthetic completed runs/responses via SQL, then verify
overview deltas/timeline/UI (worked; Playwright test passed).
