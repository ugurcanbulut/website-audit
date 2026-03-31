import { desc, eq, count, avg } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, auditIssues } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { SectionCards } from "@/components/dashboard/section-cards";
import { RecentScans } from "@/components/dashboard/recent-scans";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let recentScans: (typeof scans.$inferSelect)[] = [];
  let totalScans = 0;
  let completedScans = 0;
  let avgScore: number | null = null;
  let totalIssues = 0;
  let criticalIssues = 0;

  try {
    [recentScans, totalScans, completedScans, avgScore, totalIssues, criticalIssues] =
      await Promise.all([
        db.query.scans.findMany({
          orderBy: [desc(scans.createdAt)],
          limit: 20,
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
  } catch {
    // DB not available yet (first run before migration)
  }

  return (
    <>
      <SiteHeader title="Dashboard" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards
              totalScans={totalScans}
              completedScans={completedScans}
              avgScore={avgScore}
              totalIssues={totalIssues}
              criticalIssues={criticalIssues}
            />
            <div className="px-4 lg:px-6">
              <RecentScans scans={recentScans} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
