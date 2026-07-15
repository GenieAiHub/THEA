import { createRequire } from "module";

const require = createRequire("/home/runner/workspace/artifacts/api-server/index.js");
const { chromium } = require("playwright");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN,
});
const page = await browser.newPage();
await page.goto("file:///home/runner/workspace/exports/brochure/brochure.html", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
await page.pdf({
  path: "/home/runner/workspace/exports/THEA-Product-Brochure.pdf",
  format: "A4",
  printBackground: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});
await browser.close();
console.log("PDF rendered");
