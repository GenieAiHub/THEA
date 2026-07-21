/**
 * Camera sampler leader-lock unit tests (deterministic, mocked Redis).
 *
 * Verifies the fail-closed contract that keeps a multi-replica deployment
 * from double-sampling cameras:
 *  - non-leader with Redis error never assumes leadership
 *  - non-leader whose SET NX is rejected (another node holds the lock) stays standby
 *  - leader whose renew errors keeps leadership only within the TTL grace window
 *  - leader whose renew errors past the TTL stands down
 *  - leader whose renew returns 0 (lock lost) re-acquires only via SET NX
 *
 * Run (from artifacts/api-server):
 *   pnpm exec esbuild src/tests/camera-sampler-leader-lock.test.ts --bundle --platform=node --format=esm \
 *     --outfile=dist/leader-lock-test.mjs --external:*.node --external:pino --external:pino-pretty \
 *     --external:ioredis --external:bullmq "--external:@elastic/*" "--external:@opentelemetry/*" "--external:@tensorflow/*" \
 *     --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
 *   && node dist/leader-lock-test.mjs
 */

import { __leaderLockTesting as L } from "../lib/watch/cameraSampler";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

function mockRedis(opts: {
  evalResult?: unknown;
  evalError?: Error;
  setResult?: string | null;
  setError?: Error;
}) {
  return {
    async eval() {
      if (opts.evalError) throw opts.evalError;
      return opts.evalResult ?? 0;
    },
    async set() {
      if (opts.setError) throw opts.setError;
      return opts.setResult ?? null;
    },
  };
}

const redisDown = new Error("ECONNREFUSED (simulated redis outage)");

async function main() {
  const { LEADER_TTL_MS } = L.constants;

  console.log("1. Non-leader + Redis error → fail closed (no leadership)");
  L.setState({ isLeader: false, lastSuccessfulLockAt: 0 });
  L.setRedisOverride(mockRedis({ setError: redisDown }));
  assert((await L.tryAcquireOrRenewLeadership()) === false, "returns false when SET NX errors");

  console.log("2. Non-leader + lock held by another node (SET NX → null) → standby");
  L.setState({ isLeader: false, lastSuccessfulLockAt: 0 });
  L.setRedisOverride(mockRedis({ setResult: null }));
  assert((await L.tryAcquireOrRenewLeadership()) === false, "returns false when lock is held elsewhere");

  console.log("3. Non-leader + lock free (SET NX → OK) → acquires leadership");
  L.setState({ isLeader: false, lastSuccessfulLockAt: 0 });
  L.setRedisOverride(mockRedis({ setResult: "OK" }));
  assert((await L.tryAcquireOrRenewLeadership()) === true, "returns true on successful acquisition");
  assert(L.getState().lastSuccessfulLockAt > 0, "records lock timestamp on acquisition");

  console.log("4. Leader + renew succeeds → keeps leadership");
  L.setState({ isLeader: true, lastSuccessfulLockAt: Date.now() });
  L.setRedisOverride(mockRedis({ evalResult: 1 }));
  assert((await L.tryAcquireOrRenewLeadership()) === true, "returns true on renew");

  console.log("5. Leader + Redis error within TTL grace window → retains leadership");
  L.setState({ isLeader: true, lastSuccessfulLockAt: Date.now() - Math.floor(LEADER_TTL_MS / 2) });
  L.setRedisOverride(mockRedis({ evalError: redisDown, setError: redisDown }));
  assert((await L.tryAcquireOrRenewLeadership()) === true, "returns true while last confirmed lock < TTL old");

  console.log("6. Leader + Redis error past TTL → stands down (fail closed)");
  L.setState({ isLeader: true, lastSuccessfulLockAt: Date.now() - LEADER_TTL_MS - 1 });
  L.setRedisOverride(mockRedis({ evalError: redisDown, setError: redisDown }));
  assert((await L.tryAcquireOrRenewLeadership()) === false, "returns false once TTL grace window elapsed");

  console.log("7. Leader + renew returns 0 (lock lost) + other node holds it → stands down");
  L.setState({ isLeader: true, lastSuccessfulLockAt: Date.now() });
  L.setRedisOverride(mockRedis({ evalResult: 0, setResult: null }));
  assert((await L.tryAcquireOrRenewLeadership()) === false, "returns false when lock was taken over");

  console.log("8. Leader + renew returns 0 but lock is free → re-acquires via SET NX");
  L.setState({ isLeader: true, lastSuccessfulLockAt: Date.now() });
  L.setRedisOverride(mockRedis({ evalResult: 0, setResult: "OK" }));
  assert((await L.tryAcquireOrRenewLeadership()) === true, "returns true after clean re-acquisition");

  console.log("9. Leader + renew returns 0 (lock KNOWN lost) + SET NX errors → NO grace window, stands down");
  L.setState({ isLeader: true, lastSuccessfulLockAt: Date.now() });
  L.setRedisOverride(mockRedis({ evalResult: 0, setError: redisDown }));
  assert((await L.tryAcquireOrRenewLeadership()) === false, "returns false — confirmed lock loss disables TTL grace");

  L.setRedisOverride(null);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
