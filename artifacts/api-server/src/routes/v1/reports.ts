import { Router } from "express";
import { db } from "@workspace/db";
import { trendScoresTable, analysisReportsTable, alertsTable, organizationsTable } from "@workspace/db/schema";
import { eq, desc, gte, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireFeature } from "../../middlewares/featureGate";
import PDFDocument from "pdfkit";
import pptxgen from "pptxgenjs";

const router = Router();
router.use(requireAuth);

async function getReportData(orgId: string, category?: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const trendConditions: ReturnType<typeof eq>[] = [eq(trendScoresTable.orgId, orgId as any), gte(trendScoresTable.scoredAt, since) as any];
  if (category) trendConditions.push(eq(trendScoresTable.category, category) as any);

  const [org, trends, latestReports, recentAlerts] = await Promise.all([
    db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1),
    db.select().from(trendScoresTable).where(and(...trendConditions as any[])).orderBy(desc(trendScoresTable.score)).limit(20),
    db.select().from(analysisReportsTable)
      .where(category ? and(eq(analysisReportsTable.orgId, orgId as any), eq(analysisReportsTable.category, category) as any) : eq(analysisReportsTable.orgId, orgId as any))
      .orderBy(desc(analysisReportsTable.runAt)).limit(3),
    db.select().from(alertsTable)
      .where(and(eq(alertsTable.orgId, orgId), gte(alertsTable.createdAt, since) as any))
      .orderBy(desc(alertsTable.createdAt)).limit(5),
  ]);
  return { org: org[0], trends, report: latestReports[0], alerts: recentAlerts };
}

/**
 * POST /api/v1/reports/pdf
 * Generate a white-label PDF trend report for the org.
 */
router.post("/pdf", requireRole("owner", "admin"), requireFeature("pdf_export"), async (req, res) => {
  const { category } = req.body as { category?: string };
  const orgId = req.thea!.org.id;

  try {
    const { org, trends, report, alerts } = await getReportData(orgId, category);
    const brandColor = org?.brandColor ?? "#6366f1";
    const orgName = org?.name ?? "Organisation";
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));

    // ── Cover ─────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 200).fill(brandColor);
    doc.fillColor("white").fontSize(28).font("Helvetica-Bold")
      .text("THEA Intelligence Report", 50, 70);
    doc.fontSize(16).font("Helvetica").text(orgName, 50, 112);
    doc.fontSize(12).opacity(0.85)
      .text(category ? `Category: ${category}` : "All Categories", 50, 136)
      .text(`Generated: ${dateStr}`, 50, 154);
    doc.fillColor("black").opacity(1);

    // ── Executive Summary ──────────────────────────────────────────────────────
    doc.moveDown(4);
    const summaryY = 240;
    doc.fontSize(18).font("Helvetica-Bold").fillColor(brandColor).text("Executive Summary", 50, summaryY);
    doc.moveTo(50, summaryY + 24).lineTo(545, summaryY + 24).strokeColor(brandColor).stroke();
    doc.fontSize(11).font("Helvetica").fillColor("black")
      .text(report?.narrativeSummary ?? "No analysis report available yet. Run a MiroFish analysis to generate insights.", 50, summaryY + 34, { width: 495, lineGap: 3 });

    // ── Trend Leaderboard ──────────────────────────────────────────────────────
    const trendY = doc.y + 28;
    doc.fontSize(18).font("Helvetica-Bold").fillColor(brandColor).text("Trend Leaderboard", 50, trendY);
    doc.moveTo(50, trendY + 24).lineTo(545, trendY + 24).strokeColor(brandColor).stroke();

    let rowY = trendY + 36;
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#333")
      .text("Rank", 50, rowY).text("Topic", 90, rowY).text("Category", 320, rowY).text("Score", 475, rowY);
    rowY += 18;

    trends.slice(0, 12).forEach((t, i) => {
      const rowBg = i % 2 === 0 ? "#f8fafc" : "#ffffff";
      doc.rect(50, rowY - 3, 495, 20).fill(rowBg);
      doc.fontSize(10).font("Helvetica").fillColor("black")
        .text(String(i + 1), 50, rowY)
        .text(t.topic.slice(0, 38), 90, rowY, { width: 222 })
        .text(t.category, 320, rowY, { width: 140 })
        .text(String(Math.round(t.score)), 475, rowY);
      rowY += 20;
      if (rowY > doc.page.height - 100) { doc.addPage(); rowY = 60; }
    });

    // ── Alerts ─────────────────────────────────────────────────────────────────
    if (alerts.length > 0) {
      doc.addPage();
      doc.fontSize(18).font("Helvetica-Bold").fillColor(brandColor).text("Recent Alerts", 50, 50);
      doc.moveTo(50, 74).lineTo(545, 74).strokeColor(brandColor).stroke();
      let aY = 88;
      alerts.forEach((alert) => {
        const sColor = alert.severity === "critical" ? "#e53e3e" : alert.severity === "high" ? "#dd6b20" : "#3182ce";
        doc.fontSize(11).font("Helvetica-Bold").fillColor(sColor)
          .text(`[${(alert.severity ?? "medium").toUpperCase()}]  ${alert.keyword}`, 50, aY);
        doc.fontSize(10).font("Helvetica").fillColor("#555")
          .text(`Spike ratio: ${alert.spikeRatio?.toFixed(1) ?? "N/A"}×  |  Crisis probability: ${alert.crisisProbability ?? "N/A"}%  |  ${new Date(alert.createdAt).toLocaleDateString()}`, 50, aY + 14);
        aY += 42;
      });
    }

    // ── Footer on every page ───────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(9).fillColor("#999")
        .text(`Powered by THEA Intelligence  ·  ${orgName}  ·  Page ${i + 1} of ${range.count}`, 50, doc.page.height - 38, { align: "center", width: 495 });
    }

    doc.end();
    await new Promise<void>((resolve) => doc.on("end", resolve));

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="thea-report-${Date.now()}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: "PDF generation failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /api/v1/reports/pptx
 * Generate a white-label PowerPoint slide deck.
 */
