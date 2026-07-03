---
name: THEA branding assets
description: Where the THEA brand icon lives, the sizes derived from it, and the iOS app-icon alpha gotcha.
---

# THEA brand icon

Two distinct assets — do NOT swap them (a prior change wrongly used the square icon
as the website hero logo and the user was annoyed):
- **Icon** `attached_assets/icon_1783026786954.png` (1024x1024 square eye-tile) =
  favicon / mobile app icon ONLY. Never use it as an on-page logo.
- **Logo** `attached_assets/thea-logo.png` (3:2 full lockup: eye + "THEA" wordmark +
  "TOTAL HUMAN ENGAGEMENT ANALYTIC" tagline, transparent) = the brand logo everywhere
  a logo renders (heroes, navbars, sidebars, footers, auth pages, admin, mobile login).

**Rules:**
- The lockup is 3:2 — always size with `h-X w-auto object-contain`, never a square
  `w-X h-X` (that distorts it). Auth/centered spots ~h-16; nav/sidebar ~h-8..h-10.
- The lockup already contains the "THEA" wordmark + tagline, so remove any adjacent
  "THEA"/"THEA_OP"/"Total Human Engagement Analytics" text to avoid duplication.
- Web usage: `public/logo.png` per SPA via a BASE_URL-relative path, except the
  thea-website Home hero which imports `@assets/thea-logo.png` (Vite alias exists in
  all 3 SPAs). Mobile uses `require("../assets/images/logo.png")`.

## Web favicons/logos (all 3 SPAs: thea-website, admin-ui, markets)
- `public/favicon.png` — 64x64 (index.html `<link rel=icon type=image/png>`).
- `public/apple-touch-icon.png` — 180x180 (index.html `<link rel=apple-touch-icon>`).
- `public/logo.png` (each SPA) — the full lockup, downscaled to 800x533 (~364KB).
- **Rule:** never ship the raw source (icon 1024px ~3.6MB / logo 1536x1024 ~2.6MB) as a
  web asset — downscale with ImageMagick (`magick`, present in env). Copied assets inherit
  600 perms from attached_assets; chmod 644 so the Docker nginx (non-root worker) can serve them.

## Mobile (Expo thea-access)
- `assets/images/icon.png` (1024x1024) drives `icon`, `splash`, and web favicon in app.json.
- **iOS App Store gotcha:** the 1024 marketing icon must have NO alpha channel; this
  source is RGBA with transparent corners, and Expo does not flatten the top-level
  `icon`. Before an EAS/App Store build, add a flattened opaque `ios.icon` (and ideally
  an `android.adaptiveIcon` with foregroundImage + backgroundColor). Dev/Expo Go is
  unaffected.
- `splash.backgroundColor` is `#ffffff` (dark icon on a white splash — cosmetic only).
