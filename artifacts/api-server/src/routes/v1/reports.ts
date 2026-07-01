import { Router } from "express";

const router = Router();

router.post("/pdf", async (_req, res) => {
  res.status(501).json({ message: "PDF report generation will be available in Phase 8" });
});

router.post("/pptx", async (_req, res) => {
  res.status(501).json({ message: "PPTX export will be available in Phase 8" });
});

export default router;
