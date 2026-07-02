---
name: THEA branding assets
description: Where the THEA brand icon lives, the sizes derived from it, and the iOS app-icon alpha gotcha.
---

# THEA brand icon

Source of truth: `attached_assets/icon_1783026786954.png` — 1024x1024 RGBA, dark
rounded-square badge with a glowing eye, transparent rounded corners. Imported into
the website hero via the Vite `@assets` alias (full res, rendered large).

## Web favicons/logos (all 3 SPAs: thea-website, admin-ui, markets)
- `public/favicon.png` — 64x64 (index.html `<link rel=icon type=image/png>`).
- `public/apple-touch-icon.png` — 180x180 (index.html `<link rel=apple-touch-icon>`).
- `thea-website/public/logo.png` — 128x128 (visible logo on auth/dashboard/onboarding,
  referenced via a BASE_URL-relative path).
- **Rule:** never ship the raw 1024px source as a favicon/small logo — it's ~3.6 MB
  and is fetched on every first visit. Downscale with ImageMagick (`magick`, present
  in the env). Copied assets inherit 600 perms from attached_assets; chmod 644 so the
  Docker nginx (non-root worker) can serve them.

## Mobile (Expo thea-access)
- `assets/images/icon.png` (1024x1024) drives `icon`, `splash`, and web favicon in app.json.
- **iOS App Store gotcha:** the 1024 marketing icon must have NO alpha channel; this
  source is RGBA with transparent corners, and Expo does not flatten the top-level
  `icon`. Before an EAS/App Store build, add a flattened opaque `ios.icon` (and ideally
  an `android.adaptiveIcon` with foregroundImage + backgroundColor). Dev/Expo Go is
  unaffected.
- `splash.backgroundColor` is `#ffffff` (dark icon on a white splash — cosmetic only).
