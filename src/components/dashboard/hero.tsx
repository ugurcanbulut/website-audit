"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Zap } from "lucide-react";
import { SCAN_STATUS_CONFIG } from "@/lib/ui-constants";

export interface LiveScanSummary {
  id: string;
  host: string;
  status: string;
  viewportCount: number | null;
}

// Direction D hero — full-bleed orange band with an inline "Run Audit" entry
// point and (when a scan is running) a live status mini-card.
export function DashboardHero({ liveScan }: { liveScan: LiveScanSummary | null }) {
  const router = useRouter();
  const [url, setUrl] = useState("");

  function runAudit(e: React.FormEvent) {
    e.preventDefault();
    const target = url.trim();
    router.push(target ? `/scan/new?url=${encodeURIComponent(target)}` : "/scan/new");
  }

  return (
    <div className="relative mb-6 flex items-center justify-between gap-6 overflow-hidden rounded-[22px] bg-primary px-8 py-7">
      {/* decorative circles */}
      <div className="absolute -top-[70px] right-[-50px] size-[280px] rounded-full bg-white/10" />
      <div className="absolute -bottom-[100px] right-[90px] size-[210px] rounded-full bg-white/[.08]" />

      <div className="relative flex max-w-[620px] flex-1 flex-col items-start">
        <div className="mb-2 text-xs font-bold tracking-[.1em] text-white/85">
          REALSTACK · UI AUDIT
        </div>
        <h1 className="m-0 text-[34px] font-extrabold leading-[1.12] tracking-[-0.02em] text-white">
          Audit any website in seconds.
        </h1>
        <p className="mb-5 mt-3 text-[14.5px] leading-normal text-white/90">
          UI, UX, SEO, security &amp; accessibility — one scan, one report.
        </p>
        <form onSubmit={runAudit} className="flex w-full max-w-[520px] items-center gap-2.5">
          <div className="flex h-[50px] flex-1 items-center gap-2.5 rounded-xl bg-white px-3.5 shadow-[0_4px_14px_rgba(0,0,0,.12)]">
            <Globe className="size-[18px] shrink-0 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yoursite.com"
              aria-label="Website URL to audit"
              className="h-full min-w-0 flex-1 border-none bg-transparent text-[14.5px] text-foreground outline-none placeholder:text-[var(--faint)]"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-[50px] shrink-0 items-center gap-2 rounded-xl bg-foreground px-6 text-[15px] font-bold text-white transition-colors hover:bg-black"
          >
            <Zap className="size-[18px]" />
            Run Audit
          </button>
        </form>
      </div>

      {liveScan && (
        <Link
          href={`/scan/${liveScan.id}`}
          className="relative hidden w-[268px] shrink-0 rounded-2xl border border-white/25 bg-white/[.14] px-[18px] py-4 transition-colors hover:bg-white/20 lg:block"
        >
          <div className="mb-3.5 flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,.3)]" />
            <span className="text-xs font-bold tracking-[.04em] text-white">
              SCAN IN PROGRESS
            </span>
          </div>
          <div className="mb-1 text-[15px] font-bold text-white">{liveScan.host}</div>
          <div className="mb-3 text-xs text-white/80">
            {liveScan.viewportCount
              ? `${liveScan.viewportCount} viewport${liveScan.viewportCount === 1 ? "" : "s"} · `
              : ""}
            {(SCAN_STATUS_CONFIG[liveScan.status]?.label ?? "Running").toLowerCase()}
          </div>
          <div className="h-1.5 overflow-hidden rounded-[3px] bg-white/25">
            <div className="h-full w-2/5 animate-[rs-indeterminate_1.4s_ease-in-out_infinite] rounded-[3px] bg-white" />
          </div>
        </Link>
      )}
    </div>
  );
}
