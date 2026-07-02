---
name: OpenAPI body schema naming
description: How to name request body component schemas to avoid Orval TS2308 export collisions
---

Rule: every request/update body must live in `components/schemas` and be `$ref`'d from the operation. Never name the component `<OperationIdPascal>Body` (e.g. `createNote` → `CreateNoteBody`) and never inline the body — use entity-shaped names like `NoteInput`, `NoteUpdate`.

**Why:** Orval emits a Zod schema named `<OperationIdPascal>Body` into `lib/api-zod/src/generated/api.ts` for every operation with a body, and separately emits TS interfaces for body schemas. If the names collide, the barrel's `export *` produces `error TS2308: Module "./generated/api" has already exported a member named '...'` — the failure appears during the chained `typecheck:libs`, looking like a codegen error when it's really a naming collision.

**How to apply:** when writing or editing `lib/api-spec/openapi.yaml`, check every requestBody is a `$ref` to an entity-shaped component name before running codegen.
