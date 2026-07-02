import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireFeature } from "../../middlewares/featureGate";

const router = Router();
router.use(requireAuth);
router.use(requireFeature("developer_api"));

router.get("/", async (req, res) => {
  const keys = await db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      scopes: apiKeysTable.scopes,
      isActive: apiKeysTable.isActive,
      lastUsedAt: apiKeysTable.lastUsedAt,
      expiresAt: apiKeysTable.expiresAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.orgId, req.thea!.org.id))
    .orderBy(apiKeysTable.createdAt);

  res.json({ data: keys });
});

router.post("/", requireRole("owner", "admin"), async (req, res) => {
  const { name, scopes = ["read"], expiresAt } = req.body as {
    name?: string;
    scopes?: string[];
    expiresAt?: string;
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const raw = randomBytes(32).toString("hex");
  const apiKey = `thea_${raw}`;
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const keyPrefix = `thea_${raw.slice(0, 8)}`;

  const [created] = await db
    .insert(apiKeysTable)
    .values({
      orgId: req.thea!.org.id,
      name,
      keyHash,
      keyPrefix,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    })
    .returning({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      scopes: apiKeysTable.scopes,
      createdAt: apiKeysTable.createdAt,
    });

  res.status(201).json({
    data: created,
    key: apiKey,
    message: "Store this API key securely — it will not be shown again.",
  });
});

router.patch("/:id", requireRole("owner", "admin"), async (req, res) => {
  const { name, isActive } = req.body as { name?: string; isActive?: boolean };

  const [updated] = await db
    .update(apiKeysTable)
    .set({
      ...(name !== undefined && { name }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    })
    .where(and(eq(apiKeysTable.id, req.params.id as string), eq(apiKeysTable.orgId, req.thea!.org.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "API key not found" });
    return;
  }
  res.json({ data: { id: updated.id, name: updated.name, isActive: updated.isActive } });
});

router.delete("/:id", requireRole("owner", "admin"), async (req, res) => {
  const [deleted] = await db
    .delete(apiKeysTable)
    .where(and(eq(apiKeysTable.id, req.params.id as string), eq(apiKeysTable.orgId, req.thea!.org.id)))
    .returning({ id: apiKeysTable.id });

  if (!deleted) {
    res.status(404).json({ error: "API key not found" });
    return;
  }
  res.status(204).send();
});

export default router;
