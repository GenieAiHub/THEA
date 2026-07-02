---
name: Web crawler politeness
description: Required rate-limit and UA-rotation controls for Crawlee-based web crawler
---

Three required politeness controls in `collectors/web-crawler.ts`:

1. **Per-domain 1 req/sec**: `domainLastRequest` Map tracks last request timestamp per hostname; `waitForDomain(hostname)` delays until at least 1 s has elapsed before processing each page.
2. **Crawlee-level rate cap**: `maxRequestsPerMinute: 20` on `CheerioCrawler` constructor options prevents burst storms.
3. **UA rotation**: Pool of 6 real browser UA strings (`USER_AGENTS[]`), one chosen randomly per request via `randomUa()`, injected as the `User-Agent` header on each Crawlee request and via `page.setExtraHTTPHeaders` in the Playwright path.

**Why:** Without these, repeated crawls of the same domains trigger bot-detection and rate-limit blocks; scraped domains may also block the server IP.

**How to apply:** All three must be present on both `CheerioCrawler` and `PlaywrightCrawler` code paths. `useSessionPool: true` is also set on both to enable Crawlee's built-in fingerprint rotation.
