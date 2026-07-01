---
name: BullMQ ioredis version conflict
description: How to configure BullMQ connection to avoid ioredis version conflicts in pnpm workspaces
---

## The Rule
Always pass a connection **config object** (not a Redis instance) to BullMQ queues/workers:

```ts
const connection = { url: process.env.REDIS_URL };
new Queue("myQueue", { connection });
new Worker("myQueue", handler, { connection });
```

**Why:** BullMQ bundles its own ioredis internally. If you create a Redis instance with `new Redis(url)` from the workspace ioredis and pass it to BullMQ, TypeScript (and sometimes the runtime) treats them as different types because pnpm resolves BullMQ's ioredis to a different version than the workspace ioredis. Passing a plain config object lets BullMQ create its own connection internally using its own ioredis — no version conflict.

**How to apply:** In `lib/queues.ts` (and any worker files), use `{ url: REDIS_URL }` or `{ host, port }` as the connection option instead of a shared Redis instance. Keep the standalone `getRedis()` singleton only for non-BullMQ Redis operations (caching, pub/sub, health checks).
