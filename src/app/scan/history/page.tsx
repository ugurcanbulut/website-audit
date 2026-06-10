import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { History, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { ScanHistoryList } from "@/components/history/scan-history-list";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ScanHistoryPage() {
  let allScans: (typeof scans.$inferSelect)[] = [];
  try {
    allScans = await db.query.scans.findMany({
      where: isNull(scans.batchId), // Exclude batch child scans
      orderBy: [desc(scans.createdAt)],
      limit: 100,
    });
  } catch {}

  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: "Scan History" },
      ]} />
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <PageHead
          icon={History}
          title="Scan History"
          subtitle={`${allScans.length} scan${allScans.length === 1 ? "" : "s"} across your workspace.`}
          right={
            <Link href="/scan/new" className={cn(buttonVariants({ size: "lg" }))}>
              <Plus className="size-4" />
              New Scan
            </Link>
          }
        />
        <ScanHistoryList scans={allScans} />
      </div>
    </>
  );
}
