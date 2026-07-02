---
name: Phase 6 intelligence queue architecture
description: The intelligence-jobs BullMQ queue must be separate from llm-processing to avoid job-stealing between workers.
---

## Rule
Intelligence background jobs (journalist scan, newsjacking detection, campaign measurements, competitive briefing) must use the dedicated `intelligenceJobs` queue (`"intelligence-jobs"`), never `llmProcessing`.

**Why:** BullMQ workers on the same queue name compete for jobs. If the intelligence worker shared `llm-processing`, it would steal analysis/embedding jobs meant for the analysis worker, and vice versa. The concurrency constraints also differ: intelligence jobs run sequentially (concurrency=1) while LLM processing allows concurrency=3.

**How to apply:** Any new intelligence background job should add a case to `lib/intelligence/worker.ts` and schedule via `getQueues().intelligenceJobs.upsertJobScheduler(...)` in `lib/intelligence/scheduler.ts`.
