---
name: Previewing auth-gated thea-website pages
description: How to visually verify a Protected page in thea-website when the screenshot tool can't sign in
---

thea-website uses self-hosted cookie auth (AuthContext -> /api/v1/auth/me, login/register). There is NO dev/demo/auto-login bypass, and the static screenshot tool uses a fresh browser context with no session — so navigating to any `<Protected>` route just redirects to the sign-in page.

**Why:** Can't type into the login form via the screenshot tool, and no cookie carries over.

**How to apply (visual verify a Protected page):**
1. Refactor the page's visual content into an exported body component (e.g. `SimulationDashboardBody`) that does NOT call `useAuth`; the default export wraps it in `DashboardLayout`. (`DashboardLayout` itself redirects when unauthenticated, so don't rely on it for the preview.)
2. Temporarily add an UNPROTECTED route in App.tsx that renders the body inside a plain dark wrapper.
3. Screenshot that temp route, then remove the temp route (keep or drop the body split).

Gotcha: after refactoring the return (e.g. replacing `</DashboardLayout>` with `</div>`), re-run typecheck — it's easy to leave an unbalanced/extra `</div>`. A clean typecheck before the edit does not survive the refactor.
