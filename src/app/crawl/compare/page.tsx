import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crawls } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { CrawlCompare } from "@/components/crawl/crawl-compare";

export const dynamic = "force-dynamic";

export default async function CrawlComparePage() {
  const allCrawls = await db.query.crawls.findMany({
    where: eq(crawls.status, "completed"),
    orderBy: [desc(crawls.createdAt)],
    limit: 50,
  });

  return (
    <>
      <SiteHeader title="Compare Crawls" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <CrawlCompare
          crawls={allCrawls.map((c) => ({
            id: c.id,
            seedUrl: c.seedUrl,
            createdAt: c.createdAt.toISOString(),
            pagesCrawled: c.pagesCrawled ?? 0,
          }))}
        />
      </div>
    </>
  );
}
