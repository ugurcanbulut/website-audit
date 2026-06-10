import Link from "next/link";
import { desc } from "drizzle-orm";
import { History, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { crawls } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { CrawlHistoryList } from "@/components/history/crawl-history-list";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

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
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <PageHead
          icon={History}
          title="Crawl History"
          subtitle={`${allCrawls.length} site crawl${allCrawls.length === 1 ? "" : "s"}.`}
          right={
            <Link href="/crawl/new" className={cn(buttonVariants({ size: "lg" }))}>
              <Plus className="size-4" />
              New Crawl
            </Link>
          }
        />
        <CrawlHistoryList crawls={allCrawls} />
      </div>
    </>
  );
}
