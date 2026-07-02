import { Router } from "express";
import { db } from "@workspace/db";
import { webhookRegistrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAuth, requireRole } from "../../middlewares/clerkAuth";
import { requireFeature } from "../../middlewares/featureGate";

const router = Router();
router.use(requireAuth);
router.use(requireFeature("webhooks"));

router.get("/", async (req, res) => {
  const webhooks = await db
    .select()
    .from(webhookRegistrationsTable)
    .where(eq(webhookRegistrationsTable.orgId, req.thea!.org.id));

  res.json({ data: webhooks });
});

router.post("/", requireRole("owner", "admin"), async (req, res) => {
  const { url, events = [] } = req.body as { url: string; events: string[] };

  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  const secret = `whsec_${randomBytes(32).toString("hex")}`;

  const [created] = await db
    .insert(webhookRegistrationsTable)
    .values({ orgId: req.thea!.org.id, url, events, secret })
    .returning();

  res.status(201).json({ ...created, secret });
});

router.delete("/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(webhookRegistrationsTable)
    .where(and(eq(webhookRegistrationsTable.id, req.params.id as string), eq(webhookRegistrationsTable.orgId, req.thea!.org.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }
  res.status(204).send();
});

export default router;
