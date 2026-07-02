import { Router } from "express";
import { requireAuth } from "../../middlewares/clerkAuth";

const router = Router();
router.use(requireAuth);

router.post("/pdf", async (_req, res) => {
  res.status(501).json({ message: "PDF report generation will be available in Phase 8" });
});

router.post("/pptx", async (_req, res) => {
  res.status(501).json({ message: "PPTX export will be available in Phase 8" });
});

export default router;
