import { createRequire } from "module";
import { mkdirSync } from "fs";

const require = createRequire("/home/runner/workspace/artifacts/api-server/index.js");
const { chromium } = require("playwright");

const BASE = "http://localhost:80";
const OUT = "/home/runner/workspace/exports/brochure/shots";
mkdirSync(OUT, { recursive: true });

const email = `demo-brochure-${Date.now()}-${Math.floor(Math.random() * 1e6)}@thea.quest`;
const password = "ThEa-Demo-2026!";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN,
});

async function shoot(ctx, url, file, { wait = 2500, click = null, extraWait = 1800 } = {}) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(wait);
    if (click) {
      await page.click(click, { timeout: 5000 }).catch((e) => console.log(`  click fail ${click}: ${e.message.split("\n")[0]}`));
      await page.waitForTimeout(extraWait);
    }
    await page.screenshot({ path: `${OUT}/${file}`, type: "jpeg", quality: 90 });
    console.log(`OK  ${file}  <- ${url}${click ? " +click " + click : ""}`);
  } catch (e) {
    console.log(`FAIL ${file}: ${e.message.split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

const stage = process.argv[2] || "public";

if (stage === "public") {
  const pub = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  await shoot(pub, `${BASE}/`, "website-home.jpg", { wait: 4000 });
  await shoot(pub, `${BASE}/pricing`, "website-pricing.jpg");
  await shoot(pub, `${BASE}/how-it-works`, "website-how.jpg");
  await shoot(pub, `${BASE}/markets/`, "markets-home.jpg", { wait: 4000 });
  await shoot(pub, `${BASE}/admin/`, "admin-login.jpg");
  await pub.close();
}

if (stage === "authed1" || stage === "authed2") {
  const authed = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const api = authed.request;
  const reg = await api.post(`${BASE}/api/v1/auth/register`, {
    data: { email, password, name: "THEA Demo" },
  });
  console.log("register:", reg.status());
  if (reg.ok()) {
    const step = async (path, data) => {
      const r = await api.post(`${BASE}/api/v1/onboarding/${path}`, { data });
      console.log(`onboarding/${path}:`, r.status(), r.ok() ? "" : await r.text());
    };
    await step("focus", { focus: "business" });
    await step("categories", { categories: ["Politics", "News", "Technology", "Media", "Branding"] });
    await step("keywords", { keywords: ["THEA", "reputation", "crisis"] });
    await step("notifications", { email, digestFrequency: "daily" });
    await step("complete", {});

    if (stage === "authed1") {
      await shoot(authed, `${BASE}/dashboard`, "portal-dashboard.jpg", { wait: 4500 });
      await shoot(authed, `${BASE}/trends`, "portal-trends.jpg", { wait: 4000 });
      await shoot(authed, `${BASE}/alerts`, "portal-alerts.jpg", { wait: 3500 });
    } else {
      await shoot(authed, `${BASE}/ai-tools`, "portal-ai-tools.jpg", { wait: 3500 });
      await shoot(authed, `${BASE}/data-explorer`, "portal-data-explorer.jpg", { wait: 4000 });
      await shoot(authed, `${BASE}/simulation`, "portal-simulation.jpg", { wait: 3500 });
      await shoot(authed, `${BASE}/competitors`, "portal-competitors.jpg", { wait: 3500 });
    }
  }
  await authed.close();
}

if (stage === "mobile") {
  const mob = await browser.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
  });
  await shoot(mob, `${BASE}/access-pwa/`, "access-login.jpg", { wait: 3000 });
  await shoot(mob, `${BASE}/access-pwa/`, "access-install-dialog.jpg", {
    wait: 3000,
    click: '[data-testid="button-download-app"]',
    extraWait: 1500,
  });
  await mob.close();
}

await browser.close();
console.log("DONE", stage);
