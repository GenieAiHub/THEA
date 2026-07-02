# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Multi-stage build for the THEA pnpm monorepo.
#
# Build targets (selected by docker-compose `target:`):
#   - api    : Express API server + in-process BullMQ workers
#   - web    : nginx serving a built Vite SPA + reverse-proxying /api -> api
#   - tools  : full workspace image for DB migrations (drizzle push)
#
# NOTE: unlike a fully self-contained esbuild bundle, THEA's api bundle
# externalizes native/dynamic deps (playwright, crawlee, @tensorflow/*-wasm,
# pdfkit, pptxgenjs, telegram, franc, @google/generative-ai). The `api` stage
# therefore ships the resolved workspace node_modules alongside dist/.
# ---------------------------------------------------------------------------

############################
# Base: Node 24 + pnpm
############################
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

############################
# deps: install the whole workspace once (shared by every build stage)
############################
FROM base AS deps
# Build toolchain so any package with a native/postinstall step installs cleanly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
# Playwright browsers are NOT downloaded during install (pnpm onlyBuiltDependencies
# already blocks its postinstall). The crawler defaults to the HTTP/Cheerio path
# (USE_PLAYWRIGHT=false). See the `api` stage to bake in Chromium if needed.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY . .
RUN pnpm install --frozen-lockfile

############################
# build-api: bundle the API server into dist/index.mjs
############################
FROM deps AS build-api
RUN pnpm --filter @workspace/api-server run build

############################
# build-web: build ONE Vite SPA (BASE_PATH is baked in at build time).
#   docker-compose passes APP (workspace suffix) + BASE_PATH per web service.
############################
FROM deps AS build-web
ARG APP
ARG BASE_PATH=/
# vite.config.ts validates PORT even for `build`; the value is irrelevant here.
ENV PORT=8080 \
    BASE_PATH=${BASE_PATH} \
    NODE_ENV=production
RUN test -n "$APP" || (echo "ERROR: APP build-arg is required" && exit 1) \
 && pnpm --filter @workspace/${APP} run build

############################
# api (runtime): dist/ + resolved workspace node_modules for externalized deps
############################
FROM base AS api
ENV NODE_ENV=production
# Copy the fully-installed & built workspace. This preserves node_modules/.pnpm
# so esbuild-externalized packages (playwright, crawlee, tfjs-backend-wasm,
# pdfkit, pptxgenjs, telegram, franc, @google/generative-ai) resolve at runtime.
COPY --from=build-api /app /app
WORKDIR /app/artifacts/api-server
# To enable Playwright-based crawling, set USE_PLAYWRIGHT=true in .env AND
# uncomment the next line to bake Chromium + its OS libraries into the image:
# RUN pnpm exec playwright install --with-deps chromium
EXPOSE 5000
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]

############################
# tools: DB migrations (drizzle push) — full workspace + dev deps
############################
FROM deps AS tools
# pre-push.mjs ensures the pgvector extension exists before drizzle-kit push.
CMD ["pnpm", "--filter", "@workspace/db", "run", "push"]

############################
# web (runtime): nginx static SPA + /api reverse proxy
############################
FROM nginx:1.27-alpine AS web
ARG APP
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build-web /app/artifacts/${APP}/dist/public /usr/share/nginx/html
EXPOSE 80
