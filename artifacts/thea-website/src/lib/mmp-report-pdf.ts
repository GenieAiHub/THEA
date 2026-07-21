import type { TDocumentDefinitions, Content, ContentTable, TableCell } from "pdfmake/interfaces";
import {
  MARKET_STATS,
  MARKET_TRENDS,
  MARKET_PROJECTION,
  APPSFLYER_PRODUCTS,
  COMPETITORS,
  SERVICE_CATALOGUE,
  DEMAND_TIER_LABELS,
  MARKET_GAPS,
  GAP_TIER_LABELS,
  COST_CATEGORIES,
  COST_TIER_ESTIMATES,
  RECOMMENDATIONS,
  type GapTier,
} from "@/content/mmp-report";

const GOLD = "#b8952e";
const DARK = "#0f172a";
const SLATE = "#475569";
const LIGHT_ROW = "#f8fafc";
const BORDER = "#e2e8f0";

function sectionHeader(num: string, title: string): Content {
  return {
    stack: [
      { text: `SECTION ${num}`, fontSize: 8, color: GOLD, characterSpacing: 1.5, bold: true, margin: [0, 0, 0, 3] },
      { text: title, fontSize: 18, bold: true, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 1.5, lineColor: GOLD }], margin: [0, 2, 0, 12] },
    ],
    margin: [0, 0, 0, 0],
  };
}

function tableLayout() {
  return {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => BORDER,
    vLineColor: () => BORDER,
    fillColor: (rowIndex: number) => (rowIndex === 0 ? DARK : rowIndex % 2 === 0 ? LIGHT_ROW : null),
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 4,
    paddingBottom: () => 4,
  };
}

function th(text: string): Content {
  return { text, bold: true, color: "white", fontSize: 8.5 };
}

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

const TIER_COLORS: Record<GapTier, string> = {
  hot: "#dc2626",
  warm: "#d97706",
  future: "#2563eb",
};

