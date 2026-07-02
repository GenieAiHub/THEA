import { db } from "@workspace/db";
import { organizationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

export const PLATFORM_ORG_ID = "10000000-0000-0000-0000-000000000001";
const PLATFORM_ORG_SLUG = "thea-platform";

export async function ensurePlatformOrg(): Promise<void> {
  try {
    const existing = await db
      .select({ id: organizationsTable.id })
      .from(organizationsTable)
      .where(eq(organizationsTable.slug, PLATFORM_ORG_SLUG))
      .limit(1);

    if (existing.length > 0) return;

    await db
      .insert(organizationsTable)
      .values({
        id: PLATFORM_ORG_ID,
        name: "THEA Platform",
        slug: PLATFORM_ORG_SLUG,
        focus: "general",
      })
      .onConflictDoNothing();

    logger.info("Platform system org seeded");
  } catch (err) {
    logger.warn({ err }, "Failed to seed platform system org — will retry on next startup");
  }
}
