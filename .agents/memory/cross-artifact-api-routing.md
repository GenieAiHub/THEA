---
name: Cross-artifact API routing
description: How frontend artifacts must address the api-server artifact in this monorepo
---

Frontend artifacts (admin-ui, markets, thea-website) call the API server with **root-relative** URLs (`/api/v1/...`). The platform proxy routes `/api` to the api-server artifact.

**Why:** Each frontend is served under its own base path (`/admin`, `/markets`, `/`). Prepending `import.meta.env.BASE_URL` to API calls (e.g. `/admin/api/v1/...`) sends the request to the frontend's own Vite dev server, which returns the SPA index.html fallback — fetch gets a 200 with HTML, `res.json()` throws, and callers see misleading errors (e.g. admin login reporting "Invalid token" when the token was fine). None of the Vite configs define an `/api` proxy.

**How to apply:** In any frontend in this repo, always use `fetch("/api/v1/...")` (or the generated `@workspace/api-client-react` client with no `setBaseUrl`, which produces root-relative URLs). Only use `BASE_URL` for the app's own client-side routes and static assets, never for API calls. Cross-artifact links (e.g. website → markets app) also use root-relative paths like `/markets/`.
