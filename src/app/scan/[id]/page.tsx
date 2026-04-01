import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  scans,
  viewportResults as viewportResultsTable,
  categoryScores as categoryScoresTable,
  auditIssues,
} from "@/lib/db/schema";
import type {
  ScanStatus,
  Grade,
  ViewportConfig,
  AuditIssue,
  CategoryScore,
  ViewportResult,
  AuditCategory,
  IssueSeverity,
} from "@/lib/types";
import { mapIssuesToAnnotations } from "@/lib/annotations/mapper";
import type { Annotation } from "@/lib/annotations/mapper";
import type { DomSnapshot } from "@/lib/scanner/capture";
import { ScanProgress } from "@/components/scan/scan-progress";
import { ReportOverview } from "@/components/report/report-overview";
import { ReportTabs } from "@/components/report/report-tabs";
import { IssuesByCategory } from "@/components/report/issues-by-category";
import { ScreenshotCompare } from "@/components/report/screenshot-compare";
import { ViewportTabs } from "@/components/report/viewport-tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { XCircle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { DeleteScanButton } from "@/components/scan/delete-scan-button";
import { SiteHeader } from "@/components/layout/site-header";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ScanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScanDetailPage({ params }: ScanDetailPageProps) {
  const { id } = await params;

  const scan = await db.query.scans.findFirst({
    where: eq(scans.id, id),
  });

  if (!scan) {
    notFound();
  }

  const status = scan.status as ScanStatus;
  const viewports = scan.viewports as ViewportConfig[];
  const viewportNames = viewports.map((v) => v.name);

  // ── In-progress states ──────────────────────────────────────────────────
  if (
    status === "pending" ||
    status === "scanning" ||
    status === "auditing" ||
    status === "analyzing"
  ) {
    return (
      <>
        <SiteHeader title="Scan in Progress" />
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          <div className="max-w-2xl">
            <p className="text-muted-foreground break-all">{scan.url}</p>
            <ScanProgress scanId={id} viewportNames={viewportNames} />
          </div>
        </div>
      </>
    );
  }

  // ── Failed / Cancelled state ─────────────────────────────────────────────
  if (status === "failed" || status === "cancelled") {
    const title = status === "cancelled" ? "Scan Cancelled" : "Scan Failed";
    return (
      <>
        <SiteHeader title={title} />
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          <div className="max-w-2xl">
            <div className="flex items-start justify-between gap-4 mb-6">
              <p className="text-muted-foreground break-all">{scan.url}</p>
              <DeleteScanButton scanId={id} />
            </div>
            <Card>
              <CardContent className="py-10 flex flex-col items-center text-center">
                <XCircle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-lg font-semibold mb-2">
                  Something went wrong
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  {scan.error ?? "An unknown error occurred during the scan."}
                </p>
                <Link
                  href="/scan/new"
                  className={cn(buttonVariants({ variant: "default" }))}
                >
                  Try Again
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // ── Completed state ─────────────────────────────────────────────────────
  const [vpResultsRaw, catScoresRaw, issuesRaw] = await Promise.all([
    db.query.viewportResults.findMany({
      where: eq(viewportResultsTable.scanId, id),
    }),
    db.query.categoryScores.findMany({
      where: eq(categoryScoresTable.scanId, id),
    }),
    db.query.auditIssues.findMany({
      where: eq(auditIssues.scanId, id),
    }),
  ]);

  // Map DB rows to typed objects
  const vpResults: ViewportResult[] = vpResultsRaw.map((vr) => ({
    id: vr.id,
    viewportName: vr.viewportName,
    width: vr.width,
    height: vr.height,
    screenshotPath: vr.screenshotPath,
    performanceMetrics: vr.performanceMetrics as ViewportResult["performanceMetrics"],
  }));

  const catScores: CategoryScore[] = catScoresRaw.map((cs) => ({
    category: cs.category as AuditCategory,
    score: cs.score,
    issueCount: cs.issueCount as CategoryScore["issueCount"],
  }));

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
    viewportName: undefined, // derived from viewport result if needed
    details: i.details as Record<string, unknown> | undefined,
  }));

  // Attach viewport names to issues based on viewportResultId
  const vpResultIdToName = new Map(vpResultsRaw.map((vr) => [vr.id, vr.viewportName]));
  for (let idx = 0; idx < issues.length; idx++) {
    const raw = issuesRaw[idx];
    if (raw.viewportResultId) {
      issues[idx].viewportName = vpResultIdToName.get(raw.viewportResultId);
    }
  }

  // Compute annotations per viewport
  const annotationsByViewport: Record<string, Annotation[]> = {};
  for (const vr of vpResultsRaw) {
    const snapshot = vr.domSnapshot as DomSnapshot | null;
    if (snapshot) {
      annotationsByViewport[vr.viewportName] = mapIssuesToAnnotations(
        issues,
        snapshot,
        vr.viewportName,
      );
    }
  }

  // Extract Lighthouse scores if available
  let lighthouseScores: { performance?: number; bestPractices?: number; seo?: number } | undefined;
  for (const vr of vpResultsRaw) {
    const lhJson = vr.lighthouseJson as Record<string, unknown> | null;
    if (lhJson?.categories) {
      const cats = lhJson.categories as Record<string, { score?: number | null }>;
      lighthouseScores = {};
      if (cats.performance?.score != null) lighthouseScores.performance = Math.round(cats.performance.score * 100);
      if (cats["best-practices"]?.score != null) lighthouseScores.bestPractices = Math.round(cats["best-practices"].score * 100);
      if (cats.seo?.score != null) lighthouseScores.seo = Math.round(cats.seo.score * 100);
      break;
    }
  }

  const overallScore = scan.overallScore ?? 0;
  const overallGrade = (scan.overallGrade as Grade | null) ?? "F";

  // Group issues by category
  const issuesByCategory = new Map<AuditCategory, AuditIssue[]>();
  for (const issue of issues) {
    const list = issuesByCategory.get(issue.category) ?? [];
    list.push(issue);
    issuesByCategory.set(issue.category, list);
  }

  // ── Build tab content ───────────────────────────────────────────────────

  const overviewContent = (
    <ReportOverview
      overallScore={overallScore}
      overallGrade={overallGrade}
      categoryScores={catScores}
      scanUrl={scan.url}
      createdAt={scan.createdAt.toISOString()}
      lighthouseScores={lighthouseScores}
      browserEngine={scan.browserEngine ?? undefined}
    />
  );

  // Convert issuesByCategory Map to plain object for serialization
  const issuesByCategoryObj: Record<string, AuditIssue[]> = {};
  for (const [key, value] of issuesByCategory) {
    issuesByCategoryObj[key] = value;
  }

  const issuesContent = (
    <IssuesByCategory
      categoryScores={catScores}
      issuesByCategory={issuesByCategoryObj}
    />
  );

  const screenshotsContent = <ScreenshotCompare viewportResults={vpResults} />;

  const viewportContent = (
    <ViewportTabs
      viewportResults={vpResults}
      issues={issues}
      annotationsByViewport={annotationsByViewport}
    />
  );

  return (
    <>
      <SiteHeader title="Scan Results" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-muted-foreground break-all">{scan.url}</p>
          <DeleteScanButton scanId={id} />
        </div>

        <ReportTabs
          overviewContent={overviewContent}
          issuesContent={issuesContent}
          screenshotsContent={screenshotsContent}
          viewportContent={viewportContent}
        />
      </div>
    </>
  );
}
