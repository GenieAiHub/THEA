---
name: OTel + drizzle-orm monorepo fix
description: How to resolve @opentelemetry/api missing at runtime in pnpm monorepos with @elastic/elasticsearch and drizzle-orm
---

## The Rule
Install `@opentelemetry/api`, `@opentelemetry/core`, and `@opentelemetry/semantic-conventions` at the workspace root whenever `@elastic/elasticsearch` is a dependency. The `@elastic/transport` package statically imports OTel, and esbuild externalizes those imports (they're in the `"@opentelemetry/*"` external list), so they must be installed to be resolvable at runtime.

**Why:** `@elastic/transport` has static (not dynamic) `import ... from "@opentelemetry/api"` and `import ... from "@opentelemetry/core"` statements. When esbuild bundles the app and sees these imports, it leaves them as external `import` statements in the bundle output. If the packages aren't installed, Node.js throws `ERR_MODULE_NOT_FOUND` at startup.

**How to apply:** Any time `@elastic/elasticsearch` is added to a bundled Node.js app, also run:
```
pnpm add -w @opentelemetry/api@^1.9.0 @opentelemetry/core@^2.8.0 @opentelemetry/semantic-conventions@^1.41.0
```

## Secondary lesson: drizzle-orm dual-instance types
When a workspace package (e.g. `lib/db`) resolves to the OTel-aware drizzle-orm variant and another package (e.g. `api-server`) resolves to the non-OTel variant, TypeScript sees two incompatible `SQL<unknown>` types. Fix: ensure all packages in the workspace resolve to the same drizzle-orm variant (both will pick the OTel variant once OTel is installed).

`pnpm.peerDependencyRules.ignoreMissing` only suppresses warnings — it does NOT prevent the OTel variant from being selected when OTel IS installed.
