---
name: Phase 7 client portal architecture
description: How the authenticated THEA client portal is wired — Clerk, routing, DashboardLayout, API hooks.
---

# Phase 7 Client Portal Architecture

## The rule
The thea-website artifact at `/` serves both the public marketing landing page (Home.tsx) and the authenticated portal (8 dashboard pages). These are NOT separate artifacts.

**Why:** Single artifact at root path. Clerk auth gates the portal pages inside the same React SPA.

## Routing pattern
- `/` → HomeRedirect: signed-out shows Home.tsx, signed-in redirects to /dashboard
- `/sign-in/*?` and `/sign-up/*?` → Clerk embedded components
- `/dashboard`, `/trends`, `/trends/:topic`, `/watchlist`, `/alerts`, `/ai-tools`, `/data-explorer`, `/settings`, `/onboarding` → authenticated pages via DashboardLayout

## DashboardLayout auth guard
```tsx
<Show when="signed-out"><Redirect to="/" /></Show>
<Show when="signed-in"><...dashboard content...></Show>
```
`Redirect` comes from `wouter`, NOT from `@clerk/react`.

## Clerk setup (App.tsx)
- `publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)` — required for managed Clerk
- `import.meta.env.VITE_CLERK_PROXY_URL` for the proxy
- ClerkProvider wraps outside QueryClientProvider (Clerk inner → Query inner)
- `routerPush`/`routerReplace` delegate to wouter's `setLocation`

## API hooks pattern
All hooks import from `@workspace/api-client-react`. The restored api.ts has `void` return types for many hooks (codegen was frozen). Use `<any>` generic to work around: `useListAlerts<any>(params)`.

API responses are wrapped: `{ data: [...] }` — so `const { data: x } = useListAlerts<any>()` gives `x.data` as the array.

## How to apply
- When adding new dashboard pages, always wrap in `<DashboardLayout>`
- When using a hook that returns `void`, add `<any>` generic until codegen is fixed
- `Redirect` is always from `wouter`, never from `@clerk/react`
