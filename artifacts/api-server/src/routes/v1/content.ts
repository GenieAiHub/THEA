import { Router } from "express";
import { db } from "@workspace/db";
import { contentItemsTable } from "@workspace/db/schema";
import { desc, eq, and, gte, lte, like } from "drizzle-orm";
import { requireAuth } from "../../middlewares/clerkAuth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const {
    platform,
    category,
    language,
    startDate,
    endDate,
    search,
    page = "1",
    limit = "50",
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;
  const orgId = req.thea!.org.id;

  const conditions = [eq(contentItemsTable.orgId, orgId)];
  if (platform) conditions.push(eq(contentItemsTable.platform, platform));
  if (category) conditions.push(eq(contentItemsTable.category, category));
  if (language) conditions.push(eq(contentItemsTable.language, language));
  if (startDate) conditions.push(gte(contentItemsTable.collectedAt, new Date(startDate)));
  if (endDate) conditions.push(lte(contentItemsTable.collectedAt, new Date(endDate)));
  if (search) conditions.push(like(contentItemsTable.body, `%${search}%`));

  const items = await db
    .select()
    .from(contentItemsTable)
    .where(and(...conditions))
    .orderBy(desc(contentItemsTable.collectedAt))
    .limit(limitNum)
    .offset(offset);

  res.json({
    data: items,
    pagination: { page: pageNum, limit: limitNum, offset },
  });
});

router.get("/:id", async (req, res) => {
  const item = await db
    .select()
    .from(contentItemsTable)
    .where(and(eq(contentItemsTable.id, req.params.id as string), eq(contentItemsTable.orgId, req.thea!.org.id)))
    .limit(1);

  if (!item.length) {
    res.status(404).json({ error: "Content item not found" });
    return;
  }
  res.json(item[0]);
});

export default router;
