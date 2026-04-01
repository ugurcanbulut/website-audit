"use client";

import { Fragment, useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Search,
  Download,
  AlertTriangle,
  ArrowRight,
  Copy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

import { findDuplicateClusters } from "@/lib/crawler/simhash";
import { buildSiteTree } from "@/lib/crawler/site-tree";
import { getHttpStatusColor } from "@/lib/ui-constants";
import { SiteTree } from "./site-tree";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CrawlPage {
  id: string;
  url: string;
  statusCode: number | null;
  redirectUrl: string | null;
  contentType: string | null;
  responseTimeMs: number | null;
  contentSize: number | null;
  title: string | null;
  metaDescription: string | null;
  metaRobots: string | null;
  canonicalUrl: string | null;
  h1: string[] | null;
  h2: string[] | null;
  wordCount: number | null;
  internalLinks: Array<{
    href: string;
    anchor: string;
    nofollow: boolean;
  }> | null;
  externalLinks: Array<{
    href: string;
    anchor: string;
    nofollow: boolean;
  }> | null;
  images: Array<{ src: string; alt: string }> | null;
  structuredData: unknown[] | null;
  errors: string[] | null;
  crawlDepth: number | null;
  inlinksCount: number | null;
  contentHash: string | null;
  redirectChain: Array<{ url: string; statusCode: number }> | null;
}

// The DB returns jsonb columns as `unknown`. Accept either typed or raw data.
export interface CrawlTabsProps {
  pages: Array<{
    id: string;
    url: string;
    statusCode: number | null;
    redirectUrl: string | null;
    contentType: string | null;
    responseTimeMs: number | null;
    contentSize: number | null;
    title: string | null;
    metaDescription: string | null;
    metaRobots: string | null;
    canonicalUrl: string | null;
    h1: unknown;
    h2: unknown;
    wordCount: number | null;
    internalLinks: unknown;
    externalLinks: unknown;
    images: unknown;
    structuredData: unknown;
    errors: unknown;
    crawlDepth: number | null;
    inlinksCount: number | null;
    [key: string]: unknown;
  }>;
}

type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(code: number | null): string {
  if (!code) return "text-muted-foreground";
  return getHttpStatusColor(code);
}

function statusBadgeVariant(
  code: number | null
): "default" | "secondary" | "destructive" | "outline" {
  if (!code) return "secondary";
  if (code >= 200 && code < 300) return "outline";
  if (code >= 300 && code < 400) return "secondary";
  if (code >= 400) return "destructive";
  return "outline";
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

function arrLen(val: unknown): number {
  return Array.isArray(val) ? val.length : 0;
}

function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Shared sortable table infrastructure
// ---------------------------------------------------------------------------

interface ColumnDef<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  sortFn?: (a: T, b: T) => number;
  render: (row: T) => React.ReactNode;
  className?: string;
}

function SortHeader({
  label,
  isActive,
  sortDir,
  align,
  onClick,
}: {
  label: string;
  isActive: boolean;
  sortDir: SortDir;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function UrlCell({ url }: { url: string }) {
  const path = urlPath(url);
  return (
    <Tooltip>
      <TooltipTrigger className="truncate block max-w-[260px] text-left">
        {truncate(path, 45)}
      </TooltipTrigger>
      <TooltipContent>{url}</TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ code }: { code: number | null }) {
  return (
    <Badge variant={statusBadgeVariant(code)}>
      <span className={`font-mono text-[11px] ${statusColor(code)}`}>
        {code ?? "--"}
      </span>
    </Badge>
  );
}

function IssueBadges({ issues }: { issues: string[] }) {
  if (issues.length === 0) return <span className="text-muted-foreground">--</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {issues.map((issue, i) => (
        <Badge key={i} variant="destructive" className="text-[10px]">
          <AlertTriangle className="size-2.5 mr-0.5" />
          {issue}
        </Badge>
      ))}
    </div>
  );
}

function DataTable<T extends { id: string; url: string }>({
  data,
  columns,
  searchPlaceholder,
  exportFilename,
  exportHeaders,
  exportRowFn,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  exportFilename: string;
  exportHeaders: string[];
  exportRowFn: (row: T) => string[];
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>(columns[0]?.key ?? "");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter((p) => p.url.toLowerCase().includes(q));
  }, [data, search]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortFn) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = col.sortFn!(a, b);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const handleExport = useCallback(() => {
    downloadCsv(exportFilename, exportHeaders, sorted.map(exportRowFn));
  }, [sorted, exportFilename, exportHeaders, exportRowFn]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder ?? "Filter by URL..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <TooltipProvider>
            <table className="w-full text-base">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b">
                  {columns.map((col) => (
                    <SortHeader
                      key={col.key}
                      label={col.label}
                      isActive={sortKey === col.key}
                      sortDir={sortDir}
                      align={col.align}
                      onClick={() => toggleSort(col.key)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2 ${col.align === "right" ? "text-right tabular-nums" : ""} ${col.className ?? ""}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No results found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {sorted.length} of {data.length} rows
        {search && ` (filtered by "${search}")`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: All Pages
// ---------------------------------------------------------------------------

function AllPagesTab({ pages }: { pages: CrawlPage[] }) {
  const columns: ColumnDef<CrawlPage>[] = useMemo(
    () => [
      {
        key: "url",
        label: "URL",
        className: "max-w-[260px]",
        sortFn: (a, b) => a.url.localeCompare(b.url),
        render: (row) => <UrlCell url={row.url} />,
      },
      {
        key: "statusCode",
        label: "Status",
        sortFn: (a, b) => (a.statusCode ?? 0) - (b.statusCode ?? 0),
        render: (row) => <StatusBadge code={row.statusCode} />,
      },
      {
        key: "title",
        label: "Title",
        className: "max-w-[200px]",
        sortFn: (a, b) => (a.title ?? "").localeCompare(b.title ?? ""),
        render: (row) => (
          <Tooltip>
            <TooltipTrigger className="truncate block max-w-[200px] text-left">
              {truncate(row.title, 40)}
            </TooltipTrigger>
            <TooltipContent>{row.title ?? "No title"}</TooltipContent>
          </Tooltip>
        ),
      },
      {
        key: "wordCount",
        label: "Words",
        align: "right" as const,
        sortFn: (a, b) => (a.wordCount ?? 0) - (b.wordCount ?? 0),
        render: (row) => <span>{row.wordCount ?? "--"}</span>,
      },
      {
        key: "responseTimeMs",
        label: "Response",
        align: "right" as const,
        sortFn: (a, b) => (a.responseTimeMs ?? 0) - (b.responseTimeMs ?? 0),
        render: (row) => (
          <span>
            {row.responseTimeMs != null ? `${row.responseTimeMs}ms` : "--"}
          </span>
        ),
      },
      {
        key: "crawlDepth",
        label: "Depth",
        align: "right" as const,
        sortFn: (a, b) => (a.crawlDepth ?? 0) - (b.crawlDepth ?? 0),
        render: (row) => <span>{row.crawlDepth ?? "--"}</span>,
      },
      {
        key: "inlinksCount",
        label: "Inlinks",
        align: "right" as const,
        sortFn: (a, b) => (a.inlinksCount ?? 0) - (b.inlinksCount ?? 0),
        render: (row) => <span>{row.inlinksCount ?? 0}</span>,
      },
    ],
    []
  );

  return (
    <DataTable
      data={pages}
      columns={columns}
      exportFilename="crawl-all-pages.csv"
      exportHeaders={[
        "URL",
        "Status Code",
        "Title",
        "Word Count",
        "Response Time (ms)",
        "Crawl Depth",
        "Inlinks",
      ]}
      exportRowFn={(row) => [
        row.url,
        String(row.statusCode ?? ""),
        row.title ?? "",
        String(row.wordCount ?? ""),
        String(row.responseTimeMs ?? ""),
        String(row.crawlDepth ?? ""),
        String(row.inlinksCount ?? 0),
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab: Response Codes
// ---------------------------------------------------------------------------

function ResponseCodesTab({ pages }: { pages: CrawlPage[] }) {
  const columns: ColumnDef<CrawlPage>[] = useMemo(
    () => [
      {
        key: "url",
        label: "URL",
        className: "max-w-[300px]",
        sortFn: (a, b) => a.url.localeCompare(b.url),
        render: (row) => <UrlCell url={row.url} />,
      },
      {
        key: "statusCode",
        label: "Status Code",
        sortFn: (a, b) => (a.statusCode ?? 0) - (b.statusCode ?? 0),
        render: (row) => <StatusBadge code={row.statusCode} />,
      },
      {
        key: "status",
        label: "Status",
        sortFn: (a, b) => (a.statusCode ?? 0) - (b.statusCode ?? 0),
        render: (row) => {
          const code = row.statusCode ?? 0;
          if (code >= 200 && code < 300) return <span className="text-green-600 dark:text-green-400">OK</span>;
          if (code >= 300 && code < 400) return <span className="text-blue-600 dark:text-blue-400">Redirect</span>;
          if (code >= 400 && code < 500) return <span className="text-amber-600 dark:text-amber-400">Client Error</span>;
          if (code >= 500) return <span className="text-red-600 dark:text-red-400">Server Error</span>;
          return <span className="text-muted-foreground">Unknown</span>;
        },
      },
      {
        key: "redirectUrl",
        label: "Redirect URL",
        className: "max-w-[300px]",
        sortFn: (a, b) => (a.redirectUrl ?? "").localeCompare(b.redirectUrl ?? ""),
        render: (row) =>
          row.redirectUrl ? (
            <Tooltip>
              <TooltipTrigger className="truncate block max-w-[300px] text-left">
                {truncate(row.redirectUrl, 50)}
              </TooltipTrigger>
              <TooltipContent>{row.redirectUrl}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      {
        key: "contentType",
        label: "Content Type",
        sortFn: (a, b) =>
          (a.contentType ?? "").localeCompare(b.contentType ?? ""),
        render: (row) => (
          <span className="text-muted-foreground text-sm">
            {row.contentType ? truncate(row.contentType, 30) : "--"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      data={pages}
      columns={columns}
      exportFilename="crawl-response-codes.csv"
      exportHeaders={[
        "URL",
        "Status Code",
        "Status",
        "Redirect URL",
        "Content Type",
      ]}
      exportRowFn={(row) => {
        const code = row.statusCode ?? 0;
        let status = "Unknown";
        if (code >= 200 && code < 300) status = "OK";
        else if (code >= 300 && code < 400) status = "Redirect";
        else if (code >= 400 && code < 500) status = "Client Error";
        else if (code >= 500) status = "Server Error";
        return [
          row.url,
          String(row.statusCode ?? ""),
          status,
          row.redirectUrl ?? "",
          row.contentType ?? "",
        ];
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab: Page Titles
// ---------------------------------------------------------------------------

function titleIssues(
  page: CrawlPage,
  allPages: CrawlPage[]
): string[] {
  const issues: string[] = [];
  if (!page.title) {
    issues.push("Missing");
  } else {
    if (page.title.length < 30) issues.push("Too short");
    if (page.title.length > 60) issues.push("Too long");
    const dupes = allPages.filter(
      (p) => p.id !== page.id && p.title === page.title && p.title
    );
    if (dupes.length > 0) issues.push("Duplicate");
  }
  return issues;
}

function PageTitlesTab({ pages }: { pages: CrawlPage[] }) {
  const pagesWithIssues = useMemo(
    () =>
      pages.map((p) => ({
        ...p,
        _titleIssues: titleIssues(p, pages),
        _titleLen: p.title?.length ?? 0,
      })),
    [pages]
  );

  type Row = (typeof pagesWithIssues)[number];

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        key: "url",
        label: "URL",
        className: "max-w-[260px]",
        sortFn: (a, b) => a.url.localeCompare(b.url),
        render: (row) => <UrlCell url={row.url} />,
      },
      {
        key: "title",
        label: "Title",
        className: "max-w-[300px]",
        sortFn: (a, b) => (a.title ?? "").localeCompare(b.title ?? ""),
        render: (row) => (
          <Tooltip>
            <TooltipTrigger className="truncate block max-w-[300px] text-left">
              {row.title || <span className="text-muted-foreground italic">Missing</span>}
            </TooltipTrigger>
            <TooltipContent>{row.title ?? "No title"}</TooltipContent>
          </Tooltip>
        ),
      },
      {
        key: "titleLen",
        label: "Length",
        align: "right" as const,
        sortFn: (a, b) => a._titleLen - b._titleLen,
        render: (row) => {
          const len = row._titleLen;
          const warn = len > 0 && (len < 30 || len > 60);
          return (
            <span className={warn ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
              {len}
            </span>
          );
        },
      },
      {
        key: "issues",
        label: "Issues",
        sortFn: (a, b) => a._titleIssues.length - b._titleIssues.length,
        render: (row) => <IssueBadges issues={row._titleIssues} />,
      },
    ],
    []
  );

  return (
    <DataTable
      data={pagesWithIssues}
      columns={columns}
      exportFilename="crawl-page-titles.csv"
      exportHeaders={["URL", "Title", "Title Length", "Issues"]}
      exportRowFn={(row) => [
        row.url,
        row.title ?? "",
        String(row._titleLen),
        row._titleIssues.join("; "),
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab: Meta Descriptions
// ---------------------------------------------------------------------------

function metaIssues(
  page: CrawlPage,
  allPages: CrawlPage[]
): string[] {
  const issues: string[] = [];
  if (!page.metaDescription) {
    issues.push("Missing");
  } else {
    if (page.metaDescription.length < 70) issues.push("Too short");
    if (page.metaDescription.length > 160) issues.push("Too long");
    const dupes = allPages.filter(
      (p) =>
        p.id !== page.id &&
        p.metaDescription === page.metaDescription &&
        p.metaDescription
    );
    if (dupes.length > 0) issues.push("Duplicate");
  }
  return issues;
}

function MetaDescriptionsTab({ pages }: { pages: CrawlPage[] }) {
  const pagesWithIssues = useMemo(
    () =>
      pages.map((p) => ({
        ...p,
        _metaIssues: metaIssues(p, pages),
        _metaLen: p.metaDescription?.length ?? 0,
      })),
    [pages]
  );

  type Row = (typeof pagesWithIssues)[number];

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        key: "url",
        label: "URL",
        className: "max-w-[260px]",
        sortFn: (a, b) => a.url.localeCompare(b.url),
        render: (row) => <UrlCell url={row.url} />,
      },
      {
        key: "metaDescription",
        label: "Meta Description",
        className: "max-w-[350px]",
        sortFn: (a, b) =>
          (a.metaDescription ?? "").localeCompare(b.metaDescription ?? ""),
        render: (row) => (
          <Tooltip>
            <TooltipTrigger className="truncate block max-w-[350px] text-left">
              {row.metaDescription || (
                <span className="text-muted-foreground italic">Missing</span>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {row.metaDescription ?? "No description"}
            </TooltipContent>
          </Tooltip>
        ),
      },
      {
        key: "metaLen",
        label: "Length",
        align: "right" as const,
        sortFn: (a, b) => a._metaLen - b._metaLen,
        render: (row) => {
          const len = row._metaLen;
          const warn = len > 0 && (len < 70 || len > 160);
          return (
            <span className={warn ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
              {len}
            </span>
          );
        },
      },
      {
        key: "issues",
        label: "Issues",
        sortFn: (a, b) => a._metaIssues.length - b._metaIssues.length,
        render: (row) => <IssueBadges issues={row._metaIssues} />,
      },
    ],
    []
  );

  return (
    <DataTable
      data={pagesWithIssues}
      columns={columns}
      exportFilename="crawl-meta-descriptions.csv"
      exportHeaders={["URL", "Meta Description", "Length", "Issues"]}
      exportRowFn={(row) => [
        row.url,
        row.metaDescription ?? "",
        String(row._metaLen),
        row._metaIssues.join("; "),
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab: Headings
// ---------------------------------------------------------------------------

function headingIssues(page: CrawlPage): string[] {
  const issues: string[] = [];
  const h1Arr = page.h1 ?? [];
  if (h1Arr.length === 0) issues.push("Missing H1");
  if (h1Arr.length > 1) issues.push("Multiple H1");
  if (h1Arr.some((h) => !h || h.trim() === "")) issues.push("Empty H1");
  return issues;
}

function HeadingsTab({ pages }: { pages: CrawlPage[] }) {
  const pagesWithIssues = useMemo(
    () =>
      pages.map((p) => ({
        ...p,
        _headingIssues: headingIssues(p),
        _h1Count: arrLen(p.h1),
        _h2Count: arrLen(p.h2),
      })),
    [pages]
  );

  type Row = (typeof pagesWithIssues)[number];

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        key: "url",
        label: "URL",
        className: "max-w-[260px]",
        sortFn: (a, b) => a.url.localeCompare(b.url),
        render: (row) => <UrlCell url={row.url} />,
      },
      {
        key: "h1",
        label: "H1",
        className: "max-w-[300px]",
        sortFn: (a, b) =>
          ((a.h1 ?? [])[0] ?? "").localeCompare((b.h1 ?? [])[0] ?? ""),
        render: (row) => {
          const h1Arr = row.h1 ?? [];
          const text = h1Arr.join(" | ");
          return (
            <Tooltip>
              <TooltipTrigger className="truncate block max-w-[300px] text-left">
                {text || (
                  <span className="text-muted-foreground italic">Missing</span>
                )}
              </TooltipTrigger>
              <TooltipContent>{text || "No H1"}</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        key: "h1Count",
        label: "H1 Count",
        align: "right" as const,
        sortFn: (a, b) => a._h1Count - b._h1Count,
        render: (row) => {
          const warn = row._h1Count === 0 || row._h1Count > 1;
          return (
            <span className={warn ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
              {row._h1Count}
            </span>
          );
        },
      },
      {
        key: "h2Count",
        label: "H2 Count",
        align: "right" as const,
        sortFn: (a, b) => a._h2Count - b._h2Count,
        render: (row) => <span>{row._h2Count}</span>,
      },
      {
        key: "issues",
        label: "Issues",
        sortFn: (a, b) => a._headingIssues.length - b._headingIssues.length,
        render: (row) => <IssueBadges issues={row._headingIssues} />,
      },
    ],
    []
  );

  return (
    <DataTable
      data={pagesWithIssues}
      columns={columns}
      exportFilename="crawl-headings.csv"
      exportHeaders={["URL", "H1", "H1 Count", "H2 Count", "Issues"]}
      exportRowFn={(row) => [
        row.url,
        (row.h1 ?? []).join(" | "),
        String(row._h1Count),
        String(row._h2Count),
        row._headingIssues.join("; "),
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab: Images
// ---------------------------------------------------------------------------

function ImagesTab({ pages }: { pages: CrawlPage[] }) {
  const pagesWithImages = useMemo(
    () =>
      pages.map((p) => {
        const imgs = p.images ?? [];
        return {
          ...p,
          _totalImages: imgs.length,
          _missingAlt: imgs.filter((i) => !i.alt || i.alt.trim() === "").length,
        };
      }),
    [pages]
  );

  type Row = (typeof pagesWithImages)[number];

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        key: "url",
        label: "URL",
        className: "max-w-[300px]",
        sortFn: (a, b) => a.url.localeCompare(b.url),
        render: (row) => <UrlCell url={row.url} />,
      },
      {
        key: "totalImages",
        label: "Total Images",
        align: "right" as const,
        sortFn: (a, b) => a._totalImages - b._totalImages,
        render: (row) => <span>{row._totalImages}</span>,
      },
      {
        key: "missingAlt",
        label: "Missing Alt",
        align: "right" as const,
        sortFn: (a, b) => a._missingAlt - b._missingAlt,
        render: (row) => (
          <span
            className={
              row._missingAlt > 0
                ? "text-amber-600 dark:text-amber-400 font-medium"
                : ""
            }
          >
            {row._missingAlt}
          </span>
        ),
      },
      {
        key: "expand",
        label: "Details",
        render: (row) =>
          row._totalImages > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedId(expandedId === row.id ? null : row.id);
              }}
              className="text-sm text-primary hover:underline"
            >
              {expandedId === row.id ? "Hide" : "Show"} images
            </button>
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
    ],
    [expandedId]
  );

  // Custom rendering because we need expandable rows
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("url");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return pagesWithImages;
    return pagesWithImages.filter((p) => p.url.toLowerCase().includes(q));
  }, [pagesWithImages, search]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortFn) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = col.sortFn!(a, b);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const handleExport = useCallback(() => {
    downloadCsv(
      "crawl-images.csv",
      ["URL", "Total Images", "Missing Alt", "Image URLs"],
      sorted.map((row) => [
        row.url,
        String(row._totalImages),
        String(row._missingAlt),
        (row.images ?? []).map((i) => i.src).join(" | "),
      ])
    );
  }, [sorted]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <TooltipProvider>
            <table className="w-full text-base">
              <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <tr className="border-b">
                  {columns.map((col) => (
                    <SortHeader
                      key={col.key}
                      label={col.label}
                      isActive={sortKey === col.key}
                      sortDir={sortDir}
                      align={col.align}
                      onClick={() => toggleSort(col.key)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2 ${col.align === "right" ? "text-right tabular-nums" : ""} ${col.className ?? ""}`}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                    {expandedId === row.id && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={columns.length} className="px-6 py-3">
                          <div className="space-y-1 text-sm max-h-[200px] overflow-auto">
                            {(row.images ?? []).map((img, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-3 py-1"
                              >
                                <span className="text-muted-foreground font-mono text-xs w-6 shrink-0">
                                  {i + 1}.
                                </span>
                                <span className="truncate flex-1 break-all">
                                  {img.src}
                                </span>
                                <span
                                  className={`shrink-0 text-xs ${!img.alt || img.alt.trim() === "" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
                                >
                                  {img.alt || "No alt"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No results found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {sorted.length} of {pagesWithImages.length} rows
        {search && ` (filtered by "${search}")`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Links
// ---------------------------------------------------------------------------

function LinksTab({ pages }: { pages: CrawlPage[] }) {
  const pagesWithLinks = useMemo(
    () =>
      pages.map((p) => ({
        ...p,
        _internalCount: arrLen(p.internalLinks),
        _externalCount: arrLen(p.externalLinks),
        _brokenCount: 0, // We don't have broken link data per-link yet
      })),
    [pages]
  );

  type Row = (typeof pagesWithLinks)[number];

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        key: "url",
        label: "URL",
        className: "max-w-[300px]",
        sortFn: (a, b) => a.url.localeCompare(b.url),
        render: (row) => <UrlCell url={row.url} />,
      },
      {
        key: "internalLinks",
        label: "Internal Links",
        align: "right" as const,
        sortFn: (a, b) => a._internalCount - b._internalCount,
        render: (row) => <span>{row._internalCount}</span>,
      },
      {
        key: "externalLinks",
        label: "External Links",
        align: "right" as const,
        sortFn: (a, b) => a._externalCount - b._externalCount,
        render: (row) => <span>{row._externalCount}</span>,
      },
      {
        key: "totalLinks",
        label: "Total",
        align: "right" as const,
        sortFn: (a, b) =>
          a._internalCount +
          a._externalCount -
          (b._internalCount + b._externalCount),
        render: (row) => (
          <span className="font-medium">
            {row._internalCount + row._externalCount}
          </span>
        ),
      },
      {
        key: "inlinksCount",
        label: "Inlinks",
        align: "right" as const,
        sortFn: (a, b) => (a.inlinksCount ?? 0) - (b.inlinksCount ?? 0),
        render: (row) => <span>{row.inlinksCount ?? 0}</span>,
      },
    ],
    []
  );

  return (
    <DataTable
      data={pagesWithLinks}
      columns={columns}
      exportFilename="crawl-links.csv"
      exportHeaders={[
        "URL",
        "Internal Links",
        "External Links",
        "Total Links",
        "Inlinks",
      ]}
      exportRowFn={(row) => [
        row.url,
        String(row._internalCount),
        String(row._externalCount),
        String(row._internalCount + row._externalCount),
        String(row.inlinksCount ?? 0),
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab: Redirects
// ---------------------------------------------------------------------------

interface RedirectRow {
  id: string;
  url: string;
  statusCode: number | null;
  redirectChain: Array<{ url: string; statusCode: number }>;
  finalUrl: string;
  hops: number;
}

function RedirectsTab({ pages }: { pages: CrawlPage[] }) {
  const redirectPages: RedirectRow[] = useMemo(() => {
    return pages
      .filter((p) => p.redirectChain && p.redirectChain.length > 0)
      .map((p) => {
        const chain = p.redirectChain!;
        return {
          id: p.id,
          url: p.url,
          statusCode: chain[0]?.statusCode ?? p.statusCode,
          redirectChain: chain,
          finalUrl: p.redirectUrl ?? p.url,
          hops: chain.length,
        };
      });
  }, [pages]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("hops");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return redirectPages;
    return redirectPages.filter((p) => p.url.toLowerCase().includes(q));
  }, [redirectPages, search]);

  const sorted = useMemo(() => {
    const sortFns: Record<string, (a: RedirectRow, b: RedirectRow) => number> = {
      url: (a, b) => a.url.localeCompare(b.url),
      statusCode: (a, b) => (a.statusCode ?? 0) - (b.statusCode ?? 0),
      hops: (a, b) => a.hops - b.hops,
      finalUrl: (a, b) => a.finalUrl.localeCompare(b.finalUrl),
    };
    const fn = sortFns[sortKey];
    if (!fn) return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = fn(a, b);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleExport = useCallback(() => {
    downloadCsv(
      "crawl-redirects.csv",
      ["Original URL", "Status Code", "Hops", "Redirect Chain", "Final URL"],
      sorted.map((row) => [
        row.url,
        String(row.statusCode ?? ""),
        String(row.hops),
        row.redirectChain.map((r) => `${r.statusCode}:${r.url}`).join(" -> "),
        row.finalUrl,
      ])
    );
  }, [sorted]);

  const columns = [
    { key: "url", label: "Original URL", align: "left" as const },
    { key: "statusCode", label: "Status", align: "left" as const },
    { key: "hops", label: "Hops", align: "right" as const },
    { key: "finalUrl", label: "Final URL", align: "left" as const },
    { key: "expand", label: "Chain", align: "left" as const },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {redirectPages.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No redirect chains detected.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-[600px] overflow-auto">
            <TooltipProvider>
              <table className="w-full text-base">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                  <tr className="border-b">
                    {columns.map((col) => (
                      <SortHeader
                        key={col.key}
                        label={col.label}
                        isActive={sortKey === col.key}
                        sortDir={sortDir}
                        align={col.align}
                        onClick={() => toggleSort(col.key)}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <Fragment key={row.id}>
                      <tr className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 max-w-[260px]">
                          <UrlCell url={row.url} />
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge code={row.statusCode} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={row.hops > 1 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                            {row.hops}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[260px]">
                          <UrlCell url={row.finalUrl} />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                            className="text-sm text-primary hover:underline"
                          >
                            {expandedId === row.id ? "Hide" : "Show"} chain
                          </button>
                        </td>
                      </tr>
                      {expandedId === row.id && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={columns.length} className="px-6 py-3">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                {urlPath(row.url)}
                              </span>
                              {row.redirectChain.map((hop, i) => (
                                <Fragment key={i}>
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    <ArrowRight className="size-3" />
                                    <Badge variant="secondary" className="text-[10px] font-mono">
                                      {hop.statusCode}
                                    </Badge>
                                  </span>
                                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                    {urlPath(hop.url)}
                                  </span>
                                </Fragment>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                        No results found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TooltipProvider>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {redirectPages.length} page{redirectPages.length !== 1 ? "s" : ""} with redirect chains
        {search && ` (showing ${sorted.length} filtered)`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Duplicates
// ---------------------------------------------------------------------------

function DuplicatesTab({ pages }: { pages: CrawlPage[] }) {
  const clusters = useMemo(() => {
    const hashPages = pages
      .filter((p) => p.contentHash)
      .map((p) => ({ url: p.url, hash: p.contentHash! }));
    return findDuplicateClusters(hashPages);
  }, [pages]);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleExport = useCallback(() => {
    downloadCsv(
      "crawl-duplicates.csv",
      ["Cluster", "Similarity %", "URLs"],
      clusters.map((c, i) => [
        String(i + 1),
        String(c.similarity),
        c.urls.join(" | "),
      ])
    );
  }, [clusters]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {clusters.length} duplicate cluster{clusters.length !== 1 ? "s" : ""} detected
          {" "}({clusters.reduce((sum, c) => sum + c.urls.length, 0)} pages total)
        </p>
        {clusters.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3.5 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {clusters.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No near-duplicate content detected.
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster, idx) => (
            <div key={idx} className="rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Copy className="size-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium">
                      Cluster {idx + 1}
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {cluster.urls.length} pages
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {cluster.similarity}% similar
                  </Badge>
                </div>
                {expandedIdx === idx ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>
              {expandedIdx === idx && (
                <div className="px-4 py-3 space-y-1 border-t">
                  <TooltipProvider>
                    {cluster.urls.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 py-1 text-sm">
                        <span className="text-muted-foreground font-mono text-xs w-6 shrink-0">
                          {i + 1}.
                        </span>
                        <Tooltip>
                          <TooltipTrigger className="truncate block text-left">
                            {urlPath(url)}
                          </TooltipTrigger>
                          <TooltipContent>{url}</TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </TooltipProvider>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Tabbed Component
// ---------------------------------------------------------------------------

const TAB_ITEMS = [
  { value: "all", label: "All Pages" },
  { value: "response-codes", label: "Response Codes" },
  { value: "titles", label: "Page Titles" },
  { value: "meta", label: "Meta Descriptions" },
  { value: "headings", label: "Headings" },
  { value: "images", label: "Images" },
  { value: "links", label: "Links" },
  { value: "redirects", label: "Redirects" },
  { value: "duplicates", label: "Duplicates" },
  { value: "tree", label: "Site Tree" },
] as const;

export function CrawlTabs({ pages }: CrawlTabsProps) {
  // Cast pages to expected shape with proper array types
  const typedPages: CrawlPage[] = useMemo(
    () =>
      pages.map((p) => ({
        ...p,
        h1: (p.h1 as string[] | null) ?? null,
        h2: (p.h2 as string[] | null) ?? null,
        internalLinks:
          (p.internalLinks as CrawlPage["internalLinks"]) ?? null,
        externalLinks:
          (p.externalLinks as CrawlPage["externalLinks"]) ?? null,
        images: (p.images as CrawlPage["images"]) ?? null,
        structuredData: (p.structuredData as unknown[] | null) ?? null,
        errors: (p.errors as string[] | null) ?? null,
        contentHash: (p.contentHash as string | null) ?? null,
        redirectChain:
          (p.redirectChain as CrawlPage["redirectChain"]) ?? null,
      })),
    [pages]
  );

  const siteTree = useMemo(
    () =>
      buildSiteTree(
        typedPages.map((p) => ({
          url: p.url,
          statusCode: p.statusCode,
          title: p.title,
          wordCount: p.wordCount,
          responseTimeMs: p.responseTimeMs,
          inlinksCount: p.inlinksCount,
        }))
      ),
    [typedPages]
  );

  return (
    <Tabs defaultValue="all">
      <div className="overflow-x-auto -mx-4 px-4 lg:-mx-6 lg:px-6">
        <TabsList variant="line">
          {TAB_ITEMS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="all">
        <AllPagesTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="response-codes">
        <ResponseCodesTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="titles">
        <PageTitlesTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="meta">
        <MetaDescriptionsTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="headings">
        <HeadingsTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="images">
        <ImagesTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="links">
        <LinksTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="redirects">
        <RedirectsTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="duplicates">
        <DuplicatesTab pages={typedPages} />
      </TabsContent>
      <TabsContent value="tree">
        <SiteTree tree={siteTree} />
      </TabsContent>
    </Tabs>
  );
}
