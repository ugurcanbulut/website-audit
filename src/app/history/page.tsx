import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, scanBatches, crawls } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { HistoryTabs } from "@/components/history/history-tabs";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let allScans: (typeof scans.$inferSelect)[] = [];
  let allBatches: (typeof scanBatches.$inferSelect)[] = [];
  let allCrawls: (typeof crawls.$inferSelect)[] = [];

  try {
    [allScans, allBatches, allCrawls] = await Promise.all([
      db.query.scans.findMany({
        orderBy: [desc(scans.createdAt)],
        limit: 100,
      }),
      db.query.scanBatches.findMany({
        orderBy: [desc(scanBatches.createdAt)],
        limit: 50,
      }),
      db.query.crawls.findMany({
        orderBy: [desc(crawls.createdAt)],
        limit: 50,
      }),
    ]);
  } catch {
    // DB not available yet (first run before migration)
  }

  return (
    <>
      <SiteHeader title="History" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <HistoryTabs
          scans={allScans}
          batches={allBatches}
          crawls={allCrawls}
        />
      </div>
    </>
  );
}
