"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanSearch } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Live progress while the per-page scans run. The server page recomputes
 * done/total from the scans on each render; this just refreshes it on an
 * interval and flips to the report once everything has finished.
 */
export function SiteAuditProgress({
  done,
  total,
  failed,
}: {
  done: number;
  total: number;
  failed: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [router]);

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card className="gap-0 p-6">
      <div className="mb-4 flex items-center gap-3.5">
        <div className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--brand-soft)]">
          <ScanSearch className="size-[26px] animate-pulse text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] leading-tight tracking-[-0.02em]">Auditing pages…</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {done} of {total} done{failed > 0 ? ` · ${failed} failed` : ""}
          </p>
        </div>
        <span className="shrink-0 text-[32px] font-extrabold leading-none tabular-nums text-primary">
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-[var(--ink-2)]">
        <Loader2 className="size-3.5 animate-spin text-primary" />
        Each page runs a full audit (Playwright + Lighthouse). This can take a few minutes.
      </p>
    </Card>
  );
}
