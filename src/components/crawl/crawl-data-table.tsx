"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Search,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { getHttpStatusColor } from "@/lib/ui-constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDef<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  sortFn?: (a: T, b: T) => number;
  render: (row: T) => React.ReactNode;
  className?: string;
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

export function truncate(str: string | null | undefined, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

export function arrLen(val: unknown): number {
  return Array.isArray(val) ? val.length : 0;
}

export function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][]
) {
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
// Shared cell components
// ---------------------------------------------------------------------------

export function UrlCell({ url }: { url: string }) {
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

export function StatusBadge({ code }: { code: number | null }) {
  return (
    <Badge variant={statusBadgeVariant(code)}>
      <span className={`font-mono text-[11px] ${statusColor(code)}`}>
        {code ?? "--"}
      </span>
    </Badge>
  );
}

export function IssueBadges({ issues }: { issues: string[] }) {
  if (issues.length === 0)
    return <span className="text-muted-foreground">--</span>;
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

// ---------------------------------------------------------------------------
// Sort header
// ---------------------------------------------------------------------------

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
    <th
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
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

// ---------------------------------------------------------------------------
// Reusable sort / filter / export hook
// ---------------------------------------------------------------------------

export function useTableState<T extends { url: string }>(
  data: T[],
  columns: ColumnDef<T>[],
  defaultSortKey?: string,
  defaultSortDir: SortDir = "asc"
) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>(
    defaultSortKey ?? columns[0]?.key ?? ""
  );
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);

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

  return { search, setSearch, sortKey, sortDir, toggleSort, filtered, sorted };
}

// ---------------------------------------------------------------------------
// DataTable component
// ---------------------------------------------------------------------------

export function DataTable<T extends { id: string; url: string }>({
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
  const { search, setSearch, sortKey, sortDir, toggleSort, sorted } =
    useTableState(data, columns);

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
        <div className="max-h-[400px] md:max-h-[600px] overflow-auto">
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
// TableShell -- for tabs that need custom row rendering (expandable rows, etc.)
// ---------------------------------------------------------------------------

export function TableShell({
  search,
  setSearch,
  onExport,
  totalLabel,
  children,
}: {
  search: string;
  setSearch: (v: string) => void;
  onExport: () => void;
  totalLabel: string;
  children: React.ReactNode;
}) {
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
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[400px] md:max-h-[600px] overflow-auto">
          <TooltipProvider>{children}</TooltipProvider>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{totalLabel}</p>
    </div>
  );
}

export { SortHeader };
export type { SortDir };
