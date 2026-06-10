import { desc, eq, count, avg, gte, inArray, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, auditIssues, categoryScores } from "@/lib/db/schema";
import { DashboardHero, type LiveScanSummary } from "@/components/dashboard/hero";
import { SectionCards } from "@/components/dashboard/section-cards";
import { RecentScans, type ScanRow } from "@/components/dashboard/recent-scans";
import { LatestReport, type LatestReportData } from "@/components/dashboard/latest-report";

export const dynamic = "force-dynamic";

const RUNNING_STATUSES = ["pending", "scanning", "auditing", "analyzing"];

function emptyCounts() {
  return { critical: 0, warning: 0, info: 0 };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function DashboardPage() {
  let recentScans: (typeof scans.$inferSelect)[] = [];
  let totalScans = 0;
  let completedScans = 0;
  let scansThisWeek = 0;
  let avgScore: number | null = null;
  let totalIssues = 0;
  let criticalIssues = 0;
  let issueCountsByScan = new Map<string, { critical: number; warning: number; info: number }>();
  let latestReport: LatestReportData | null = null;

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    [recentScans, totalScans, completedScans, scansThisWeek, avgScore, totalIssues, criticalIssues] =
      await Promise.all([
        db.query.scans.findMany({
          orderBy: [desc(scans.createdAt)],
          limit: 8,
        }),
        db
          .select({ count: count() })
          .from(scans)
          .then((r) => r[0]?.count ?? 0),
        db
          .select({ count: count() })
          .from(scans)
          .where(eq(scans.status, "completed"))
          .then((r) => r[0]?.count ?? 0),
        db
          .select({ count: count() })
          .from(scans)
          .where(gte(scans.createdAt, weekAgo))
          .then((r) => r[0]?.count ?? 0),
        db
          .select({ avg: avg(scans.overallScore) })
          .from(scans)
          .where(eq(scans.status, "completed"))
          .then((r) => (r[0]?.avg ? Math.round(Number(r[0].avg)) : null)),
        db
          .select({ count: count() })
          .from(auditIssues)
          .then((r) => r[0]?.count ?? 0),
        db
          .select({ count: count() })
          .from(auditIssues)
          .where(eq(auditIssues.severity, "critical"))
          .then((r) => r[0]?.count ?? 0),
      ]);

    const ids = recentScans.map((s) => s.id);
    if (ids.length > 0) {
      const rows = await db
        .select({
          scanId: auditIssues.scanId,
          severity: auditIssues.severity,
          count: count(),
        })
        .from(auditIssues)
        .where(inArray(auditIssues.scanId, ids))
        .groupBy(auditIssues.scanId, auditIssues.severity);
      for (const row of rows) {
        const entry = issueCountsByScan.get(row.scanId) ?? emptyCounts();
        if (row.severity === "critical" || row.severity === "warning" || row.severity === "info") {
          entry[row.severity] += row.count;
        }
        issueCountsByScan.set(row.scanId, entry);
      }
    }

    const latest = recentScans.find(
      (s) => s.status === "completed" && s.overallScore !== null
    );
    if (latest) {
      const cats = await db
        .select({ category: categoryScores.category, score: categoryScores.score })
        .from(categoryScores)
        .where(eq(categoryScores.scanId, latest.id))
        .orderBy(asc(categoryScores.score));
      latestReport = {
        id: latest.id,
        host: hostnameOf(latest.url),
        score: latest.overallScore!,
        grade: latest.overallGrade ?? "",
        createdAt: latest.createdAt,
        issueCounts: issueCountsByScan.get(latest.id) ?? emptyCounts(),
        categories: cats.slice(0, 6),
      };
    }
  } catch {
    // DB not available yet (first run before migration)
  }

  const liveScanRecord = recentScans.find((s) => RUNNING_STATUSES.includes(s.status));
  const liveScan: LiveScanSummary | null = liveScanRecord
    ? {
        id: liveScanRecord.id,
        host: hostnameOf(liveScanRecord.url),
        status: liveScanRecord.status,
        viewportCount: Array.isArray(liveScanRecord.viewports)
          ? liveScanRecord.viewports.length
          : null,
      }
    : null;

  const rows: ScanRow[] = recentScans
    .filter((s) => s.status !== "failed" && s.status !== "cancelled")
    .slice(0, 7)
    .map((s) => ({
      id: s.id,
      url: s.url,
      status: s.status,
      overallScore: s.overallScore,
      overallGrade: s.overallGrade,
      createdAt: s.createdAt,
      viewportCount: Array.isArray(s.viewports) ? s.viewports.length : null,
      issueCounts: issueCountsByScan.get(s.id) ?? emptyCounts(),
    }));

  return (
    <div className="flex flex-col px-4 pt-6 lg:px-6">
      <DashboardHero liveScan={liveScan} />
      <SectionCards
        totalScans={totalScans}
        completedScans={completedScans}
        scansThisWeek={scansThisWeek}
        avgScore={avgScore}
        totalIssues={totalIssues}
        criticalIssues={criticalIssues}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <RecentScans scans={rows} />
        <LatestReport report={latestReport} />
      </div>
    </div>
  );
}
