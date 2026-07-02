---
name: Public consumer markets auth
description: Why the consumer markets API is anonymous-readable and how tenant isolation is preserved
---

# Public consumer markets auth

The consumer markets router (`v1/markets.ts`) is intentionally PUBLIC/anonymous —
it uses `optionalAuth`, NOT `requireAuth`. The THEA Markets frontend has no login
UI and votes anonymously via a localStorage `voterId`, so a hard auth guard 401s
the entire app.

**Rule:** never re-add `requireAuth` to the consumer markets router. Anonymous
access is a product requirement, not an oversight.

**How isolation is preserved:** `optionalAuth` attaches `req.thea` only when valid
credentials are present, otherwise leaves it undefined and calls `next()` (never
rejects). Each route computes `const userOrgId = req.thea?.org.id ?? PLATFORM_ORG_ID`
and scopes reads/writes with `tenantOr(orgIdColumn, userOrgId)`. So anonymous
callers collapse to platform-only scope (PLATFORM_ORG_ID) and can never reach
another tenant's markets; authenticated callers see own-org + platform. Admin
markets router stays behind requireAuth/requireRole.

**Why:** the whole app is a public Polymarket-style opinion poll; platform-generated
(auto) markets are owned by PLATFORM_ORG_ID and are meant to be visible to everyone.

**Known inherent weakness:** `voterId` is client-supplied and POST `/:id/vote` has
no rate limiting, so anonymous vote counts are spoofable by rotating localStorage
IDs. Acceptable for an opinion-poll app; revisit if abuse matters.

**Category filter:** match case-insensitively with
`sql\`lower(category) = lower(${category})\``, NOT `ilike(category, value)` — ILIKE
treats `%`/`_` in the URL param as wildcards (e.g. `?category=%` matches everything).
