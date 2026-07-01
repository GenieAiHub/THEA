import { Router } from "express";

const router = Router();

router.post("/talking-points", async (_req, res) => {
  res.status(501).json({ message: "Talking points generator will be available in Phase 6" });
});

router.post("/draft-statement", async (_req, res) => {
  res.status(501).json({ message: "Statement drafter will be available in Phase 6" });
});

router.post("/simulate", async (_req, res) => {
  res.status(501).json({ message: "What-If simulator will be available in Phase 5" });
});

router.post("/test-message", async (_req, res) => {
  res.status(501).json({ message: "Message resonance testing will be available in Phase 6" });
});

export default router;
