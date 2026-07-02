---
name: js-yaml v5 import
description: js-yaml v5 has no default export — use named imports
---

# js-yaml v5 named import requirement

## The rule
`import YAML from "js-yaml"` fails at esbuild bundle time with js-yaml v5 — there is no default export.

Use: `import { load as yamlLoad } from "js-yaml"`

**Why:** js-yaml v5 switched to pure ESM with named exports only. esbuild's ESM bundling cannot synthesize a default export from a package that has no `default` in its exports map.

## How to apply
Any time you need to parse YAML on the server (e.g. loading openapi.yaml for Swagger UI), use the named `load` function. The API is identical: `yamlLoad(str) as T`.
