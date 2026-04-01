import { desc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { ScanHistoryList } from "@/components/history/scan-history-list";

export const dynamic = "force-dynamic";

export default async function ScanHistoryPage() {
  let allScans: (typeof scans.$inferSelect)[] = [];
  try {
    allScans = await db.query.scans.findMany({
      where: isNull(scans.batchId), // Exclude batch child scans
      orderBy: [desc(scans.createdAt)],
      limit: 100,
    });
  } catch {}

  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Scan History" },
      ]} />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ScanHistoryList scans={allScans} />
      </div>
    </>
  );
}
