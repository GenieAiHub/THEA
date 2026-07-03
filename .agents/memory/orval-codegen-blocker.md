---
name: Orval codegen (RESOLVED)
description: The long-standing "Failed to resolve input" orval blocker was 3 spec bugs, now fixed. How to keep codegen green.
---

# Orval codegen — root cause found & fixed

The opaque orval v8.18.0 error `Failed to resolve input: Please provide a valid
string value or pass a loader to process the input` was NEVER an orval/redocly
bug. It was `lib/api-spec/openapi.yaml` failing to parse/validate. Three distinct
spec bugs stacked up (fix them in this order; each unmasks the next):

1. **Duplicate mapping keys** — the YAML loader rejects the whole file, surfacing
   the opaque "Failed to resolve input". Symptom is generic; cause is a repeated
   `components.schemas.<Name>`. (Was: TalkingPointsInput/Result + DraftStatementInput/StatementResult defined twice — kept the richer, API-matching copies.)
2. **OpenAPI 3.1 nullable array syntax** — `type: ["number","null"]` is invalid in
   3.0.3 (spec is 3.0.3). Convert every one to `type: number, nullable: true`.
   `perl -i -pe 's/type: \["(\w+)", "null"\]/type: $1, nullable: true/g' openapi.yaml`
3. **Unquoted comma inside a YAML flow mapping** — `{ description: a, b }` parses
   as two keys. Quote any inline `{ description: "...," }` that contains a comma.

After these, `pnpm --filter @workspace/api-spec run codegen` succeeds and also runs
`typecheck:libs`.

## api-zod inline-body name collision (TS2308)
Operations with an **inline** requestBody or query params make orval-zod emit the
SAME name as both a zod const in `generated/api.ts` and a TS type in
`generated/types/` (e.g. `CreateApiKeyBody`, `GetCampaignMeasurementsParams`).
Star-exporting both barrels → `TS2308 already exported a member`. `export type *`
does NOT fix it. Fix: `lib/api-zod/src/index.ts` re-exports ONLY the zod schemas
(`export * from "./generated/api"`). api-zod is a runtime-validation package; TS
types come from `@workspace/api-client-react`. `src/index.ts` is hand-maintained
(orval only writes under `generated/`), so this edit survives codegen.
**Why:** avoids maintaining 9 explicit re-exports that grow with every new inline-body op.

## Rules to keep it green
- Keep `clean: false` in `lib/api-spec/orval.config.ts` (a failed run won't wipe files).
- When adding endpoints, prefer `$ref` to a named component schema over inline
  request bodies to avoid new `<Op>Body` collisions.
- Never name a component schema `<OperationIdPascal>Body`/`Response`/`Params` —
  orval auto-generates those and they collide (TS2308).
