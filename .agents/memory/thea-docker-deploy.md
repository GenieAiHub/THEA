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
