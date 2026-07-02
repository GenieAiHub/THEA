import { Router } from "express";
import healthV1Router from "./health";
import contentRouter from "./content";
import crawlerRouter from "./crawler";
import trendsRouter from "./trends";
import analysisRouter from "./analysis";
import watchlistRouter from "./watchlist";
import alertsRouter from "./alerts";
import reportsRouter from "./reports";
import intelligenceRouter from "./intelligence";
import webhooksRouter from "./webhooks";
import adminRouter from "./admin";
import adminConfigsRouter from "./admin_configs";
import marketsRouter from "./markets";
import adminMarketsRouter from "./admin_markets";

const router = Router();

router.use("/health", healthV1Router);
router.use("/content", contentRouter);
router.use("/crawler", crawlerRouter);
router.use("/trends", trendsRouter);
router.use("/analysis", analysisRouter);
router.use("/watchlist", watchlistRouter);
router.use("/alerts", alertsRouter);
router.use("/reports", reportsRouter);
router.use("/intelligence", intelligenceRouter);
router.use("/webhooks", webhooksRouter);
router.use("/markets", marketsRouter);
router.use("/admin", adminMarketsRouter);
router.use("/admin", adminRouter);
router.use("/admin/configs", adminConfigsRouter);

export default router;
