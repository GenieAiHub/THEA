---
name: DB package rebuild process
description: After adding new schema files to lib/db/src/schema/, the package must be rebuilt before downstream TypeScript consumers will see the new exports.
---

## Rule
After any schema change in `lib/db/src/schema/`, run:
```
cd lib/db && pnpm exec tsc --build tsconfig.json
```
before running `pnpm exec tsc --noEmit` in the API server or any other consumer.

**Why:** The DB package uses TypeScript project references (`composite: true`). The consumer packages import from `@workspace/db/schema` which resolves to `lib/db/dist/`. If the dist is stale, new table exports are simply missing and you get TS2305 "Module has no exported member" errors that look like schema bugs but are actually stale build artifacts.

**How to apply:** Always rebuild DB before typechecking after any schema file addition or edit.
