import { describe, it, expect } from "vitest";
import { buildMmpReportDocDefinition } from "./mmp-report-pdf";
import {
  MARKET_STATS,
  MARKET_TRENDS,
  MARKET_PROJECTION,
  THEA_PRODUCTS,
  COMPETITORS,
  SERVICE_CATALOGUE,
  MARKET_GAPS,
  COST_CATEGORIES,
  COST_TIER_ESTIMATES,
  RECOMMENDATIONS,
} from "@/content/mmp-report";

const SECTION_TITLES = [
  "Market Overview",
  "THEA Product Suite",
  "Competitor Matrix",
  "Full Service Catalogue",
  "Market Gaps",
  "Third-Party AI Cost Model",
  "Recommended Starting Point",
];

async function renderToBuffer(): Promise<Buffer> {
  const [{ default: pdfMake }, pdfFontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfFonts = (pdfFontsModule as any).default ?? pdfFontsModule;
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any);
  const dd = buildMmpReportDocDefinition();
  return await new Promise<Buffer>((resolve, reject) => {
    try {
      pdfMake.createPdf(dd).getBuffer((buffer: Buffer) => resolve(Buffer.from(buffer)));
    } catch (err) {
      reject(err);
    }
  });
}

describe("MMP report PDF", () => {
  it("data module still exposes non-empty datasets used by the PDF", () => {
    expect(MARKET_STATS.length).toBeGreaterThan(0);
    expect(MARKET_TRENDS.length).toBeGreaterThan(0);
    expect(MARKET_PROJECTION.length).toBeGreaterThan(0);
    expect(THEA_PRODUCTS.length).toBeGreaterThan(0);
    expect(COMPETITORS.length).toBeGreaterThan(0);
    expect(SERVICE_CATALOGUE.length).toBeGreaterThan(0);
    expect(MARKET_GAPS.length).toBeGreaterThan(0);
    expect(COST_CATEGORIES.length).toBeGreaterThan(0);
    expect(COST_TIER_ESTIMATES.length).toBeGreaterThan(0);
    expect(RECOMMENDATIONS.length).toBeGreaterThan(0);
  });

  it("doc definition contains all 7 section headers and key data content", () => {
    const dd = buildMmpReportDocDefinition();
    const serialized = JSON.stringify(dd.content);

    for (const title of SECTION_TITLES) {
      expect(serialized, `missing section "${title}"`).toContain(title);
    }
    for (let i = 1; i <= 7; i++) {
      expect(serialized).toContain(`SECTION 0${i}`);
    }

    // Spot-check that real data (not just headers) made it into the document
    expect(serialized).toContain(MARKET_STATS[0].value);
    expect(serialized).toContain(THEA_PRODUCTS[0].name);
    expect(serialized).toContain(COMPETITORS[0].name);
    expect(serialized).toContain(SERVICE_CATALOGUE[0].name);
    expect(serialized).toContain(MARKET_GAPS[0].name);
    expect(serialized).toContain(COST_CATEGORIES[0].name);
    expect(serialized).toContain(RECOMMENDATIONS[0].name);
    expect(serialized).toContain(String(MARKET_PROJECTION[0].year));
    expect(serialized).toContain(COST_TIER_ESTIMATES[0].totalMonthly);
  });

  it("renders the full doc definition to a valid PDF buffer", async () => {
    const buffer = await renderToBuffer();
    expect(buffer.length).toBeGreaterThan(10_000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-1024).toString("latin1")).toContain("%%EOF");
  }, 60_000);
});
