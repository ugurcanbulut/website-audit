"use client";

import { Fragment, useState, useMemo } from "react";
import { ChevronDown, ChevronUp, ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CrawlPage {
  id: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: unknown;
  h2: unknown;
  canonicalUrl: string | null;
  metaRobots: string | null;
  wordCount: number | null;
  responseTimeMs: number | null;
  contentSize: number | null;
  internalLinks: unknown;
  externalLinks: unknown;
  images: unknown;
  structuredData: unknown;
  hreflang: unknown;
  errors: unknown;
}

interface CrawlResultsTableProps {
  pages: CrawlPage[];
}

type SortKey =
  | "url"
  | "statusCode"
  | "title"
  | "metaDescription"
  | "wordCount"
  | "responseTimeMs"
  | "links"
  | "images";

type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(code: number | null): string {
  if (!code) return "text-muted-foreground";
  if (code >= 200 && code < 300) return "text-green-600 dark:text-green-400";
  if (code >= 300 && code < 400) return "text-blue-600 dark:text-blue-400";
  if (code >= 400 && code < 500) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function arrLen(val: unknown): number {
  return Array.isArray(val) ? val.length : 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrawlResultsTable({ pages }: CrawlResultsTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("url");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pages.filter((p) => p.url.toLowerCase().includes(q));
  }, [pages, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "url":
          cmp = a.url.localeCompare(b.url);
          break;
        case "statusCode":
          cmp = (a.statusCode ?? 0) - (b.statusCode ?? 0);
          break;
        case "title":
          cmp = (a.title ?? "").localeCompare(b.title ?? "");
          break;
        case "metaDescription":
          cmp = (a.metaDescription ?? "").localeCompare(
            b.metaDescription ?? "",
          );
          break;
        case "wordCount":
          cmp = (a.wordCount ?? 0) - (b.wordCount ?? 0);
          break;
        case "responseTimeMs":
          cmp = (a.responseTimeMs ?? 0) - (b.responseTimeMs ?? 0);
          break;
        case "links":
          cmp =
            arrLen(a.internalLinks) +
            arrLen(a.externalLinks) -
            (arrLen(b.internalLinks) + arrLen(b.externalLinks));
          break;
        case "images":
          cmp = arrLen(a.images) - arrLen(b.images);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function SortHeader({
    label,
    sortKeyVal,
    className,
  }: {
    label: string;
    sortKeyVal: SortKey;
    className?: string;
  }) {
    const isActive = sortKey === sortKeyVal;
    return (
      <th className={className}>
        <button
          type="button"
          onClick={() => toggleSort(sortKeyVal)}
          className="inline-flex items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <TooltipProvider>
          <table className="w-full text-base">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-8 px-2 py-2" />
                <SortHeader
                  label="URL"
                  sortKeyVal="url"
                  className="px-3 py-2 text-left"
                />
                <SortHeader
                  label="Status"
                  sortKeyVal="statusCode"
                  className="px-3 py-2 text-left"
                />
                <SortHeader
                  label="Title"
                  sortKeyVal="title"
                  className="px-3 py-2 text-left"
                />
                <SortHeader
                  label="Meta Description"
                  sortKeyVal="metaDescription"
                  className="px-3 py-2 text-left"
                />
                <th className="px-3 py-2 text-left text-sm font-medium text-muted-foreground">
                  H1
                </th>
                <SortHeader
                  label="Words"
                  sortKeyVal="wordCount"
                  className="px-3 py-2 text-right"
                />
                <SortHeader
                  label="Time"
                  sortKeyVal="responseTimeMs"
                  className="px-3 py-2 text-right"
                />
                <SortHeader
                  label="Links"
                  sortKeyVal="links"
                  className="px-3 py-2 text-right"
                />
                <SortHeader
                  label="Images"
                  sortKeyVal="images"
                  className="px-3 py-2 text-right"
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((page) => {
                const isExpanded = expandedId === page.id;
                const h1Arr = (page.h1 as string[] | null) ?? [];
                const h2Arr = (page.h2 as string[] | null) ?? [];
                const internalLinks = arrLen(page.internalLinks);
                const externalLinks = arrLen(page.externalLinks);
                const imageCount = arrLen(page.images);
                const images =
                  (page.images as Array<{
                    src: string;
                    alt: string;
                  }> | null) ?? [];
                const imgMissingAlt = images.filter(
                  (i) => !i.alt || i.alt.trim() === "",
                ).length;
                const errors = (page.errors as string[] | null) ?? [];
                const urlPath = (() => {
                  try {
                    return new URL(page.url).pathname;
                  } catch {
                    return page.url;
                  }
                })();

                return (
                  <Fragment key={page.id}>
                    <tr
                      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : page.id)
                      }
                    >
                      <td className="px-2 py-2 text-center">
                        {isExpanded ? (
                          <ChevronUp className="size-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        <Tooltip>
                          <TooltipTrigger className="truncate block max-w-[200px] text-left">
                            {truncate(urlPath, 40)}
                          </TooltipTrigger>
                          <TooltipContent>{page.url}</TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`font-mono font-medium ${statusColor(page.statusCode)}`}
                        >
                          {page.statusCode ?? "--"}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[180px]">
                        <Tooltip>
                          <TooltipTrigger className="truncate block max-w-[180px] text-left">
                            {truncate(page.title, 35)}
                          </TooltipTrigger>
                          <TooltipContent>
                            {page.title ?? "No title"}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-2 max-w-[180px]">
                        <Tooltip>
                          <TooltipTrigger className="truncate block max-w-[180px] text-left">
                            {truncate(page.metaDescription, 35)}
                          </TooltipTrigger>
                          <TooltipContent>
                            {page.metaDescription ?? "No description"}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-2 max-w-[120px] truncate">
                        {truncate(h1Arr.join(", "), 25)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {page.wordCount ?? "--"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {page.responseTimeMs != null
                          ? `${page.responseTimeMs}ms`
                          : "--"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {internalLinks + externalLinks}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {imageCount}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-base">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Full URL
                              </p>
                              <a
                                href={page.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline break-all"
                              >
                                {page.url}
                              </a>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Title ({page.title?.length ?? 0} chars)
                              </p>
                              <p>{page.title || "None"}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Meta Description (
                                {page.metaDescription?.length ?? 0} chars)
                              </p>
                              <p>{page.metaDescription || "None"}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                H1 Tags ({h1Arr.length})
                              </p>
                              <p>{h1Arr.join(" | ") || "None"}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                H2 Tags ({h2Arr.length})
                              </p>
                              <p>
                                {truncate(h2Arr.join(" | "), 100) || "None"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Canonical URL
                              </p>
                              <p className="break-all">
                                {page.canonicalUrl || "None"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Meta Robots
                              </p>
                              <p>{page.metaRobots || "None"}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Links
                              </p>
                              <p>
                                {internalLinks} internal, {externalLinks}{" "}
                                external
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Images
                              </p>
                              <p>
                                {imageCount} total
                                {imgMissingAlt > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    , {imgMissingAlt} missing alt
                                  </span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">
                                Content Size
                              </p>
                              <p>
                                {page.contentSize != null
                                  ? `${(page.contentSize / 1024).toFixed(1)} KB`
                                  : "Unknown"}
                              </p>
                            </div>
                            {errors.length > 0 && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <p className="text-sm font-medium text-destructive mb-1">
                                  Errors ({errors.length})
                                </p>
                                <ul className="list-disc list-inside text-destructive text-sm space-y-0.5">
                                  {errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TooltipProvider>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        Showing {sorted.length} of {pages.length} pages
        {search && ` (filtered by "${search}")`}
      </p>
    </div>
  );
}

