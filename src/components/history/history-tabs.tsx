"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Trash2,
  Search,
  Monitor,
  Layers,
  Globe,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SCAN_STATUS_CONFIG, getGradeColor } from "@/lib/ui-constants";

// ── Types ────────────────────────────────────────────────────────────────────

interface Scan {
  id: string;
  url: string;
  status: string;
  overallScore: number | null;
  overallGrade: string | null;
  browserEngine: string | null;
  createdAt: Date;
}

interface Batch {
  id: string;
  name: string | null;
  urls: unknown;
  status: string;
  totalScans: number;
  completedScans: number;
  overallScore: number | null;
  overallGrade: string | null;
  createdAt: Date;
}

interface Crawl {
  id: string;
  seedUrl: string;
  status: string;
  totalPages: number | null;
  pagesCrawled: number | null;
  createdAt: Date;
}

interface HistoryTabsProps {
  scans: Scan[];
  batches: Batch[];
  crawls: Crawl[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    case "scanning":
    case "auditing":
    case "analyzing":
    case "running":
    case "crawling":
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

// ── Delete Button ────────────────────────────────────────────────────────────

function DeleteButton({
  endpoint,
  label,
}: {
  endpoint: string;
  label: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete this ${label}?`)) return;

    setDeleting(true);
    try {
      await fetch(endpoint, { method: "DELETE" });
      toast.success("Deleted successfully");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={deleting}
      aria-label={`Delete ${label}`}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof Monitor;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-base">{message}</p>
    </div>
  );
}

// ── Search Input ─────────────────────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-4">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}

// ── Scans Table ──────────────────────────────────────────────────────────────

function ScansTable({ scans }: { scans: Scan[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = scans.filter(
    (s) =>
      s.url.toLowerCase().includes(search.toLowerCase()) ||
      getHostname(s.url).toLowerCase().includes(search.toLowerCase())
  );

  if (scans.length === 0) {
    return <EmptyState icon={Monitor} message="No scans yet" />;
  }

  return (
    <>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Filter by URL..."
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-2 pr-4 text-left font-medium">Site</th>
              <th className="pb-2 pr-4 text-left font-medium">Status</th>
              <th className="pb-2 pr-4 text-left font-medium">Score</th>
              <th className="pb-2 pr-4 text-left font-medium">Engine</th>
              <th className="pb-2 pr-4 text-left font-medium">Date</th>
              <th className="pb-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((scan) => {
              const config = statusConfig[scan.status] ?? statusConfig.pending;
              return (
                <tr
                  key={scan.id}
                  className="group border-b last:border-0 cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/scan/${scan.id}`)}
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium">
                      {getHostname(scan.url)}
                    </span>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                      {scan.url}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon status={scan.status} />
                      {config.label}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    {scan.status === "completed" &&
                    scan.overallScore !== null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums font-medium">
                          {scan.overallScore}
                        </span>
                        {scan.overallGrade && (
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              getGradeColor(scan.overallGrade)
                            )}
                          >
                            {scan.overallGrade}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 capitalize text-muted-foreground">
                    {scan.browserEngine ?? "--"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                    {formatDate(scan.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <DeleteButton
                      endpoint={`/api/scans/${scan.id}`}
                      label="scan"
                    />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No scans matching &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Batches Table ────────────────────────────────────────────────────────────

function BatchesTable({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = batches.filter((b) => {
    const term = search.toLowerCase();
    const name = (b.name ?? "").toLowerCase();
    const urls = Array.isArray(b.urls)
      ? (b.urls as string[]).join(" ").toLowerCase()
      : "";
    return name.includes(term) || urls.includes(term);
  });

  if (batches.length === 0) {
    return <EmptyState icon={Layers} message="No batch scans yet" />;
  }

  return (
    <>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Filter by name or URL..."
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-2 pr-4 text-left font-medium">Name</th>
              <th className="pb-2 pr-4 text-left font-medium">URLs</th>
              <th className="pb-2 pr-4 text-left font-medium">Status</th>
              <th className="pb-2 pr-4 text-left font-medium">Avg Score</th>
              <th className="pb-2 pr-4 text-left font-medium">Date</th>
              <th className="pb-2 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((batch) => {
              const config =
                statusConfig[batch.status] ?? statusConfig.pending;
              const urlCount = Array.isArray(batch.urls)
                ? batch.urls.length
                : 0;
              return (
                <tr
                  key={batch.id}
                  className="group border-b last:border-0 cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/scan/batch/${batch.id}`)}
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium">
                      {batch.name || "Unnamed Batch"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground tabular-nums">
                    {urlCount} {urlCount === 1 ? "URL" : "URLs"}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon status={batch.status} />
                      {config.label}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    {batch.status === "completed" &&
                    batch.overallScore !== null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums font-medium">
                          {batch.overallScore}
                        </span>
                        {batch.overallGrade && (
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              getGradeColor(batch.overallGrade)
                            )}
                          >
                            {batch.overallGrade}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                    {formatDate(batch.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <DeleteButton
                      endpoint={`/api/batches/${batch.id}`}
                      label="batch"
                    />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No batches matching &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Crawls Table ─────────────────────────────────────────────────────────────

function CrawlsTable({ crawls }: { crawls: Crawl[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = crawls.filter(
    (c) =>
      c.seedUrl.toLowerCase().includes(search.toLowerCase()) ||
      getHostname(c.seedUrl).toLowerCase().includes(search.toLowerCase())
  );

  if (crawls.length === 0) {
    return <EmptyState icon={Globe} message="No crawls yet" />;
  }

  return (
    <>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Filter by URL..."
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-2 pr-4 text-left font-medium">Seed URL</th>
              <th className="pb-2 pr-4 text-left font-medium">Status</th>
              <th className="pb-2 pr-4 text-left font-medium">
                Pages Crawled
              </th>
              <th className="pb-2 pr-4 text-left font-medium">Date</th>
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
                  <td className="py-3 pr-4 tabular-nums">
                    {crawl.pagesCrawled ?? 0}
                    {crawl.totalPages
                      ? ` / ${crawl.totalPages}`
                      : ""}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                    {formatDate(crawl.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <DeleteButton
                      endpoint={`/api/crawls/${crawl.id}`}
                      label="crawl"
                    />
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

// ── Main Component ───────────────────────────────────────────────────────────

export function HistoryTabs({ scans, batches, crawls }: HistoryTabsProps) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "scans";

  return (
    <Tabs defaultValue={initialTab}>
      <TabsList variant="line">
        <TabsTrigger value="scans">
          Scans
          {scans.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              ({scans.length})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="batches">
          Batches
          {batches.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              ({batches.length})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="crawls">
          Crawls
          {crawls.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              ({crawls.length})
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="scans">
        <Card className="mt-4">
          <CardContent>
            <ScansTable scans={scans} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="batches">
        <Card className="mt-4">
          <CardContent>
            <BatchesTable batches={batches} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="crawls">
        <Card className="mt-4">
          <CardContent>
            <CrawlsTable crawls={crawls} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
