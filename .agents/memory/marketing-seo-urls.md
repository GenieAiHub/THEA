---
name: Marketing site SEO absolute URLs
description: How artifacts/thea-website produces correct absolute canonical/OG/sitemap URLs across dev and Docker deploy
---

- The marketing SPA (artifacts/thea-website) has no SSR. Search engines / social scrapers see only the static index.html shell; JS-capable crawlers additionally get the runtime `<Seo>` component (imperative meta upsert, no react-helmet).
- **Absolute OG/Twitter image + og:url must be baked into index.html at build time.** Vite does NOT rewrite `content="..."` meta attributes for base/domain, and Facebook/Twitter/LinkedIn/Slack do not execute JS — so a relative `/opengraph.jpg` produces no share image. A build-only Vite plugin (`seoBuildPlugin`, `apply:"build"`) rewrites these via `transformIndexHtml` and also emits `sitemap.xml` + a `robots.txt` `Sitemap:` directive in `closeBundle`.
- **Single knob = `VITE_SITE_URL`.** Runtime canonical/OG fall back to `window.origin`, but the build-time sitemap/robots/OG use `VITE_SITE_URL`. Default is `https://thea.quest` (the real prod domain; markets is `markets.thea.quest`). In Docker it is wired as build `ARG VITE_SITE_URL` ← docker-compose `WEBSITE_SITE_URL`.

**Why:** a wrong or relative domain makes the sitemap inert (search engines ignore cross-domain `Sitemap:` directives) and kills social share previews on every page.

**How to apply:** if the prod domain changes, set `WEBSITE_SITE_URL` (compose) / `VITE_SITE_URL`; never hardcode a domain in page components.
