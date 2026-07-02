import { eq, or } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * The THEA platform organisation ID.
 * Platform-generated content (auto markets, trend scores seeded by crawlers, etc.)
 * is owned by this org and is visible to every tenant alongside their own data.
 */
export const PLATFORM_ORG_ID = "10000000-0000-0000-0000-000000000001";

/**
 * Returns an OR filter that includes rows belonging to the user's org
 * AND rows belonging to the platform org (shared/platform content).
 *
 * Use for READ queries on tables that mix platform content with per-org data.
 *
 * @example
 * .where(tenantOr(predictionMarketsTable.orgId, req.thea!.org.id))
 */
export function tenantOr(orgIdColumn: AnyPgColumn, userOrgId: string) {
  return or(eq(orgIdColumn, PLATFORM_ORG_ID), eq(orgIdColumn, userOrgId))!;
}

/**
 * Returns an exact-match filter for a single org.
 *
 * Use for WRITE queries (insert/update/delete) to ensure mutations never
 * cross tenant boundaries.
 *
 * @example
 * .where(tenantEq(alertsTable.orgId, req.thea!.org.id))
 */
export function tenantEq(orgIdColumn: AnyPgColumn, userOrgId: string) {
  return eq(orgIdColumn, userOrgId);
}
