"use client";

import { useState } from "react";
import {
  ArrowRight,
  Plus,
  Minus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CrawlOption {
  id: string;
  seedUrl: string;
  createdAt: string;
  pagesCrawled: number;
}

interface CompareResult {
  crawlA: {
    id: string;
    seedUrl: string;
    createdAt: string;
    pageCount: number;
  };
  crawlB: {
    id: string;
    seedUrl: string;
    createdAt: string;
    pageCount: number;
  };
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
  added: string[];
  removed: string[];
  changed: Array<{
    url: string;
    changes: Array<{ field: string; before: string | null; after: string | null }>;
  }>;
}

interface CrawlCompareProps {
  crawls: CrawlOption[];
}

export function CrawlCompare({ crawls }: CrawlCompareProps) {
  const [crawlA, setCrawlA] = useState<string>("");
  const [crawlB, setCrawlB] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCompare() {
    if (!crawlA || !crawlB) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/crawls/compare?a=${crawlA}&b=${crawlB}`,
      );
      if (!res.ok) {
        setError("Failed to compare");
        return;
      }
      setResult(await res.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getHostname(url: string) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  return (
    <div className="space-y-6">
      {/* Picker */}
      <Card>
        <CardHeader>
          <CardTitle>Select Crawls to Compare</CardTitle>
          <CardDescription>
            Choose an older crawl (before) and a newer crawl (after) for the
            same site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-base font-medium mb-1 block">
                Before (older)
              </label>
              <Select value={crawlA} onValueChange={(v) => setCrawlA(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select crawl..." />
                </SelectTrigger>
                <SelectContent>
                  {crawls.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {getHostname(c.seedUrl)} - {formatDate(c.createdAt)} (
                      {c.pagesCrawled} pages)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="size-5 text-muted-foreground shrink-0 mb-2" />
            <div className="flex-1 min-w-[200px]">
              <label className="text-base font-medium mb-1 block">
                After (newer)
              </label>
              <Select value={crawlB} onValueChange={(v) => setCrawlB(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select crawl..." />
                </SelectTrigger>
                <SelectContent>
                  {crawls.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {getHostname(c.seedUrl)} - {formatDate(c.createdAt)} (
                      {c.pagesCrawled} pages)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleCompare}
              disabled={!crawlA || !crawlB || loading || crawlA === crawlB}
            >
              {loading ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="size-4 mr-2" />
              )}
              Compare
            </Button>
          </div>
          {error && (
            <p className="text-base text-destructive mt-2">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                  +{result.summary.added}
                </p>
                <p className="text-base text-muted-foreground">New Pages</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                  -{result.summary.removed}
                </p>
                <p className="text-base text-muted-foreground">Removed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {result.summary.changed}
                </p>
                <p className="text-base text-muted-foreground">Changed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-muted-foreground tabular-nums">
                  {result.summary.unchanged}
                </p>
                <p className="text-base text-muted-foreground">Unchanged</p>
              </CardContent>
            </Card>
          </div>

          {/* Added */}
          {result.added.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="size-4 text-green-500" /> New Pages (
                  {result.added.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {result.added.map((url) => (
                    <div
                      key={url}
                      className="flex items-center gap-2 py-1.5 text-base"
                    >
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-sm"
                      >
                        NEW
                      </Badge>
                      <span className="truncate">{url}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Removed */}
          {result.removed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Minus className="size-4 text-red-500" /> Removed Pages (
                  {result.removed.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {result.removed.map((url) => (
                    <div
                      key={url}
                      className="flex items-center gap-2 py-1.5 text-base"
                    >
                      <Badge
                        variant="outline"
                        className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800 text-sm"
                      >
                        REMOVED
                      </Badge>
                      <span className="truncate">{url}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Changed */}
          {result.changed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="size-4 text-amber-500" /> Changed Pages
                  ({result.changed.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {result.changed.map(({ url, changes }) => (
                    <div key={url} className="rounded-lg border p-3">
                      <p className="text-base font-medium truncate mb-2">
                        {url}
                      </p>
                      <div className="space-y-1.5">
                        {changes.map((c, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto_1fr] gap-2 items-center text-sm"
                          >
                            <span className="font-medium text-muted-foreground">
                              {c.field}
                            </span>
                            <span className="truncate text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded">
                              {c.before ?? "(empty)"}
                            </span>
                            <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                            <span className="truncate text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-2 py-0.5 rounded">
                              {c.after ?? "(empty)"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
