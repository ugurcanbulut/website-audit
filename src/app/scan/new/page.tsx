import { ScanSearch } from "lucide-react";
import { ScanForm } from "@/components/scan/scan-form";
import { SiteHeader } from "@/components/layout/site-header";

export default async function NewScanPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Website Audit", href: "/scan/history" },
          { label: "New Scan" },
        ]}
      />
      <div className="flex flex-1 flex-col p-4 lg:p-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-6 flex items-center gap-3.5">
            <div className="flex size-[46px] shrink-0 items-center justify-center rounded-[13px] bg-[var(--brand-soft)]">
              <ScanSearch className="size-[23px] text-primary" />
            </div>
            <div>
              <h1 className="text-[28px] leading-none">New Scan</h1>
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                Configure a single-page audit across UI, UX, SEO, security
                &amp; accessibility.
              </p>
            </div>
          </div>
          <ScanForm initialUrl={url ?? ""} />
        </div>
      </div>
    </>
  );
}
