---
name: MiroFish real-engine integration
description: How THEA drives the real upstream MiroFish OASIS simulation engine, and the two non-obvious contract/deploy gotchas that bite.
---

# MiroFish real-engine integration

THEA's "What-If Simulator" drives the REAL upstream MiroFish engine
(github.com/666ghj/MiroFish, AGPL-3.0) run as an OPT-IN docker sidecar. The
unmodified image is consumed over a network API only, so AGPL copyleft does not
reach THEA's own code.

## Routing split — enforced STRUCTURALLY, not by a flag
- On-demand What-If runs (triggeredBy "simulate", Pro+) → the real 6-step OASIS
  pipeline (`runMiroFishPipeline`).
- Hourly scheduler + standard runs → the fast GPT-4o path (`runGptAnalysis`).
- **Why:** a full OASIS run is minutes-to-an-hour of real LLM spend. The two paths
  call different functions directly; there is no shared flag that could
  accidentally route the hourly job through the heavy pipeline. Keep it that way.
- On ANY MiroFish error the pipeline falls back to `runGptAnalysis`, so a
  simulation request never hard-fails. Simulate jobs use attempts:1 (never
  auto-retry a whole expensive run).

## GOTCHA 1 — simulation completion lives in `runner_status`, not `status`
The 6-step contract is: `/health` → `POST /api/graph/ontology/generate`
(multipart) → `/api/graph/build` + poll `GET /api/graph/task/<id>` →
`/api/simulation/create` → `/api/simulation/prepare` + poll
`POST /api/simulation/prepare/status` → `/api/simulation/start` → **poll
`GET /api/simulation/<id>/run-status`** → `/api/report/generate` + poll
`POST /api/report/generate/status` → `GET /api/report/<id>` (markdown_content).

The trap: `GET /api/simulation/<id>` returns the *lifecycle* `status`, which
`/start` sets to `"running"` and which stays `"running"` until the env is
explicitly closed — natural completion NEVER flips it to `"completed"`. Natural
completion is only reflected in **`runner_status`** (enum: idle/starting/running/
paused/stopping/stopped/completed/failed) via the dedicated `/run-status`
endpoint. Poll that: done=["completed"], fail=["failed","stopped"]. Note
`/run-status` returns `"idle"` before the runner spins up (non-terminal).
**Why it matters:** polling the wrong field means every run burns full LLM spend,
spins to the deadline, times out, and silently falls back to GPT — the real
engine's output is discarded. A local mock will happily "pass" against the wrong
contract, so mirror the REAL field names in any mock.

Cleanup: `POST /api/simulation/close-env {simulation_id}` best-effort in a
`finally` to release the sidecar's long-lived env process.

## GOTCHA 2 — Compose interpolates the whole file BEFORE profile filtering
Never put `${VAR:?...}` (required) on an opt-in/profiled service. Docker Compose
interpolates the ENTIRE file before it filters by `profiles:`, so a plain
`docker compose up -d` that never enables the profile still fails on the missing
required var. Use `${VAR:-}` and rely on the container's own startup validation
(MiroFish's `Config.validate()` sys.exit(1) refuses to boot without ZEP_API_KEY +
an LLM key). Verified with `docker compose config` (no profile ⇒ service excluded
and config succeeds; `--profile mirofish` ⇒ included with empty ZEP).

## Keys
LLM_API_KEY defaults to OPENAI_API_KEY; ZEP_API_KEY (Zep Cloud) is mandatory for
the sidecar. Sidecar is internal-network only, no published ports.