router.post("/pptx", requireRole("owner", "admin"), requireFeature("pptx_export"), async (req, res) => {
  const { category } = req.body as { category?: string };
  const orgId = req.thea!.org.id;

  try {
    const { org, trends, report } = await getReportData(orgId, category);
    const rawColor = (org?.brandColor ?? "#6366f1").replace("#", "");
    const orgName = org?.name ?? "Organisation";
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const prs = new pptxgen();
    prs.layout = "LAYOUT_WIDE";
    prs.author = "THEA Intelligence";
    prs.company = orgName;

    // ── Slide 1: Cover ─────────────────────────────────────────────────────────
    const cover = prs.addSlide();
    cover.background = { color: rawColor };
    cover.addText("THEA Intelligence Report", { x: 0.5, y: 1.4, w: 12.3, h: 1.2, fontSize: 40, bold: true, color: "FFFFFF", align: "left" });
    cover.addText(orgName, { x: 0.5, y: 2.8, w: 12.3, h: 0.7, fontSize: 26, color: "FFFFFF", align: "left" });
    cover.addText(`${category ? `Category: ${category}  |  ` : ""}Generated: ${dateStr}`, { x: 0.5, y: 3.65, w: 12.3, h: 0.5, fontSize: 16, color: "FFFFFF", align: "left" });

    // ── Slide 2: Executive Summary ─────────────────────────────────────────────
    const sumSlide = prs.addSlide();
    sumSlide.addText("Executive Summary", { x: 0.4, y: 0.25, w: 12.5, h: 0.65, fontSize: 28, bold: true, color: rawColor });
    sumSlide.addShape(prs.ShapeType.rect, { x: 0.4, y: 1.05, w: 12.5, h: 0.05, fill: { color: rawColor } });
    sumSlide.addText(report?.narrativeSummary ?? "No analysis report available yet. Run a MiroFish analysis to generate insights.", {
      x: 0.4, y: 1.2, w: 12.5, h: 5.2, fontSize: 15, color: "363636", valign: "top", wrap: true,
    });

    // ── Slide 3: Trend Leaderboard ─────────────────────────────────────────────
    const trendSlide = prs.addSlide();
    trendSlide.addText("Top Trend Movements", { x: 0.4, y: 0.25, w: 12.5, h: 0.65, fontSize: 28, bold: true, color: rawColor });
    trendSlide.addShape(prs.ShapeType.rect, { x: 0.4, y: 1.05, w: 12.5, h: 0.05, fill: { color: rawColor } });

    const headerOpts = (txt: string): pptxgen.TableCell => ({
      text: txt,
      options: { bold: true, color: "FFFFFF", fill: { color: rawColor }, align: "left", fontSize: 12 },
    });

    const rows: pptxgen.TableRow[] = [
      [headerOpts("#"), headerOpts("Topic"), headerOpts("Category"), headerOpts("Score"), headerOpts("Stage")],
      ...trends.slice(0, 10).map((t, i): pptxgen.TableRow => {
        const bg = { color: i % 2 === 0 ? "F1F5F9" : "FFFFFF" };
        return [
          { text: String(i + 1), options: { fill: bg, fontSize: 11 } },
          { text: t.topic, options: { fill: bg, fontSize: 11 } },
          { text: t.category, options: { fill: bg, fontSize: 11 } },
          { text: String(Math.round(t.score)), options: { fill: bg, bold: true, fontSize: 11 } },
          { text: t.lifecycleStage ?? "emerging", options: { fill: bg, fontSize: 11 } },
        ];
      }),
    ];

    trendSlide.addTable(rows, {
      x: 0.4, y: 1.2, w: 12.5,
      colW: [0.6, 4.5, 2.8, 1.8, 2.4],
      border: { type: "solid", color: "E2E8F0", pt: 0.5 },
    });

    // ── Slide 4: Appendix / Data Sources ──────────────────────────────────────
    const appendix = prs.addSlide();
    appendix.addText("Data Sources & Methodology", { x: 0.4, y: 0.25, w: 12.5, h: 0.65, fontSize: 28, bold: true, color: rawColor });
    appendix.addShape(prs.ShapeType.rect, { x: 0.4, y: 1.05, w: 12.5, h: 0.05, fill: { color: rawColor } });
    appendix.addText(
      "Data collected via THEA's ingestion pipeline: RSS feeds, social media (Twitter/X, Reddit, YouTube), news APIs (Bing News, NewsAPI, MediaStack), DuckDuckGo/Brave web search, and web crawlers.\n\nTrend scoring uses THEA's proprietary weighted algorithm combining mention frequency, velocity, engagement, sentiment consensus, and source diversity.\n\nMiroFish AI analysis uses large language models (GPT-4 / Gemini) to synthesise narrative insights from collected content.\n\nAll data is processed in real-time with hourly trend recalculation.",
      { x: 0.4, y: 1.3, w: 12.5, h: 5, fontSize: 14, color: "475569", valign: "top", wrap: true, paraSpaceAfter: 12 },
    );

    const pptxBuffer = (await prs.write({ outputType: "nodebuffer" })) as unknown as Buffer;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="thea-report-${Date.now()}.pptx"`);
    res.setHeader("Content-Length", String(pptxBuffer.length));
    res.send(pptxBuffer);
  } catch (err) {
    res.status(500).json({ error: "PPTX generation failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
