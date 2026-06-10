import Link from "next/link";
import {
  Globe,
  Monitor,
  ChevronRight,
  ArrowRight,
  Loader2,
  AlertCircle,
  Ban,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { getScoreHexColor, SCAN_STATUS_CONFIG } from "@/lib/ui-constants";
import { formatRelativeTime } from "@/lib/relative-time";
import { GradeChip } from "@/components/dashboard/grade-chip";

export interface ScanRow {
  id: string;
  url: string;
  status: string;
  overallScore: number | null;
  overallGrade: string | null;
  createdAt: Date;
  viewportCount: number | null;
  issueCounts: { critical: number; warning: number; info: number };
}

const GRID = "grid-cols-[minmax(0,1fr)_150px_140px_90px_80px]";

function getHostAndPath(url: string): { host: string; path: string } {
  try {
    const u = new URL(url);
    return { host: u.hostname.replace(/^www\./, ""), path: u.pathname };
  } catch {
    return { host: url, path: "/" };
  }
}

function SevPill({ n, kind }: { n: number; kind: "crit" | "warn" | "info" }) {
  if (!n) {
    return (
      <span className="inline-flex h-[22px] min-w-[26px] items-center justify-center text-xs text-[var(--faint)]">
        —
      </span>
    );
  }
  const tone = {
    crit: "bg-red-50 text-red-600",
    warn: "bg-amber-50 text-amber-600",
    info: "bg-blue-50 text-blue-600",
  }[kind];
  return (
    <span
      className={cn(
        "inline-flex h-[22px] min-w-[26px] items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums",
        tone
      )}
    >
      {n}
    </span>
  );
}

function RunningIcon({ status }: { status: string }) {
  switch (status) {
    case "scanning":
    case "auditing":
    case "analyzing":
      return <Loader2 className="size-3.5 animate-spin" />;
    case "failed":
      return <AlertCircle className="size-3.5" />;
    case "cancelled":
      return <Ban className="size-3.5" />;
    default:
      return <Clock className="size-3.5" />;
  }
}

function ScanRowItem({ scan, last }: { scan: ScanRow; last: boolean }) {
  const { host, path } = getHostAndPath(scan.url);
  const completed = scan.status === "completed" && scan.overallScore !== null;
  const running = ["pending", "scanning", "auditing", "analyzing"].includes(scan.status);
  const statusCfg = SCAN_STATUS_CONFIG[scan.status] ?? SCAN_STATUS_CONFIG.pending;

  return (
    <Link
      href={`/scan/${scan.id}`}
      className={cn(
        "group grid items-center gap-3 px-4 py-3 transition-colors hover:bg-background",
        GRID,
        !last && "border-b"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Globe className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-foreground">
            {host}
            {path !== "/" && <span className="font-medium text-[var(--faint)]">{path}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-muted-foreground">
            <Monitor className="size-3 text-[var(--faint)]" />
            {scan.viewportCount
              ? `${scan.viewportCount} viewport${scan.viewportCount === 1 ? "" : "s"}`
              : "—"}
          </div>
        </div>
      </div>

      {completed ? (
        <>
          <div className="flex items-center gap-2.5">
            <GradeChip score={scan.overallScore!} grade={scan.overallGrade ?? undefined} />
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${scan.overallScore}%`,
                  background: getScoreHexColor(scan.overallScore!),
                }}
              />
            </div>
            <span className="w-6 text-[15px] font-extrabold tabular-nums text-foreground">
              {scan.overallScore}
            </span>
          </div>
          <div className="flex gap-1.5">
            <SevPill n={scan.issueCounts.critical} kind="crit" />
            <SevPill n={scan.issueCounts.warning} kind="warn" />
            <SevPill n={scan.issueCounts.info} kind="info" />
          </div>
        </>
      ) : (
        <div
          className={cn(
            "col-span-2 flex items-center gap-2 text-[12.5px] font-bold",
            running ? "text-primary" : scan.status === "failed" ? "text-red-600" : "text-muted-foreground"
          )}
        >
          <RunningIcon status={scan.status} />
          {statusCfg.label}
        </div>
      )}

      <span className="whitespace-nowrap text-[12.5px] text-muted-foreground">
        {formatRelativeTime(scan.createdAt)}
      </span>
      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap text-[12.5px] font-bold text-muted-foreground transition-colors group-hover:text-primary">
        {running ? "Live" : "Report"}
        <ChevronRight className="size-3.5" />
      </span>
    </Link>
  );
}

export function RecentScans({ scans }: { scans: ScanRow[] }) {
  if (scans.length === 0) {
    return (
      <Card className="rounded-2xl py-0 shadow-none">
        <EmptyState
          icon={Monitor}
          title="No scans yet"
          description="Start by scanning a website to get a comprehensive UI/UX audit across multiple viewports."
          action={
            <Link href="/scan/new" className={cn(buttonVariants({ variant: "default" }))}>
              Start Your First Scan
              <ArrowRight className="ml-2 size-4" />
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-none">
      <div className="flex items-center justify-between border-b px-[18px] pb-3 pt-4">
        <div>
          <h2 className="text-lg">Recent Scans</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Latest audits across your workspace
          </p>
        </div>
        <Link
          href="/scan/history"
          className="inline-flex items-center gap-1 text-[13px] font-bold text-primary transition-colors hover:text-[var(--brand-hover)]"
        >
          View all
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div
        className={cn(
          "grid gap-3 border-b px-4 py-2 text-[11px] font-bold tracking-[.04em] text-[var(--faint)]",
          GRID
        )}
      >
        <span>SITE</span>
        <span>SCORE</span>
        <span>ISSUES</span>
        <span>WHEN</span>
        <span />
      </div>
      {scans.map((scan, i) => (
        <ScanRowItem key={scan.id} scan={scan} last={i === scans.length - 1} />
      ))}
    </Card>
  );
}
