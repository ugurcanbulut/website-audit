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

interface Crawl {
  id: string;
  seedUrl: string;
  status: string;
  totalPages: number | null;
  pagesCrawled: number | null;
  createdAt: Date;
}

const GRID = "grid-cols-[minmax(0,1fr)_130px_120px_110px_40px]";

const statusConfig: Record<string, { label: string }> = {
  ...SCAN_STATUS_CONFIG,
  running: { label: "Running" },
  crawling: { label: "Crawling" },
};

const RUNNING_STATUSES = ["running", "crawling", "scanning", "auditing", "analyzing"];

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
    case "crawling":
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
  const config = statusConfig[status] ?? statusConfig.pending;
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

function DeleteButton({ crawlId }: { crawlId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function performDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/crawls/${crawlId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Crawl deleted");
        router.refresh();
      } else {
        toast.error("Failed to delete crawl");
      }
    } catch {
      toast.error("Failed to delete crawl");
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
          aria-label="Delete crawl"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      }
      title="Delete crawl?"
      description="This permanently removes the crawl and all its discovered pages. This action cannot be undone."
      confirmLabel="Delete"
      confirmVariant="destructive"
      onConfirm={performDelete}
    />
  );
}

export function CrawlHistoryList({ crawls }: { crawls: Crawl[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = crawls.filter(
    (c) =>
      c.seedUrl.toLowerCase().includes(search.toLowerCase()) ||
      getHostname(c.seedUrl).toLowerCase().includes(search.toLowerCase())
  );

  if (crawls.length === 0) {
    return (
      <Card className="rounded-2xl py-0 shadow-none">
        <EmptyState
          icon={Globe}
          title="No crawls yet"
          description="Crawl a site to map every reachable page."
          action={
            <Button render={<Link href="/crawl/new" />}>
              <Plus className="size-4" />
              Start a New Crawl
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
        <div className="min-w-[680px]">
          <div
            className={cn(
              "grid gap-3.5 border-b px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]",
              GRID
            )}
          >
            <span>Site</span>
            <span>Status</span>
            <span>Pages</span>
            <span>Date</span>
            <span />
          </div>
          {filtered.map((crawl, i) => (
            <div
              key={crawl.id}
              className={cn(
                "group grid cursor-pointer items-center gap-3.5 px-4 py-3 transition-colors hover:bg-muted/50",
                GRID,
                i < filtered.length - 1 && "border-b"
              )}
              onClick={() => router.push(`/crawl/${crawl.id}`)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Globe className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-bold text-foreground">
                    {getHostname(crawl.seedUrl)}
                  </div>
                  <div className="truncate font-mono text-[11.5px] text-[var(--faint)]">
                    {crawl.seedUrl}
                  </div>
                </div>
              </div>
              <StatusPill status={crawl.status} />
              <span className="text-base font-extrabold tabular-nums text-foreground">
                {crawl.pagesCrawled ?? 0}
                {crawl.totalPages ? (
                  <span className="font-semibold text-[var(--faint)]">
                    {" "}
                    / {crawl.totalPages}
                  </span>
                ) : null}
              </span>
              <span className="whitespace-nowrap text-[12.5px] text-muted-foreground">
                {formatRelativeTime(crawl.createdAt)}
              </span>
              <div className="justify-self-end">
                <DeleteButton crawlId={crawl.id} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <EmptyState icon={Search} title={`No crawls matching "${search}"`} />
          )}
        </div>
      </div>
    </Card>
  );
}
