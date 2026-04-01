import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, viewportResults, auditIssues, categoryScores } from "@/lib/db/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scan = await db.query.scans.findFirst({ where: eq(scans.id, id) });
  if (!scan || scan.status !== "completed") {
    return NextResponse.json({ error: "Scan not found or not completed" }, { status: 404 });
  }

  const [vpResults, issues, scores] = await Promise.all([
    db.query.viewportResults.findMany({ where: eq(viewportResults.scanId, id) }),
    db.query.auditIssues.findMany({ where: eq(auditIssues.scanId, id) }),
    db.query.categoryScores.findMany({ where: eq(categoryScores.scanId, id) }),
  ]);

  // Dynamic import jsPDF (it's a large library)
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper functions
  function addPage() {
    doc.addPage();
    y = margin;
  }

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - margin) addPage();
  }

  function addText(text: string, size: number, style: string = "normal", color: [number, number, number] = [0, 0, 0]) {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
  }

  // ── Cover / Title ──────────────────────────────
  addText("UI Audit Report", 28, "bold");
  doc.text("UI Audit Report", pageWidth / 2, y + 20, { align: "center" });

  addText(scan.url, 12, "normal", [100, 100, 100]);
  doc.text(scan.url, pageWidth / 2, y + 30, { align: "center" });

  addText(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 10, "normal", [150, 150, 150]);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageWidth / 2, y + 38, { align: "center" });

  // Score circle (simplified - just text)
  y += 55;
  const grade = scan.overallGrade ?? "N/A";
  const score = scan.overallScore ?? 0;

  addText(String(score), 48, "bold", score >= 90 ? [34, 197, 94] : score >= 70 ? [249, 115, 22] : [239, 68, 68]);
  doc.text(String(score), pageWidth / 2, y, { align: "center" });
  y += 5;
  addText(`Grade: ${grade}`, 14, "normal", [100, 100, 100]);
  doc.text(`Grade: ${grade}`, pageWidth / 2, y + 5, { align: "center" });
  y += 15;
  addText("out of 100", 10, "normal", [150, 150, 150]);
  doc.text("out of 100", pageWidth / 2, y, { align: "center" });

  // ── Category Scores Table ──────────────────────
  y += 15;
  checkPageBreak(50);
  addText("Category Scores", 16, "bold");
  doc.text("Category Scores", margin, y);
  y += 8;

  const categoryLabels: Record<string, string> = {
    accessibility: "Accessibility", responsive: "Responsive", performance: "Performance",
    typography: "Typography", "touch-targets": "Touch Targets", forms: "Forms",
    visual: "Visual", seo: "SEO", "best-practices": "Best Practices",
    security: "Security", "html-quality": "HTML Quality", "css-quality": "CSS Quality",
    "ai-analysis": "AI Analysis",
  };

  const scoreRows = scores.map(s => {
    const ic = s.issueCount as { critical: number; warning: number; info: number };
    return [
      categoryLabels[s.category] ?? s.category,
      String(s.score),
      String(ic.critical),
      String(ic.warning),
      String(ic.info),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Category", "Score", "Critical", "Warnings", "Info"]],
    body: scoreRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Issues by Category ─────────────────────────
  const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2, pass: 3 };
  const sortedIssues = [...issues].sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  // Group by category
  const issuesByCategory = new Map<string, typeof issues>();
  for (const issue of sortedIssues) {
    const list = issuesByCategory.get(issue.category) ?? [];
    list.push(issue);
    issuesByCategory.set(issue.category, list);
  }

  for (const [category, catIssues] of issuesByCategory) {
    checkPageBreak(20);
    addText(`${categoryLabels[category] ?? category} (${catIssues.length} issues)`, 14, "bold");
    doc.text(`${categoryLabels[category] ?? category} (${catIssues.length} issues)`, margin, y);
    y += 7;

    const issueRows = catIssues.slice(0, 30).map(i => [
      i.severity.toUpperCase(),
      i.title.slice(0, 60),
      (i.description ?? "").slice(0, 100),
      (i.recommendation ?? "").slice(0, 80),
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Severity", "Issue", "Description", "Recommendation"]],
      body: issueRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: "bold" },
        1: { cellWidth: 35 },
        2: { cellWidth: 55 },
        3: { cellWidth: contentWidth - 108 },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 0) {
          const sev = data.cell.raw as string;
          if (sev === "CRITICAL") data.cell.styles.textColor = [239, 68, 68];
          else if (sev === "WARNING") data.cell.styles.textColor = [245, 158, 11];
          else if (sev === "INFO") data.cell.styles.textColor = [59, 130, 246];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    if (catIssues.length > 30) {
      addText(`... and ${catIssues.length - 30} more issues`, 8, "italic", [150, 150, 150]);
      doc.text(`... and ${catIssues.length - 30} more issues`, margin, y);
      y += 8;
    }
  }

  // ── Viewport Summary ───────────────────────────
  checkPageBreak(30);
  addText("Viewports Scanned", 16, "bold");
  doc.text("Viewports Scanned", margin, y);
  y += 8;

  const vpRows = vpResults.map(vr => [
    vr.viewportName,
    `${vr.width}x${vr.height}`,
    vr.deviceName ?? "-",
    `${(vr.performanceMetrics as Record<string, unknown> | null)?.load ?? "-"}ms`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Viewport", "Resolution", "Device", "Response Time"]],
    body: vpRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
  });

  // ── Footer ─────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`UI Audit Report - ${scan.url}`, margin, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  const buffer = Buffer.from(doc.output("arraybuffer"));

  const hostname = (() => { try { return new URL(scan.url).hostname; } catch { return "scan"; } })();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ui-audit-${hostname}-${id.slice(0, 8)}.pdf"`,
    },
  });
}
