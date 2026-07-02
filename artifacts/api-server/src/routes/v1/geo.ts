import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import { queryGeoHeatmap } from "../../lib/geoSignals";
import { PLATFORM_ORG_ID } from "../../lib/tenantScope";

const router = Router();
router.use(requireAuth);

// ─── GET /api/v1/geo/heatmap ──────────────────────────────────────────────────
/**
 * Returns geographic heat map data for a topic/keyword.
 * Data is derived from geoCountry/geoRegion fields on collected content items.
 *
 * Query params:
 *   topic       — topic or keyword to query (required)
 *   timeframe   — 1h | 6h | 24h | 7d (default: 24h)
 *   format      — json | geojson (default: json)
 */
router.get("/heatmap", async (req, res) => {
  const { topic, timeframe = "24h", format = "json" } = req.query as Record<string, string | undefined>;

  if (!topic) {
    res.status(400).json({ error: "topic is required" });
    return;
  }

  const hoursMap: Record<string, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };
  const hours = hoursMap[timeframe] ?? 24;

  const orgId = req.thea!.org.id;
  const entries = await queryGeoHeatmap(orgId, topic, hours);

  if (format === "geojson") {
    const features = entries.map((e) => ({
      type: "Feature" as const,
      properties: {
        countryCode: e.countryCode,
        region: e.region,
        intensity: e.intensity,
        mentionCount: e.mentionCount,
        avgSentiment: e.avgSentiment,
      },
      geometry: null,
    }));

    res.json({
      type: "FeatureCollection",
      features,
      meta: { topic, timeframe, generatedAt: new Date().toISOString() },
    });
    return;
  }

  res.json({
    data: entries,
    topic,
    timeframe,
    totalCountries: entries.length,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
