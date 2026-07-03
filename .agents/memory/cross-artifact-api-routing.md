---
name: Cross-artifact API routing
description: How frontend artifacts must address the api-server artifact in this monorepo
---

Frontend artifacts (admin-ui, markets, thea-website) call the API server with **root-relative** URLs (`/api/v1/...`). The platform proxy routes `/api` to the api-server artifact.

**Why:** Each frontend is served under its own base path (`/admin`, `/markets`, `/`). Prepending `import.meta.env.BASE_URL` to API calls (e.g. `/admin/api/v1/...`) sends the request to the frontend's own Vite dev server, which returns the SPA index.html fallback — fetch gets a 200 with HTML, `res.json()` throws, and callers see misleading errors (e.g. admin login reporting "Invalid token" when the token was fine). None of the Vite configs define an `/api` proxy.

**How to apply:** In any frontend in this repo, always use `fetch("/api/v1/...")` (or the generated `@workspace/api-client-react` client with no `setBaseUrl`, which produces root-relative URLs). Only use `BASE_URL` for the app's own client-side routes and static assets, never for API calls.

**Cross-artifact NAV links are different from API calls.** A root-relative `href="/"` or `href="/markets/"` only reaches the other app in dev / single-origin, where the platform proxy serves every artifact under one origin. In the Docker/VPS prod deploy each web artifact is its own subdomain (`thea.quest` website, `markets.thea.quest` markets, admin separate), so `href="/"` from markets loops back to markets — a no-op. Cross-subdomain nav links must therefore use a build-time-baked absolute URL, NOT a relative path:
- website → markets: `VITE_MARKETS_URL` (see `artifacts/thea-website/src/lib/urls.ts`)
- markets → website: `VITE_WEBSITE_URL` (see `artifacts/markets/src/lib/urls.ts`)
Each is a Dockerfile `build-web` ARG+ENV, defaulted in docker-compose (`WEBSITE_MARKETS_URL`, `MARKETS_WEBSITE_URL`), and the frontend helper falls back to a root-relative path so dev keeps working. When adding a link that points at a *different* web artifact, add/reuse a `VITE_*_URL` knob — never hardcode a domain and never assume `/` reaches a sibling app.
