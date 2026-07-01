import { Router } from "express";
import { db } from "@workspace/db";
import { webhookRegistrationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

const router = Router();

const STUB_ORG_ID = "00000000-0000-0000-0000-000000000001";

router.get("/", async (_req, res) => {
  const webhooks = await db
    .select()
    .from(webhookRegistrationsTable)
    .where(eq(webhookRegistrationsTable.orgId, STUB_ORG_ID));
  res.json({ data: webhooks });
});

router.post("/", async (req, res) => {
  const { url, events = [] } = req.body as { url: string; events: string[] };

  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  const secret = `whsec_${randomBytes(32).toString("hex")}`;

  const [created] = await db
    .insert(webhookRegistrationsTable)
    .values({ orgId: STUB_ORG_ID, url, events, secret })
    .returning();

  res.status(201).json({ ...created, secret });
});

router.delete("/:id", async (req, res) => {
  await db
    .delete(webhookRegistrationsTable)
    .where(eq(webhookRegistrationsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
