import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, viewportResults, auditIssues, categoryScores } from "@/lib/db/schema";
import type { AuditIssue, AuditCategory, IssueSeverity } from "@/lib/types";
import {
  groupFindings,
  sortFindingsBySeverity,
  type Finding,
} from "@/lib/audit/findings";

// jspdf-autotable attaches `lastAutoTable` to the doc instance; this is the
// documented way to read where the last table ended.
type AutoTableDoc = { lastAutoTable: { finalY: number } };

const CATEGORY_LABELS: Record<string, string> = {
  accessibility: "Accessibility", responsive: "Responsive", performance: "Performance",
  typography: "Typography", "touch-targets": "Touch Targets", forms: "Forms",
  visual: "Visual", seo: "SEO", "best-practices": "Best Practices",
  security: "Security", "html-quality": "HTML Quality", "css-quality": "CSS Quality",
  "ai-analysis": "AI Analysis",
};

const BRAND: [number, number, number] = [252, 73, 42]; // --primary #fc492a
const INK: [number, number, number] = [27, 26, 31];
const MUTED: [number, number, number] = [120, 120, 128];

function scoreColor(score: number): [number, number, number] {
  if (score >= 90) return [22, 163, 74];
  if (score >= 50) return [217, 119, 6];
  return [220, 38, 38];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const isClient = request.nextUrl.searchParams.get("view") === "client";

  const scan = await db.query.scans.findFirst({ where: eq(scans.id, id) });
  if (!scan || scan.status !== "completed") {
    return NextResponse.json({ error: "Scan not found or not completed" }, { status: 404 });
  }

  const [vpResults, issuesRaw, scores] = await Promise.all([
    db.query.viewportResults.findMany({ where: eq(viewportResults.scanId, id) }),
    db.query.auditIssues.findMany({ where: eq(auditIssues.scanId, id) }),
    db.query.categoryScores.findMany({ where: eq(categoryScores.scanId, id) }),
  ]);

  // Normalise DB rows to the typed AuditIssue shape the grouping layer expects,
  // so the PDF shows the same grouped findings as the on-screen report.
  const issues: AuditIssue[] = issuesRaw.map((i) => ({
    id: i.id,
    category: i.category as AuditCategory,
    severity: i.severity as IssueSeverity,
    ruleId: i.ruleId,
    title: i.title,
    description: i.description,
    elementSelector: i.elementSelector ?? undefined,
    elementHtml: i.elementHtml ?? undefined,
    recommendation: i.recommendation ?? undefined,
    details: (i.details as Record<string, unknown> | null) ?? undefined,
  }));

  const allFindings = groupFindings(issues);

  // Dynamic import jsPDF (it's a large library)
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function addPage() {
    doc.addPage();
    y = margin;
  }
  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - margin) addPage();
  }
  function text(
    str: string,
    x: number,
    yPos: number,
    opts: {
      size?: number;
      style?: "normal" | "bold" | "italic";
      color?: [number, number, number];
      align?: "left" | "center" | "right";
    } = {},
  ) {
    doc.setFontSize(opts.size ?? 10);
    doc.setFont("helvetica", opts.style ?? "normal");
    doc.setTextColor(...(opts.color ?? INK));
    doc.text(str, x, yPos, opts.align ? { align: opts.align } : undefined);
  }

  const hostname = (() => {
    try { return new URL(scan.url).hostname; } catch { return scan.url; }
  })();
  const score = scan.overallScore ?? 0;
  const grade = scan.overallGrade ?? "N/A";

  // ── Header band ────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, 4, "F");
  text("REALSTACK", margin, y + 6, { size: 13, style: "bold", color: BRAND });
  text(
    isClient ? "Website Audit — Client Report" : "Website Audit — Internal Report",
    pageWidth - margin, y + 6, { size: 9, color: MUTED, align: "right" },
  );
  y += 16;

  // ── Title + score ──────────────────────────────
  text(hostname, margin, y, { size: 24, style: "bold" });
  text(scan.url, margin, y + 7, { size: 10, color: MUTED });
  text(
    `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin, y + 12, { size: 9, color: MUTED },
  );

  // Big score + grade, right-aligned
  text(String(score), pageWidth - margin, y + 2, { size: 36, style: "bold", color: scoreColor(score), align: "right" });
  text(`Grade ${grade}  ·  out of 100`, pageWidth - margin, y + 9, { size: 9, color: MUTED, align: "right" });
  y += 22;

  doc.setDrawColor(230, 230, 232);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ── Category score chart (horizontal bars, worst first) ──
  text("Category scores", margin, y, { size: 14, style: "bold" });
  y += 7;

  const sortedScores = [...scores]
    .filter((s) => s.category !== "ai-analysis")
    .sort((a, b) => a.score - b.score);

  const labelW = 40;
  const barX = margin + labelW;
  const barW = contentWidth - labelW - 14;
  const rowH = 7;
  for (const s of sortedScores) {
    checkPageBreak(rowH + 2);
    const label = CATEGORY_LABELS[s.category] ?? s.category;
    text(label, margin, y + 3.5, { size: 9 });
    // track
    doc.setFillColor(238, 238, 240);
    doc.roundedRect(barX, y, barW, 4, 1, 1, "F");
    // fill
    const fillW = Math.max(1, (s.score / 100) * barW);
    doc.setFillColor(...scoreColor(s.score));
    doc.roundedRect(barX, y, fillW, 4, 1, 1, "F");
    text(String(s.score), pageWidth - margin, y + 3.5, { size: 9, style: "bold", align: "right" });
    y += rowH;
  }
  y += 6;

  // ── Findings by category (grouped, worst category first) ──
  const findingsByCategory = new Map<string, Finding[]>();
  for (const f of allFindings) {
    const list = findingsByCategory.get(f.category) ?? [];
    list.push(f);
    findingsByCategory.set(f.category, list);
  }

  // Order categories by their score (lowest/worst first) for triage value.
  const scoreByCategory = new Map(scores.map((s) => [s.category, s.score]));
  const orderedCategories = [...findingsByCategory.keys()].sort(
    (a, b) => (scoreByCategory.get(a) ?? 100) - (scoreByCategory.get(b) ?? 100),
  );

  checkPageBreak(20);
  text("Findings", margin, y, { size: 14, style: "bold" });
  y += 3;

  for (const category of orderedCategories) {
    const findings = sortFindingsBySeverity(findingsByCategory.get(category) ?? []);
    if (findings.length === 0) continue;

    const elementTotal = findings.reduce((n, f) => n + f.count, 0);
    checkPageBreak(18);
    y += 7;
    text(
      `${CATEGORY_LABELS[category] ?? category}  ·  ${findings.length} finding${findings.length === 1 ? "" : "s"} / ${elementTotal} element${elementTotal === 1 ? "" : "s"}`,
      margin, y, { size: 12, style: "bold", color: BRAND },
    );
    y += 3;

    const body = findings.map((f) => {
      // Internal: append affected element selectors under the finding title so
      // the full/raw report keeps element-level traceability. Client: title
      // only (clean). Recommendations are NOT truncated in either mode.
      let findingCell = f.title;
      if (!isClient) {
        const selectors = f.elements
          .map((e) => e.elementSelector)
          .filter((sel): sel is string => !!sel)
          .slice(0, 6);
        if (selectors.length > 0) {
          const more = f.count - selectors.length;
          findingCell +=
            "\n" + selectors.join("\n") + (more > 0 ? `\n…and ${more} more` : "");
        }
      }
      return [
        f.severity.toUpperCase(),
        findingCell,
        `${f.count}`,
        f.recommendation ?? "—",
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Severity", "Finding", "Count", "Recommendation"]],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.2, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontSize: 8 },
      alternateRowStyles: { fillColor: [249, 249, 250] },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: "bold" },
        1: { cellWidth: isClient ? 70 : 78 },
        2: { cellWidth: 12, halign: "right" },
        3: { cellWidth: contentWidth - 18 - (isClient ? 70 : 78) - 12 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const sev = data.cell.raw as string;
          if (sev === "CRITICAL") data.cell.styles.textColor = [220, 38, 38];
          else if (sev === "WARNING") data.cell.styles.textColor = [217, 119, 6];
          else if (sev === "INFO") data.cell.styles.textColor = [37, 99, 235];
        }
        // De-emphasise the appended selector lines in the finding cell.
        if (!isClient && data.section === "body" && data.column.index === 1) {
          data.cell.styles.fontSize = 7;
        }
      },
    });
    y = (doc as unknown as AutoTableDoc).lastAutoTable.finalY + 4;
  }

  // ── Viewport summary ───────────────────────────
  checkPageBreak(30);
  y += 6;
  text("Viewports scanned", margin, y, { size: 14, style: "bold" });
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Viewport", "Resolution", "Device", "Response Time"]],
    body: vpResults.map((vr) => [
      vr.viewportName,
      `${vr.width}×${vr.height}`,
      vr.deviceName ?? "—",
      `${(vr.performanceMetrics as Record<string, unknown> | null)?.load ?? "—"}ms`,
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: INK, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [249, 249, 250] },
  });

  // ── Footer on every page ───────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    text(`REALSTACK · ${hostname}`, margin, pageHeight - 8, { size: 8, color: MUTED });
    text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { size: 8, color: MUTED, align: "right" });
  }

  const buffer = Buffer.from(doc.output("arraybuffer"));
  const suffix = isClient ? "client" : "internal";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="realstack-audit-${hostname}-${suffix}-${id.slice(0, 8)}.pdf"`,
    },
  });
}
