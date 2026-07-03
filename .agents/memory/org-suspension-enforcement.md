---
name: Org suspension enforcement
description: Where org pausedAt is (and is not) enforced, and why the admin surface and markets are exempt
---

# Org suspension (pausedAt) enforcement

Org suspension is enforced in `requireAuth` on **both** paths (API-key branch and
session-token branch): if `context.org.pausedAt` is set → 403 "Organization
suspended". This is what makes the Super Admin "suspend org" action actually
revoke member access.

**Why:** the admin orgs suspend dialog promises "Members will lose access", but
`pausedAt` was previously only read in admin/settings/intelligence-worker, so
suspension was a silent no-op for the product API.

**How to apply / invariants to keep:**
- The **admin surface is deliberately exempt**: admin/monitoring/scheduler/configs
  routers use `requireOperator` (static `ADMIN_INTERNAL_TOKEN` bypasses org
  resolution entirely; session path requires platform-org membership). The two
  cross-namespace endpoints the admin UI calls (`POST /analysis/run`,
  `POST /crawler/trigger`) use `requireAdminToken`. None touch `requireAuth`, so
  suspension cannot lock operators out. Do NOT route admin through `requireAuth`.
- The **platform org cannot be suspended**: `PATCH /orgs/:id/pause` rejects
  `paused=true` for `PLATFORM_ORG_ID` (from lib/tenantScope) with 400; unpause is
  still allowed. This prevents locking every operator out of the authenticated
  surface (platform-org membership gates `requireOperator`'s session path).
- `optionalAuth` (used only by public `/markets`) intentionally does **not** check
  `pausedAt` — markets is anonymous-accessible anyway. Leave as-is unless full
  suspension semantics on the public surface are explicitly requested.
