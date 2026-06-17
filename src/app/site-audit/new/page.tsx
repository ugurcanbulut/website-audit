import { Network } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { SiteAuditForm } from "@/components/site-audit/site-audit-form";

export default function NewSiteAuditPage() {
  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Site Audit", href: "/site-audit/new" },
        { label: "New" },
      ]} />
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
          <PageHead
            icon={Network}
            title="Site Audit"
            subtitle="Crawl a whole site, choose the pages that matter, and audit them together into one report."
          />
          <SiteAuditForm />
        </div>
      </div>
    </>
  );
}
