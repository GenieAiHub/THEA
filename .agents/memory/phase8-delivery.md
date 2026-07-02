---
name: Phase 8 delivery architecture
description: Email delivery queue design — transactional vs digest-schedule-trigger jobs, digest scheduler pattern
---

# Email delivery + digest scheduler design

## The rule
The `email-delivery` BullMQ queue handles **two** types of jobs:
1. **Transactional** (added by alert-dispatch-worker): `{ to, subject, template, data }` — spike alerts, welcome emails, etc.
2. **Digest trigger** (added by BullMQ repeatable scheduler): `name: "digest-schedule-trigger"`, `data: { orgId }` — the worker builds digest data from DB and sends the email inline.

The digest scheduler (`src/lib/digestScheduler.ts`) uses `emailDelivery.upsertJobScheduler(...)` to register per-org cron jobs.

**Why:** Digest builds need fresh DB data at send time, not at schedule-registration time. Putting the trigger on the same queue avoids needing a separate `report-generation` queue worker.

## How to apply
- When adding new scheduled email types: add another `job.name === "..."` branch in `emailDeliveryWorker.ts`
- When the email queue seems to not process digests: check that `scheduleDigests()` ran on startup and that `emailDelivery.upsertJobScheduler` didn't throw (it logs a WARN if it fails)
- Resend delivery is gated on `RESEND_API_KEY`; without it, emails are logged as `[DRY-RUN]`
