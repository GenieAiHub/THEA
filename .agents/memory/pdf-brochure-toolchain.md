---
name: PDF brochure / print-export toolchain
description: How to capture live screenshots and render multi-page A4 PDFs in this workspace (chromium on NixOS, sandbox time limits)
---

Rule: for print-quality PDF exports, build a standalone HTML with `@page { size: A4; margin: 0 }` + fixed-height `.page` divs, then render with playwright `page.pdf({ format: "A4", printBackground: true })` using the **system chromium** (`executablePath: process.env.CHROME_BIN` = `$(which chromium)`).

**Why:** Playwright's downloaded chromium-headless-shell fails on NixOS (missing libglib). System chromium installed via installSystemDependencies works. Playwright itself is resolved via `createRequire` pointing at artifacts/api-server (only package with playwright installed).

**How to apply:**
- Screenshot capture scripts must use `waitUntil: "load"` + fixed timeout — `networkidle` NEVER settles on portal pages (they poll APIs) and the run gets killed.
- The bash sandbox kills backgrounded/nohup node processes and caps commands at ~2 min: split capture into CLI-arg stages, each run synchronously under 115s.
- Verify output visually: `pdftoppm -jpeg -r 60` the PDF and read the page images.
- Demo data: capture scripts register throwaway `demo-brochure-*@thea.quest` orgs in the dev DB — harmless but delete if dev DB is ever used for seeding.
- Brochure sources live in `exports/brochure/` (capture.mjs, render.mjs, brochure.html, shots/, assets/); output `exports/THEA-Product-Brochure.pdf`.
- Content rule: pipeline stage names on marketing material must match the website's published stages (Collect/Analyze/Detect/Alert/Act); competitor comparisons stay capability-based with a "publicly available information" disclaimer.
