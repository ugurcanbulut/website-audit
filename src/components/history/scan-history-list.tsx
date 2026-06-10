"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Trash2,
  Search,
  Monitor,
  Globe,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SCAN_STATUS_CONFIG } from "@/lib/ui-constants";
import { formatRelativeTime } from "@/lib/relative-time";
import { GradeChip } from "@/components/dashboard/grade-chip";

interface Scan {
  id: string;
  url: string;
  status: string;
  overallScore: number | null;
  overallGrade: string | null;
  browserEngine: string | null;
  createdAt: Date;
}

const GRID = "grid-cols-[minmax(0,1fr)_130px_110px_100px_110px_40px]";

const RUNNING_STATUSES = ["scanning", "auditing", "analyzing"];

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "scanning":
    case "auditing":
    case "analyzing":
      return <Loader2 className="size-3 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="size-3" />;
    case "failed":
      return <AlertCircle className="size-3" />;
    case "cancelled":
      return <Ban className="size-3" />;
    default:
      return <Clock className="size-3" />;
  }
}

function StatusPill({ status }: { status: string }) {
  const config = SCAN_STATUS_CONFIG[status] ?? SCAN_STATUS_CONFIG.pending;
  const tone =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : RUNNING_STATUSES.includes(status)
        ? "bg-[var(--brand-soft)] text-primary"
        : status === "failed"
          ? "bg-red-50 text-red-600"
          : "bg-secondary text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-lg py-[3px] pl-2 pr-2.5 text-xs font-bold",
        tone
      )}
    >
      <StatusIcon status={status} />
      {config.label}
    </span>
  );
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function DeleteButton({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function performDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Scan deleted");
        router.refresh();
      } else {
        toast.error("Failed to delete scan");
      }
    } catch {
      toast.error("Failed to delete scan");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          disabled={deleting}
          aria-label="Delete scan"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      }
      title="Delete scan?"
      description="This permanently removes the scan, its screenshots, and all findings. This action cannot be undone."
      confirmLabel="Delete"
      confirmVariant="destructive"
      onConfirm={performDelete}
    />
  );
}

export function ScanHistoryList({ scans }: { scans: Scan[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = scans.filter(
    (s) =>
      s.url.toLowerCase().includes(search.toLowerCase()) ||
      getHostname(s.url).toLowerCase().includes(search.toLowerCase())
  );

  if (scans.length === 0) {
    return (
      <Card className="rounded-2xl py-0 shadow-none">
        <EmptyState
          icon={Monitor}
          title="No scans yet"
          description="Run your first audit to see it land here."
          action={
            <Button render={<Link href="/scan/new" />}>
              <Plus className="size-4" />
              Start a New Scan
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-none">
      <div className="flex items-center gap-3 border-b px-4 py-3.5">
        <div className="relative w-full max-w-[360px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by site…"
            className="h-10 rounded-[11px] pl-9"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div
            className={cn(
              "grid gap-3.5 border-b px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]",
              GRID
            )}
          >
            <span>Site</span>
            <span>Status</span>
            <span>Score</span>
            <span>Engine</span>
            <span>Date</span>
            <span />
          </div>
          {filtered.map((scan, i) => {
            const completed =
              scan.status === "completed" && scan.overallScore !== null;
            return (
              <div
                key={scan.id}
                className={cn(
                  "group grid cursor-pointer items-center gap-3.5 px-4 py-3 transition-colors hover:bg-muted/50",
                  GRID,
                  i < filtered.length - 1 && "border-b"
                )}
                onClick={() => router.push(`/scan/${scan.id}`)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Globe className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold text-foreground">
                      {getHostname(scan.url)}
                    </div>
                    <div className="truncate font-mono text-[11.5px] text-[var(--faint)]">
                      {scan.url}
                    </div>
                  </div>
                </div>
                <StatusPill status={scan.status} />
                {completed ? (
                  <div className="flex items-center gap-2">
                    <GradeChip
                      score={scan.overallScore!}
                      grade={scan.overallGrade ?? undefined}
                      size={22}
                    />
                    <span className="text-base font-extrabold tabular-nums text-foreground">
                      {scan.overallScore}
                    </span>
                  </div>
                ) : (
                  <span className="text-[var(--faint)]">—</span>
                )}
                <span className="text-[12.5px] capitalize text-muted-foreground">
                  {scan.browserEngine ?? "—"}
                </span>
                <span className="whitespace-nowrap text-[12.5px] text-muted-foreground">
                  {formatRelativeTime(scan.createdAt)}
                </span>
                <div className="justify-self-end">
                  <DeleteButton scanId={scan.id} />
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <EmptyState icon={Search} title={`No scans matching "${search}"`} />
          )}
        </div>
      </div>
    </Card>
  );
}
