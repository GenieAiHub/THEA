import { type Request, type Response, type NextFunction } from "express";
import { resolveOrgContext, getUserByToken } from "./auth";
import { readSessionCookie } from "../lib/auth";
import { PLATFORM_ORG_ID } from "../lib/tenantScope";

const ADMIN_TOKEN = process.env.ADMIN_INTERNAL_TOKEN;

/**
 * Dual-path operator authentication:
 *   Path 1 — server-to-server: `x-admin-token` or `Authorization: Bearer <ADMIN_INTERNAL_TOKEN>`
 *   Path 2 — session cookie: valid session where the user belongs to the platform org with
 *             role "owner" or "admin". This is the preferred human-facing auth path.
 */
export async function requireOperator(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Path 1: static internal token (server-to-server / CI / scripts)
  const provided =
    (req.headers["x-admin-token"] as string | undefined) ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (ADMIN_TOKEN && provided === ADMIN_TOKEN) {
    next();
    return;
  }

  // Path 2: session cookie — must belong to PLATFORM org with owner or admin role
  const token = readSessionCookie(req);
  if (token) {
    try {
      const user = await getUserByToken(token);
      if (user) {
        const context = await resolveOrgContext(user);
        if (
          context &&
          context.org.id === PLATFORM_ORG_ID &&
          ["owner", "admin"].includes(context.user.role)
        ) {
          req.thea = context;
          next();
          return;
        }
        res.status(403).json({ error: "Operator role required (platform org owner or admin)" });
        return;
      }
    } catch {
      res.status(500).json({ error: "Failed to verify operator identity" });
      return;
    }
  }

  res.status(401).json({ error: "Invalid or missing admin token or session" });
}
