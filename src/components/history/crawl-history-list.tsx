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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { SCAN_STATUS_CONFIG } from "@/lib/ui-constants";

interface Crawl {
  id: string;
  seedUrl: string;
  status: string;
  totalPages: number | null;
  pagesCrawled: number | null;
  createdAt: Date;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ...SCAN_STATUS_CONFIG,
  running: { label: "Running", variant: "secondary" },
  crawling: { label: "Crawling", variant: "secondary" },
};

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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Globe className="size-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-base mb-4">No crawls yet</p>
        <Button render={<Link href="/crawl/new" />}>
          <Plus className="size-4 mr-2" />
          Start a New Crawl
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by URL..."
          className="pl-8"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-2 pr-4 text-left font-medium">Seed URL</th>
              <th className="pb-2 pr-4 text-left font-medium">Status</th>
              <th className="pb-2 pr-4 text-left font-medium hidden sm:table-cell">
                Pages Crawled
              </th>
              <th className="pb-2 pr-4 text-left font-medium hidden sm:table-cell">Date</th>
              <th className="pb-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((crawl) => {
              const config =
                statusConfig[crawl.status] ?? statusConfig.pending;
              return (
                <tr
                  key={crawl.id}
                  className="group border-b last:border-0 cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/crawl/${crawl.id}`)}
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium">
                      {getHostname(crawl.seedUrl)}
                    </span>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                      {crawl.seedUrl}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon status={crawl.status} />
                      {config.label}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 tabular-nums hidden sm:table-cell">
                    {crawl.pagesCrawled ?? 0}
                    {crawl.totalPages
                      ? ` / ${crawl.totalPages}`
                      : ""}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground hidden sm:table-cell">
                    {formatDate(crawl.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <DeleteButton crawlId={crawl.id} />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No crawls matching &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
