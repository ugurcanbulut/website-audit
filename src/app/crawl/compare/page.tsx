import { desc, eq } from "drizzle-orm";
import { Layers } from "lucide-react";
import { db } from "@/lib/db";
import { crawls } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
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
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "SEO Crawl", href: "/crawl/history" },
        { label: "Compare Crawls" },
      ]} />
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <PageHead
          icon={Layers}
          title="Compare Crawls"
          subtitle="Diff two crawls of the same site to track regressions over time."
        />
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
