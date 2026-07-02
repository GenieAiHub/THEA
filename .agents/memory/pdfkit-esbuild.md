---
name: pdfkit + pptxgenjs esbuild fix
description: fontkit (pdfkit dep) uses @swc/helpers — must externalize both packages in build.mjs
---

# pdfkit + pptxgenjs esbuild externalization

## The rule
Both `pdfkit` and `pptxgenjs` must be in the `external` array in `artifacts/api-server/build.mjs`.

**Why:** pdfkit depends on `fontkit@2`, which is compiled with @swc/helpers. When esbuild bundles fontkit, it leaves `require('@swc/helpers/cjs/_define_property.cjs')` as a runtime require (because @swc/* is already external). That require then fails at startup because @swc/helpers is not in the api-server's direct dependencies. Externalizing pdfkit prevents fontkit from being inlined.

## How to apply
If you add any PDF/presentation/font library and get `Cannot find module '@swc/helpers/...'` at runtime, add it to the `external` list in `build.mjs`.
