---
name: Phase 7 client portal architecture
description: How the authenticated THEA client portal is wired — self-hosted auth, routing, DashboardLayout, API hooks.
---

# Phase 7 Client Portal Architecture

## The rule
The thea-website artifact at `/` serves both the public marketing landing page (Home.tsx) and the authenticated portal (dashboard pages). These are NOT separate artifacts — a single React SPA gated by our own AuthContext.

**Why:** Single artifact at root path; self-hosted email+password + session-cookie auth gates the portal pages inside the same SPA.

## Auth architecture (self-hosted — Clerk was removed)
- Backend: `lib/auth.ts` (scrypt hash/verify keylen64, sha256 session token, `thea_session` cookie HttpOnly;Secure;SameSite=Lax;Path=/;30d), `middlewares/auth.ts` (requireAuth/requireRole/resolveOrgContext/createSession/deleteSession/registerOrgOwner), `routes/v1/auth.ts` (register/login/logout/me).
- **register auto-creates org + owner membership + starter subscription transactionally** and sets the session cookie.
- login uses a valid-format DUMMY_HASH so scrypt always runs (timing-attack / user-enumeration mitigation); authRateLimiter guards register+login.
- Frontend: `context/AuthContext.tsx` exposes `useAuth()` → `{ user, org, tier, featureFlags, isLoaded, isSignedIn, login, register, logout, refresh }`. Calls `/api/v1/auth/me` with `credentials:"include"` on mount; `queryClient.clear()` on every auth change.

## Routing pattern (App.tsx)
- Provider order: `WouterRouter base=basePath > QueryClientProvider > AuthProvider > TooltipProvider`.
- `/` → HomeRedirect: signed-out shows Home.tsx, signed-in redirects to /dashboard.
- `/sign-in`, `/sign-up` → custom `SignInPage`/`SignUpPage` (dark theme, self-hosted forms).
- Protected pages use `<Route path="…">{() => <Protected><Page/></Protected>}</Route>`. `Protected` reads `useAuth`: shows loader until `isLoaded`, redirects to `/sign-in` if `!isSignedIn`. Function-child form preserves wouter `useParams()` in nested pages.

## DashboardLayout auth guard
`useAuth()` for user/org/logout; `if (!isLoaded) return placeholder; if (!isSignedIn) return <Redirect to="/" />`. `Redirect` comes from `wouter`. Avatar shows initials from `user.name`/`user.email` (no imageUrl). Sign-out calls `logout()` then `setLocation("/")`.

## API URLs — root-relative only
AuthContext `API_BASE = "/api/v1/auth"` (root-relative). Do NOT prepend `import.meta.env.BASE_URL` — see [cross-artifact-api-routing](cross-artifact-api-routing.md); prepending hits the Vite server and returns SPA HTML if the site is ever mounted at a subpath.

## API hooks pattern
All hooks import from `@workspace/api-client-react`. Many hooks have `void` return types (codegen frozen) — use `<any>` generic: `useListAlerts<any>(params)`. Responses are wrapped `{ data: [...] }`, so `const { data: x } = useListAlerts<any>()` gives `x.data` as the array.

## How to apply
- New dashboard pages: wrap the route in `<Protected>` and the component in `<DashboardLayout>`.
- Frontend API calls: root-relative `/api/v1/...`, never BASE_URL-prefixed.
- `Redirect` is always from `wouter`.
