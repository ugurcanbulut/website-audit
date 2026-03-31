import { ScanForm } from "@/components/scan/scan-form";
import { SiteHeader } from "@/components/layout/site-header";

export default function NewScanPage() {
  return (
    <>
      <SiteHeader title="New Scan" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="max-w-2xl">
          <p className="text-muted-foreground mb-6">
            Enter a URL and configure your audit settings.
          </p>
          <ScanForm />
        </div>
      </div>
    </>
  );
}
