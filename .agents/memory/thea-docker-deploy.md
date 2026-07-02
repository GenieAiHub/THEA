---
name: THEA Docker/VPS deployment
description: Containerizing the THEA monorepo for self-hosting behind a shared Caddy proxy — the non-obvious build/runtime decisions
---

# THEA Docker deployment (self-host / VPS)

## api runtime image ships the whole workspace, not a slim dist
The api esbuild bundle (artifacts/api-server/build.mjs) EXTERNALIZES native/dynamic
deps (playwright, crawlee + @crawlee/*, @tensorflow/tfjs-backend-wasm, pdfkit,
pptxgenjs, telegram, franc, @google/generative-ai). A dist-only runtime crashes at
the first externalized import.
**Rule:** the `api` stage does `COPY --from=build-api /app /app` (full installed +
built workspace) so those bare imports resolve against the pnpm store at runtime
(WORKDIR /app/artifacts/api-server, CMD node ./dist/index.mjs).
**Why:** externals aren't in the bundle; they must exist in node_modules. Face-api
model files are committed under the api package and resolve via dist/../models.

## Chromium is not baked in
pnpm `onlyBuiltDependencies` blocks Playwright's browser postinstall, and the
crawler only launches a browser when USE_PLAYWRIGHT=true. Default image has no
Chromium (lean, avoids build OOM). To enable: set USE_PLAYWRIGHT=true AND uncomment
the `playwright install --with-deps chromium` line in the api stage.

## DB migrate ordering
One-shot `migrate` service (target `tools`) runs `pnpm --filter @workspace/db run
push`; lib/db/scripts/pre-push.mjs runs CREATE EXTENSION IF NOT EXISTS vector
BEFORE drizzle-kit push (needs the pgvector/pgvector:pg16 image), else the
vector(1536)/vector(128) columns fail to create. api depends_on migrate
service_completed_successfully.
**Caveat:** drizzle-kit push can prompt interactively on ambiguous schema changes
and would hang in the non-TTY migrate container (fresh DB is fine; push-force exists).

## Behind the shared Caddy proxy
docker-compose.proxy.yml joins the 3 SPA nginx containers to the external `web`
network (aliases thea-website/thea-admin/thea-markets) and drops host ports; the
api stays on the internal net only (each nginx proxies /api -> api:5000).
**Rule:** TRUST_PROXY is read in app.ts (previously hardcoded to 1) — set it to 3
in proxy mode (CF -> Caddy -> nginx), or express-rate-limit buckets all clients as
one IP. CORS_ORIGIN accepts a comma-separated allowlist (split in app.ts).

## corepack/pnpm version drift breaks the container build
The container's corepack grabs the LATEST pnpm (11.x) unless pinned; pnpm 11 turns
unrun build scripts into a fatal ERR_PNPM_IGNORED_BUILDS, while the Replit dev pnpm
(10.x) only warns — so the image fails to build even though local install is clean.
**Rule:** pin `"packageManager": "pnpm@<dev-version>"` in root package.json AND list
the skipped scripts under `ignoredBuiltDependencies` in pnpm-workspace.yaml
(@scarf/scarf, bufferutil, core-js, es5-ext, msgpackr-extract, utf-8-validate — all
pure-JS fallbacks). Also set COREPACK_ENABLE_DOWNLOAD_PROMPT=0 in the Dockerfile.

## .replit leaks dev secrets into image layers
`.replit` is git-tracked and carries an [env] block with plaintext dev secrets
(PLATFORM_ENCRYPTION_KEY, ADMIN_INTERNAL_TOKEN, PROVISION_TOKEN). `COPY . .` bakes it
into every image layer AND into the repo cloned onto the VPS.
**Rule:** add `.replit` to .dockerignore, and the prod .env MUST use freshly generated
values for those keys — never the committed dev ones. A fresh PLATFORM_ENCRYPTION_KEY
is safe only on a clean DB (it decrypts nothing pre-existing), which a first deploy is.

## attached_assets must stay in the build context
The web apps import images via the Vite `@assets` alias (-> ../../attached_assets),
which IS git-tracked. Ignoring the whole dir in .dockerignore makes `vite build` fail
with ENOENT on the imported image. Ignore only `attached_assets/*.txt` (paste logs).

## dev path-based routing vs prod subdomains breaks cross-artifact links
In the Replit dev env the artifacts share one origin under path prefixes
(website `/`, markets `/markets`), but in prod each is its own subdomain
(thea.quest, markets.thea.quest). A hardcoded `href="/markets/"` works in dev and
404s/SPA-falls-back in prod.
**Rule:** cross-artifact links must be build-time configurable. Add a `VITE_*` build
arg (Vite's loadEnv reads VITE_-prefixed vars from process.env at build), plumb it
through the build-web stage `ENV`, set it per web service in docker-compose args
(e.g. `VITE_MARKETS_URL: https://markets.thea.quest`), and default to the dev path
in code (`import.meta.env.VITE_MARKETS_URL || "/markets/"`).

## import.meta.env.BASE_URL always ends with a slash
`${import.meta.env.BASE_URL || ""}/logo.svg` yields `//logo.svg` in prod (BASE_URL
is `/`), a protocol-relative URL the browser resolves against a host named `logo.svg`
-> broken asset. **Rule:** strip the trailing slash before appending:
`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.svg`.
