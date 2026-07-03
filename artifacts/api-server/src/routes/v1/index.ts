import { Router, type Request, type Response, type NextFunction } from "express";
import { apiKeyRateLimiter } from "../../middlewares/rateLimiter";
import healthV1Router from "./health";
import authRouter from "./auth";
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
import adminMonitoringRouter from "./admin_monitoring";
import adminSchedulerRouter from "./admin_scheduler";
import marketsRouter from "./markets";
import adminMarketsRouter from "./admin_markets";
import entitiesRouter from "./entities";
import billingRouter from "./billing";
import onboardingRouter from "./onboarding";
import settingsRouter from "./settings";
import geoRouter from "./geo";
import campaignsRouter from "./campaigns";
import apiKeysRouter from "./api-keys";
import membersRouter from "./members";
import accessRouter from "./access";

const router = Router();

// Apply API-key rate limit (1000 req/day per key) only when Bearer thea_ token is present.
// Session-cookie requests are already covered by the global defaultRateLimiter.
router.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.headers.authorization?.startsWith("Bearer thea_")) {
    void apiKeyRateLimiter(req, res, next);
  } else {
    next();
  }
});

router.use("/health", healthV1Router);
router.use("/auth", authRouter);
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
router.use("/admin", adminMonitoringRouter);
router.use("/admin", adminSchedulerRouter);
router.use("/admin", adminRouter);
router.use("/admin/configs", adminConfigsRouter);
router.use("/entities", entitiesRouter);
router.use("/billing", billingRouter);
router.use("/onboarding", onboardingRouter);
router.use("/settings", settingsRouter);
router.use("/geo", geoRouter);
router.use("/campaigns", campaignsRouter);
router.use("/api-keys", apiKeysRouter);
router.use("/members", membersRouter);
router.use("/access", accessRouter);

export default router;
