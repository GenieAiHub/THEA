import { Router } from "express";
import { db } from "@workspace/db";
import { organizationsTable, watchlistKeywordsTable, emailPreferencesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/clerkAuth";

const router = Router();
router.use(requireAuth);

const VALID_FOCUSES = ["political", "business", "media", "agency", "general"] as const;
const VALID_CATEGORIES = ["Politics", "News", "Technology", "Society", "Media", "Branding", "Entertainment", "Health", "Sports", "Environment", "Crypto"] as const;

router.get("/status", async (req, res) => {
  const { org, subscription } = req.thea!;
  const completed = !!org.onboardingCompletedAt;

  res.json({
    data: {
      completed,
      completedAt: org.onboardingCompletedAt,
      focus: org.focus,
      tier: subscription.tier,
      maxKeywords: subscription.maxKeywords,
      maxCategories: subscription.maxCategories,
    },
  });
});

router.post("/focus", async (req, res) => {
  const { focus } = req.body as { focus: string };
  if (!focus || !VALID_FOCUSES.includes(focus as any)) {
    res.status(400).json({ error: `focus must be one of: ${VALID_FOCUSES.join(", ")}` });
    return;
  }

  const [updated] = await db
    .update(organizationsTable)
    .set({ focus, updatedAt: new Date() })
    .where(eq(organizationsTable.id, req.thea!.org.id))
    .returning();

  res.json({ data: { focus: updated.focus } });
});

router.post("/categories", async (req, res) => {
  const { categories } = req.body as { categories: string[] };
  const { maxCategories } = req.thea!.subscription;

  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400).json({ error: "categories must be a non-empty array" });
    return;
  }

  const invalid = categories.filter((c) => !VALID_CATEGORIES.includes(c as any));
  if (invalid.length > 0) {
    res.status(400).json({ error: `Invalid categories: ${invalid.join(", ")}. Valid: ${VALID_CATEGORIES.join(", ")}` });
    return;
  }

  if (categories.length > maxCategories) {
    res.status(402).json({ error: `Your plan allows up to ${maxCategories} categories. Upgrade for more.` });
    return;
  }

  res.json({ data: { categories, savedCount: categories.length } });
});

router.post("/keywords", async (req, res) => {
  const { keywords } = req.body as { keywords: string[] };
  const { org, subscription } = req.thea!;

  if (!Array.isArray(keywords) || keywords.length === 0) {
    res.status(400).json({ error: "keywords must be a non-empty array" });
    return;
  }

  const existingCount = await db
    .select()
    .from(watchlistKeywordsTable)
    .where(eq(watchlistKeywordsTable.orgId, org.id));

  if (existingCount.length + keywords.length > subscription.maxKeywords) {
    res.status(402).json({
      error: `Your plan allows up to ${subscription.maxKeywords} keywords. You have ${existingCount.length} — adding ${keywords.length} would exceed the limit.`,
    });
    return;
  }

  const inserted = await db
    .insert(watchlistKeywordsTable)
    .values(keywords.map((kw) => ({ orgId: org.id, keyword: kw })))
    .returning();

  res.status(201).json({ data: inserted });
});

router.post("/notifications", async (req, res) => {
  const { email, digestFrequency = "daily" } = req.body as { email: string; digestFrequency?: string };
  const { org } = req.thea!;

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const VALID_FREQS = ["immediate", "hourly", "daily", "weekly"];
  if (!VALID_FREQS.includes(digestFrequency)) {
    res.status(400).json({ error: `digestFrequency must be one of: ${VALID_FREQS.join(", ")}` });
    return;
  }

  const existing = await db
    .select()
    .from(emailPreferencesTable)
    .where(eq(emailPreferencesTable.orgId, org.id))
    .limit(1);

  if (existing[0]) {
    await db
      .update(emailPreferencesTable)
      .set({ recipients: [email], digestFrequency, updatedAt: new Date() })
      .where(eq(emailPreferencesTable.orgId, org.id));
  } else {
    await db.insert(emailPreferencesTable).values({ orgId: org.id, recipients: [email], digestFrequency });
  }

  res.json({ data: { email, digestFrequency } });
});

router.post("/complete", async (req, res) => {
  const [updated] = await db
    .update(organizationsTable)
    .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizationsTable.id, req.thea!.org.id))
    .returning();

  res.json({ data: { completedAt: updated.onboardingCompletedAt, message: "Onboarding complete! Welcome to THEA." } });
});

export default router;