export function buildMmpReportDocDefinition(): TDocumentDefinitions {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const cover: Content = {
    stack: [
      { text: "INTERNAL BRIEFING — CONFIDENTIAL", fontSize: 9, color: "#dc2626", bold: true, characterSpacing: 2, margin: [0, 160, 0, 18] },
      { text: "MMP Competitive Landscape", fontSize: 30, bold: true, color: DARK },
      { text: "& Gap Analysis", fontSize: 30, bold: true, color: GOLD, margin: [0, 0, 0, 20] },
      {
        text: "A definitive assessment of the mobile measurement partner ecosystem, identifying vulnerable incumbents and high-value product opportunities for immediate development.",
        fontSize: 11,
        color: SLATE,
        lineHeight: 1.4,
        margin: [0, 0, 60, 30],
      },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 2, lineColor: GOLD }], margin: [0, 0, 0, 14] },
      { text: `Project Navigator  ·  Generated ${dateStr}`, fontSize: 9, color: SLATE },
    ],
    pageBreak: "after",
  };

  // ── Section 1: Market Overview ──
  const overview: Content[] = [
    sectionHeader("01", "Market Overview"),
    {
      table: {
        widths: ["*", "*", "*", "*"],
        body: [
          MARKET_STATS.map((s): TableCell => ({
            stack: [
              { text: s.value, fontSize: 16, bold: true, color: DARK },
              { text: s.label, fontSize: 8, color: GOLD, bold: true, margin: [0, 2, 0, 2] },
              { text: s.detail, fontSize: 7.5, color: SLATE },
            ],
          })),
        ],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        fillColor: () => LIGHT_ROW,
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 0, 0, 14],
    },
    { text: "Macro Trends Shaping the Market", fontSize: 12, bold: true, color: DARK, margin: [0, 4, 0, 8] },
    ...MARKET_TRENDS.map(
      (t, i): Content => ({
        stack: [
          { text: `0${i + 1}  ${t.title}`, fontSize: 10, bold: true, color: DARK, margin: [0, 0, 0, 2] },
          { text: t.description, fontSize: 9, color: SLATE, lineHeight: 1.3, margin: [16, 0, 0, 8] },
        ],
      }),
    ),
    { text: "Market Projection (12.65% CAGR)", fontSize: 12, bold: true, color: DARK, margin: [0, 6, 0, 8] },
    {
      table: {
        widths: ["*", "*"],
        body: [
          [th("Year"), th("Market size (USD billions)")],
          ...MARKET_PROJECTION.map((p): TableCell[] => [
            { text: String(p.year), fontSize: 9 },
            { text: `$${p.valueBillions.toFixed(2)}B`, fontSize: 9, bold: true },
          ]),
        ],
      },
      layout: tableLayout(),
    },
  ];

  // ── Section 2: AppsFlyer Product Suite ──
  const appsflyer: Content[] = [
    sectionHeader("02", "AppsFlyer Product Suite"),
    {
      table: {
        headerRows: 1,
        widths: [95, "*", 130, 55],
        body: [
          [th("Product"), th("What it does"), th("Benefit"), th("Uniqueness")],
          ...APPSFLYER_PRODUCTS.map((p): TableCell[] => [
            { text: p.name, fontSize: 8.5, bold: true, color: DARK },
            { text: p.whatItDoes, fontSize: 8, color: SLATE },
            { text: p.benefit, fontSize: 8, color: SLATE },
            { text: `${p.uniqueness}/10`, fontSize: 8.5, bold: true, color: p.uniqueness >= 7 ? GOLD : SLATE, alignment: "center" },
          ]),
        ],
      },
      layout: tableLayout(),
    } satisfies ContentTable,
  ];

  // ── Section 3: Competitor Matrix ──
  const competitors: Content[] = [
    sectionHeader("03", "Competitor Matrix"),
    ...COMPETITORS.map(
      (c): Content => ({
        unbreakable: true,
        stack: [
          { text: c.name, fontSize: 12, bold: true, color: DARK, margin: [0, 0, 0, 1] },
          { text: c.focus, fontSize: 8.5, italics: true, color: GOLD, margin: [0, 0, 0, 5] },
          {
            columns: [
              {
                width: "*",
                stack: [
                  { text: "Strengths", fontSize: 8, bold: true, color: "#16a34a", margin: [0, 0, 0, 2] },
                  { ul: c.strengths.map((s) => ({ text: s, fontSize: 8, color: SLATE, lineHeight: 1.25 })), markerColor: "#16a34a" },
                ],
              },
              {
                width: "*",
                stack: [
                  { text: "Weaknesses", fontSize: 8, bold: true, color: "#dc2626", margin: [0, 0, 0, 2] },
                  { ul: c.weaknesses.map((w) => ({ text: w, fontSize: 8, color: SLATE, lineHeight: 1.25 })), markerColor: "#dc2626" },
                ],
              },
            ],
            columnGap: 16,
          },
        ],
        margin: [0, 0, 0, 12],
      }),
    ),
  ];

  // ── Section 4: Service Catalogue ──
  const services: Content[] = [
    sectionHeader("04", `Full Service Catalogue (${SERVICE_CATALOGUE.length} services)`),
    {
      table: {
        headerRows: 1,
        widths: [110, 62, "*", 55],
        body: [
          [th("Service"), th("Demand"), th("Description & key driver"), th("Vendors")],
          ...SERVICE_CATALOGUE.map((s): TableCell[] => [
            { text: s.name, fontSize: 8, bold: true, color: DARK },
            {
              text: DEMAND_TIER_LABELS[s.demand],
              fontSize: 7.5,
              bold: true,
              color: s.demand === "high" ? "#dc2626" : s.demand === "emerging" ? "#d97706" : "#2563eb",
            },
            {
              stack: [
                { text: s.description, fontSize: 8, color: SLATE },
                { text: `Driver: ${s.keyDriver}`, fontSize: 7, italics: true, color: "#94a3b8", margin: [0, 1, 0, 0] },
              ],
            },
            { text: `${s.offeredBy.length} of 9`, fontSize: 8, alignment: "center", color: SLATE },
          ]),
        ],
      },
      layout: tableLayout(),
    },
  ];

  // ── Section 5: Market Gaps ──
  const gaps: Content[] = [
    sectionHeader("05", `Market Gaps — ${MARKET_GAPS.length} Opportunities, Priority-Ranked`),
    ...MARKET_GAPS.map(
      (g): Content => ({
        unbreakable: true,
        stack: [
          {
            columns: [
              { text: `#${g.priority}  ${g.name}`, fontSize: 11, bold: true, color: DARK, width: "*" },
              { text: GAP_TIER_LABELS[g.tier].toUpperCase(), fontSize: 7.5, bold: true, color: TIER_COLORS[g.tier], alignment: "right", width: "auto", margin: [0, 2, 0, 0] },
            ],
            margin: [0, 0, 0, 4],
          },
          { text: [{ text: "What's missing:  ", bold: true, color: DARK }, { text: g.whatsMissing, color: SLATE }], fontSize: 8.5, lineHeight: 1.25, margin: [0, 0, 0, 3] },
          { text: [{ text: "What to build:  ", bold: true, color: DARK }, { text: g.whatToBuild, color: SLATE }], fontSize: 8.5, lineHeight: 1.25, margin: [0, 0, 0, 3] },
          { text: [{ text: "Clients:  ", bold: true, color: DARK }, { text: g.clients, color: SLATE }], fontSize: 8.5, margin: [0, 0, 0, 3] },
          {
            columns: [
              { text: [{ text: "Difficulty:  ", bold: true, color: DARK }, { text: stars(g.difficulty), color: GOLD }], fontSize: 8.5, width: "auto" },
              { text: [{ text: "Revenue:  ", bold: true, color: DARK }, { text: g.revenueModel, color: SLATE }], fontSize: 8.5, width: "*", margin: [16, 0, 0, 0] },
            ],
          },
          ...(g.aiCost
            ? [{ text: [{ text: "AI cost:  ", bold: true, color: DARK }, { text: g.aiCost, color: SLATE }], fontSize: 8.5, margin: [0, 3, 0, 0] } as Content]
            : []),
          ...(g.whyRanked
            ? [{ text: [{ text: "Why ranked here:  ", bold: true, color: GOLD }, { text: g.whyRanked, color: SLATE, italics: true }], fontSize: 8.5, margin: [0, 3, 0, 0] } as Content]
            : []),
        ],
        margin: [0, 0, 0, 14],
      }),
    ),
  ];

  // ── Section 6: AI Cost Model ──
  const costs: Content[] = [
    sectionHeader("06", "Third-Party AI Cost Model"),
    {
      table: {
        headerRows: 1,
        widths: [150, "*", 130],
        body: [
          [th("Cost category"), th("Used for"), th("Unit pricing")],
          ...COST_CATEGORIES.map((c): TableCell[] => [
            { text: c.name, fontSize: 8, bold: true, color: DARK },
            { text: c.usedFor, fontSize: 8, color: SLATE },
            { text: c.unitPricing, fontSize: 8, color: SLATE },
          ]),
        ],
      },
      layout: tableLayout(),
      margin: [0, 0, 0, 14],
    },
    { text: "Monthly Cost Estimates by Scale", fontSize: 12, bold: true, color: DARK, margin: [0, 4, 0, 8] },
    {
      table: {
        headerRows: 1,
        widths: ["auto", "auto", "*", "*", "*", "*", "auto"],
        body: [
          [th("Tier"), th("Customers"), th("LLM"), th("ML"), th("Infra"), th("Data licenses"), th("Total / month")],
          ...COST_TIER_ESTIMATES.map((t): TableCell[] => [
            { text: t.tier, fontSize: 8.5, bold: true, color: DARK },
            { text: t.customers, fontSize: 8, color: SLATE },
            { text: t.llmCosts, fontSize: 8, color: SLATE },
            { text: t.mlCosts, fontSize: 8, color: SLATE },
            { text: t.infraCosts, fontSize: 8, color: SLATE },
            { text: t.dataLicenses, fontSize: 8, color: SLATE },
            { text: t.totalMonthly, fontSize: 8.5, bold: true, color: GOLD },
          ]),
        ],
      },
      layout: tableLayout(),
    },
  ];

  // ── Section 7: Recommendations ──
  const recommendations: Content[] = [
    sectionHeader("07", "Recommended Starting Point"),
    ...RECOMMENDATIONS.map(
      (r): Content => ({
        unbreakable: true,
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  { text: `${r.rank}.  ${r.name}`, fontSize: 12, bold: true, color: DARK, margin: [0, 0, 0, 3] },
                  { text: `Gap priority #${r.gapPriority}`, fontSize: 7.5, bold: true, color: GOLD, margin: [0, 0, 0, 4] },
                  { text: r.rationale, fontSize: 9, color: SLATE, lineHeight: 1.35 },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i: number) => (i === 0 ? 3 : 0),
          vLineColor: () => GOLD,
          fillColor: () => LIGHT_ROW,
          paddingLeft: () => 12,
          paddingRight: () => 10,
          paddingTop: () => 10,
          paddingBottom: () => 10,
        },
        margin: [0, 0, 0, 12],
      }),
    ),
  ];

  const withBreak = (blocks: Content[]): Content => ({ stack: blocks, pageBreak: "before" });

  return {
    pageSize: "A4",
    pageMargins: [50, 50, 50, 60],
    info: {
      title: "MMP Competitive Landscape & Gap Analysis",
      author: "Project Navigator",
      subject: "Internal briefing — confidential",
    },
    content: [
      cover,
      { stack: overview },
      withBreak(appsflyer),
      withBreak(competitors),
      withBreak(services),
      withBreak(gaps),
      withBreak(costs),
      withBreak(recommendations),
    ],
    footer: (currentPage, pageCount) =>
      currentPage === 1
        ? { text: "" }
        : {
            columns: [
              { text: "CONFIDENTIAL — Project Navigator", fontSize: 7.5, color: "#94a3b8", margin: [50, 0, 0, 0] },
              { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7.5, color: "#94a3b8", alignment: "right", margin: [0, 0, 50, 0] },
            ],
            margin: [0, 20, 0, 0],
          },
    defaultStyle: { font: "Roboto", fontSize: 9, color: DARK },
  };
}

export async function downloadMmpReportPdf(): Promise<void> {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any);
  const dd = buildMmpReportDocDefinition();
  pdfMake.createPdf(dd).download("mmp-competitive-landscape-gap-analysis.pdf");
}
