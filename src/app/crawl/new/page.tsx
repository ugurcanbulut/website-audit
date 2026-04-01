import { SiteHeader } from "@/components/layout/site-header";
import { CrawlForm } from "@/components/crawl/crawl-form";

export default function NewCrawlPage() {
  return (
    <>
      <SiteHeader title="New SEO Crawl" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="max-w-2xl">
          <p className="text-muted-foreground mb-6">
            Crawl an entire website for comprehensive SEO analysis.
          </p>
          <CrawlForm />
        </div>
      </div>
    </>
  );
}
