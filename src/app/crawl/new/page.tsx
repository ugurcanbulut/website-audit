import { Globe } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { CrawlForm } from "@/components/crawl/crawl-form";

export default function NewCrawlPage() {
  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "SEO Crawl", href: "/crawl/history" },
        { label: "New Crawl" },
      ]} />
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
          <PageHead
            icon={Globe}
            title="New Crawl"
            subtitle="Discover and audit every reachable page from a seed URL."
          />
          <CrawlForm />
        </div>
      </div>
    </>
  );
}
