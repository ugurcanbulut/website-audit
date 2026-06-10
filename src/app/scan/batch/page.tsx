import { Layers } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { BatchScanForm } from "@/components/scan/batch-scan-form";

export default function BatchScanPage() {
  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Website Audit", href: "/scan/history" },
        { label: "Batch Scan" },
      ]} />
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
          <PageHead
            icon={Layers}
            title="Batch Scan"
            subtitle="Queue many URLs at once. Each runs the full audit and lands in your history."
          />
          <BatchScanForm />
        </div>
      </div>
    </>
  );
}
