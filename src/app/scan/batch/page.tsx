import { SiteHeader } from "@/components/layout/site-header";
import { BatchScanForm } from "@/components/scan/batch-scan-form";

export default function BatchScanPage() {
  return (
    <>
      <SiteHeader title="Batch Scan" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="max-w-2xl">
          <p className="text-muted-foreground mb-6">
            Scan multiple URLs with the same device and audit settings.
          </p>
          <BatchScanForm />
        </div>
      </div>
    </>
  );
}
