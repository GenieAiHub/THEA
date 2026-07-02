import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireFeature } from "../../middlewares/featureGate";

const router = Router();
router.use(requireAuth);

/**
 * Export endpoints are premium features (Pro+ plan) and owner/admin only.
 * Actual PDF/PPTX generation is implemented in Phase 8; these endpoints
 * are registered and auth-gated now so the middleware chain is correct.
 */
router.post("/pdf", requireRole("owner", "admin"), requireFeature("pdf_export"), async (_req, res) => {
  res.status(501).json({ message: "PDF report generation will be available in Phase 8" });
});

router.post("/pptx", requireRole("owner", "admin"), requireFeature("pptx_export"), async (_req, res) => {
  res.status(501).json({ message: "PPTX export will be available in Phase 8" });
});

export default router;
