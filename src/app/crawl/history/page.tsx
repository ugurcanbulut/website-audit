import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { crawls } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { CrawlHistoryList } from "@/components/history/crawl-history-list";

export const dynamic = "force-dynamic";

export default async function CrawlHistoryPage() {
  let allCrawls: (typeof crawls.$inferSelect)[] = [];
  try {
    allCrawls = await db.query.crawls.findMany({
      orderBy: [desc(crawls.createdAt)],
      limit: 100,
    });
  } catch {}

  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Crawl History" },
      ]} />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <CrawlHistoryList crawls={allCrawls} />
      </div>
    </>
  );
}
