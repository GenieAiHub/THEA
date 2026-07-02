---
name: Orval codegen blocker
description: Orval v8.18.0 fails to regenerate api.ts — root causes, workarounds, and safe fallback procedure.
---

# Orval Codegen Blocker

## The rule
Never run `pnpm run --filter @workspace/api-spec codegen` without being prepared to restore the generated files from git if it fails. Set `clean: false` in `lib/api-spec/orval.config.ts` (already done) so a failed run doesn't wipe the existing files.

**Why:** Orval v8.18.0 produces "Failed to resolve input: Please provide a valid string value or pass a loader to process the input" even after all known fixes were applied. The generated files are the only source of truth for the API client hooks.

## Root causes investigated (none fully resolved)
1. **Duplicate path key** — `/v1/intelligence/simulate` appeared twice in `lib/api-spec/openapi.yaml`. The stub version (lines ~776–783, operationId: runWhatIfSimulation, 501 response) was removed. The real one remains at ~line 1157.
2. **OpenAPI 3.1 nullable syntax** — 19 instances of `type: ["string", "null"]` were converted to `type: string, nullable: true`. Version header changed from `openapi: 3.1.0` to `openapi: 3.0.3`.
3. **Deeper YAML issue** — The error persists even after the above fixes, even with `validation: false` and absolute paths. The problem is in paths defined in the second half of the file (lines 608+). Further binary-search debugging is needed.

## Safe fallback procedure
If generated files are ever missing:
```bash
git --no-optional-locks show HEAD:lib/api-client-react/src/generated/api.ts > lib/api-client-react/src/generated/api.ts
git --no-optional-locks show HEAD:lib/api-client-react/src/generated/api.schemas.ts > lib/api-client-react/src/generated/api.schemas.ts
```

## How to apply
- Before any `pnpm run codegen`, confirm `clean: false` in `lib/api-spec/orval.config.ts`
- After any failed codegen, immediately restore from git as above
- The `<any>` generic workarounds in Phase 7 pages are intentional until codegen is fixed
