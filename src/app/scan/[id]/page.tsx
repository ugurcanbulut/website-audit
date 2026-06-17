import { notFound } from "next/navigation";
import { eq, and, lt, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  scans,
  viewportResults as viewportResultsTable,
  viewportResultBlobs as viewportResultBlobsTable,
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
import { ExecutiveOverview } from "@/components/report/executive-overview";
import { ReportTabs } from "@/components/report/report-tabs";
import { IssuesByCategory } from "@/components/report/issues-by-category";
import { ScreenshotCompare } from "@/components/report/screenshot-compare";
import { ViewportTabs } from "@/components/report/viewport-tabs";
import { LighthouseReport } from "@/components/report/lighthouse-report";
import { ComplianceTab } from "@/components/report/compliance-tab";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { XCircle, FileDown } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { getScoreHexColor } from "@/lib/ui-constants";
import { GradeChip } from "@/components/dashboard/grade-chip";
import { DeleteScanButton } from "@/components/scan/delete-scan-button";
import { SiteHeader } from "@/components/layout/site-header";
import { ReportModeToggle } from "@/components/report/report-mode-toggle";
import type { ReportView } from "@/components/report/report-mode";

// ---------------------------------------------------------------------------
// Score ring (Direction D) — compact header variant, no label
// ---------------------------------------------------------------------------

function ScoreRing({
  score,
  size = 64,
  stroke = 6,
}: {
  score: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={getScoreHexColor(score)}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-extrabold leading-none tracking-[-0.02em] text-foreground tabular-nums"
          style={{ fontSize: size * 0.3 }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ScanDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function ScanDetailPage({ params, searchParams }: ScanDetailPageProps) {
  const { id } = await params;
  const { view: viewParam } = await searchParams;
  const view: ReportView = viewParam === "client" ? "client" : "internal";

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
        <SiteHeader breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Scan in Progress" },
        ]} />
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[760px]">
            <ScanProgress scanId={id} url={scan.url} viewportNames={viewportNames} />
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
        <SiteHeader breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: title },
        ]} />
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
                <p className="text-base text-muted-foreground max-w-md mb-6">
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

  // Heavy blobs live in a sibling table; load them only now that the scan is
  // confirmed complete. Used for annotations (domSnapshot) and Lighthouse tab
  // rendering (lighthouseJson).
  const viewportBlobsRaw = vpResultsRaw.length
    ? await db.query.viewportResultBlobs.findMany({
        where: inArray(
          viewportResultBlobsTable.viewportResultId,
          vpResultsRaw.map((vr) => vr.id),
        ),
      })
    : [];
  const blobByVpId = new Map(
    viewportBlobsRaw.map((b) => [b.viewportResultId, b]),
  );

  // Map DB rows to typed objects
  const vpResults: ViewportResult[] = vpResultsRaw.map((vr) => ({
    id: vr.id,
    viewportName: vr.viewportName,
    width: vr.width,
    height: vr.height,
    screenshotPath: vr.screenshotPath,
    performanceMetrics: vr.performanceMetrics as ViewportResult["performanceMetrics"],
    screenshotWidth: vr.screenshotWidth ?? undefined,
    screenshotHeight: vr.screenshotHeight ?? undefined,
  }));

  const catScores: CategoryScore[] = catScoresRaw.map((cs) => ({
    category: cs.category as AuditCategory,
    score: cs.score,
    issueCount: cs.issueCount as CategoryScore["issueCount"],
  }));

  const issues: AuditIssue[] = issuesRaw.map((i) => {
    const details = i.details as Record<string, unknown> | undefined;
    return {
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
      helpUrl: (details?.helpUrl as string) ?? undefined,
      wcagTags: (details?.wcagTags as string[]) ?? undefined,
      details,
    };
  });

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
    const snapshot = (blobByVpId.get(vr.id)?.domSnapshot ?? null) as
      | DomSnapshot
      | null;
    if (snapshot) {
      annotationsByViewport[vr.viewportName] = mapIssuesToAnnotations(
        issues,
        snapshot,
        vr.viewportName,
      );
    }
  }

  // Extract Lighthouse scores if available (supports new dual-format and legacy)
  let lighthouseScores: { performance?: number; accessibility?: number; bestPractices?: number; seo?: number } | undefined;
  let desktopLhr: Record<string, unknown> | undefined;
  let mobileLhr: Record<string, unknown> | undefined;

  for (const vr of vpResultsRaw) {
    const lhJson = (blobByVpId.get(vr.id)?.lighthouseJson ?? null) as
      | Record<string, unknown>
      | null;
    if (!lhJson) continue;

    // New format: { desktop: LHR, mobile: LHR }
    if (lhJson.desktop) {
      desktopLhr = lhJson.desktop as Record<string, unknown>;
      const cats = (desktopLhr.categories ?? {}) as Record<string, { score?: number | null }>;
      lighthouseScores = {};
      if (cats.performance?.score != null) lighthouseScores.performance = Math.round(cats.performance.score * 100);
      if (cats.accessibility?.score != null) lighthouseScores.accessibility = Math.round(cats.accessibility.score * 100);
      if (cats["best-practices"]?.score != null) lighthouseScores.bestPractices = Math.round(cats["best-practices"].score * 100);
      if (cats.seo?.score != null) lighthouseScores.seo = Math.round(cats.seo.score * 100);
    }
    if (lhJson.mobile) {
      mobileLhr = lhJson.mobile as Record<string, unknown>;
    }
    // Legacy format: direct LHR (backward compat)
    if (lhJson.categories && !lhJson.desktop) {
      desktopLhr = lhJson;
      const cats = lhJson.categories as Record<string, { score?: number | null }>;
      lighthouseScores = {};
      if (cats.performance?.score != null) lighthouseScores.performance = Math.round(cats.performance.score * 100);
      if (cats.accessibility?.score != null) lighthouseScores.accessibility = Math.round(cats.accessibility.score * 100);
      if (cats["best-practices"]?.score != null) lighthouseScores.bestPractices = Math.round(cats["best-practices"].score * 100);
      if (cats.seo?.score != null) lighthouseScores.seo = Math.round(cats.seo.score * 100);
    }
    break;
  }

  const lighthouseContent = (desktopLhr || mobileLhr) ? (
    <LighthouseReport desktopLhr={desktopLhr} mobileLhr={mobileLhr} />
  ) : undefined;

  const overallScore = scan.overallScore ?? 0;
  const overallGrade = (scan.overallGrade as Grade | null) ?? "F";

  const hostname = (() => {
    try {
      return new URL(scan.url).hostname;
    } catch {
      return scan.url;
    }
  })();
  const scanDate = scan.createdAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Find the previous completed scan of the same URL for trend comparison.
  const previousScan = await db.query.scans.findFirst({
    where: and(
      eq(scans.url, scan.url),
      eq(scans.status, "completed"),
      lt(scans.createdAt, scan.createdAt),
    ),
    orderBy: [desc(scans.createdAt)],
  });
  const previousScore = previousScan?.overallScore ?? null;

  // Group issues by category
  const issuesByCategory = new Map<AuditCategory, AuditIssue[]>();
  for (const issue of issues) {
    const list = issuesByCategory.get(issue.category) ?? [];
    list.push(issue);
    issuesByCategory.set(issue.category, list);
  }

  // ── Build tab content ───────────────────────────────────────────────────

  // Convert issuesByCategory Map to plain object for serialization
  const issuesByCategoryObj: Record<string, AuditIssue[]> = {};
  for (const [key, value] of issuesByCategory) {
    issuesByCategoryObj[key] = value;
  }

  // Legacy per-category overview (radar + category cards) now lives inside
  // the Issues tab as a lead-in so users still get the visual score summary
  // when they drill into findings.
  const issuesContent = (
    <div className="space-y-8">
      <ReportOverview
        overallScore={overallScore}
        overallGrade={overallGrade}
        categoryScores={catScores}
        scanUrl={scan.url}
        createdAt={scan.createdAt.toISOString()}
        lighthouseScores={lighthouseScores}
        browserEngine={scan.browserEngine ?? undefined}
      />
      <IssuesByCategory
        categoryScores={catScores}
        issuesByCategory={issuesByCategoryObj}
      />
    </div>
  );

  const complianceContent = <ComplianceTab issues={issues} />;

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
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Scan History", href: "/scan/history" },
        { label: hostname },
      ]} />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <ScoreRing score={overallScore} size={64} stroke={6} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate text-[28px] leading-tight tracking-[-0.025em]">
                  {hostname}
                </h1>
                <GradeChip grade={overallGrade} size={28} className="shrink-0" />
              </div>
              <p className="mt-1 break-all font-mono text-[13px] text-muted-foreground">
                {scan.url} · {scanDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ReportModeToggle current={view} />
            <a
              href={`/api/scans/${id}/pdf`}
              download
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <FileDown className="size-4 mr-1" />
              PDF Report
            </a>
            <DeleteScanButton scanId={id} />
          </div>
        </div>

        <ReportTabs
          view={view}
          issuesCount={issues.length}
          summaryContent={
            <ExecutiveOverview
              overallScore={overallScore}
              overallGrade={overallGrade}
              scanUrl={scan.url}
              scanCreatedAt={scan.createdAt.toISOString()}
              issues={issues}
              categoryScores={catScores}
              previousScore={previousScore}
              previousScanId={previousScan?.id}
            />
          }
          issuesContent={issuesContent}
          complianceContent={complianceContent}
          lighthouseContent={lighthouseContent}
          screenshotsContent={screenshotsContent}
          viewportContent={viewportContent}
        />
      </div>
    </>
  );
}
