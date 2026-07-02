---
name: Ingestion dedup flow
description: How the Bloom filter + Redis + DB dedup chain must be wired in pipeline.ts
---

After a successful DB insert, call `markSeen(contentHash, orgId, itemId)` — NOT `cacheHash()`.

**Why:** `markSeen()` sets all 7 Bloom filter bits AND populates the Redis exact-cache in one call. `cacheHash()` only fills the Redis exact-cache; the Bloom filter stays cold, so `isDuplicate()` always returns false on its fast-path and every repeat article reaches the DB insert, causing duplicates.

**How to apply:** In `pipeline.ts`, after `.returning({ id })` resolves with `inserted`, call `markSeen(contentHash, orgId, inserted.id)`. Never call `cacheHash()` in the insert path.
