import { Router } from "express";
import { getTopEntities } from "../../lib/analysis/entity-tracker";
import { requireAuth } from "../../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { category, timeframe = "24h", limit = "20", type } = req.query as Record<string, string>;
  const hoursMap: Record<string, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720 };
  const windowHours = hoursMap[timeframe] ?? 24;
  const orgId = req.thea!.org.id;

  let entities = await getTopEntities(windowHours, orgId, category, parseInt(limit, 10));
  if (type) entities = entities.filter((e) => e.entityType === type);

  res.json({
    data: entities,
    timeframe,
    windowHours,
    category: category ?? "all",
  });
});

router.get("/types", (_req, res) => {
  res.json({ data: ["person", "org", "location", "topic"] });
});

export default router;
