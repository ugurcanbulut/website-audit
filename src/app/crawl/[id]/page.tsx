import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { crawls, crawlPages } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/lib/button-variants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CrawlResultsTable } from "@/components/crawl/crawl-results-table";
import { CrawlAutoRefresh } from "@/components/crawl/crawl-auto-refresh";

export const dynamic = "force-dynamic";

interface CrawlPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrawlPage({ params }: CrawlPageProps) {
  const { id } = await params;

  const crawl = await db.query.crawls.findFirst({
    where: eq(crawls.id, id),
  });

  if (!crawl) notFound();

  const pages = await db.query.crawlPages.findMany({
    where: eq(crawlPages.crawlId, id),
  });

  const isActive = crawl.status === "pending" || crawl.status === "crawling";
  const config = crawl.config as Record<string, unknown> | null;
  const maxPages = (config?.maxPages as number) ?? 100;
  const progressPercent =
    maxPages > 0 ? Math.round((pages.length / maxPages) * 100) : 0;

  // Summary stats
  const avgResponseTime =
    pages.length > 0
      ? Math.round(
          pages.reduce((sum, p) => sum + (p.responseTimeMs ?? 0), 0) /
            pages.length,
        )
      : 0;

  const errorPages = pages.filter(
    (p) => (p.statusCode ?? 0) >= 400,
  ).length;

  const totalIssues = pages.reduce((sum, p) => {
    const errs = (p.errors as string[] | null) ?? [];
    return sum + errs.length;
  }, 0);

  const statusVariant = {
    pending: "secondary" as const,
    crawling: "default" as const,
    completed: "outline" as const,
    failed: "destructive" as const,
  };

  return (
    <>
      <SiteHeader title="Crawl Results" />
      {isActive && <CrawlAutoRefresh />}
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        {/* Header row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold truncate max-w-lg">
              {crawl.seedUrl}
            </h2>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  statusVariant[
                    crawl.status as keyof typeof statusVariant
                  ] ?? "secondary"
                }
              >
                {crawl.status}
              </Badge>
              <span className="text-base text-muted-foreground">
                {new Date(crawl.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <Link
                href={`/crawl/${id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh
              </Link>
            )}
            {pages.length > 0 && (
              <a
                href={`/api/crawls/${id}/export`}
                download
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Export CSV
              </a>
            )}
          </div>
        </div>

        {/* Progress bar (when crawling) */}
        {isActive && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-base">
              <span className="font-medium">Crawling...</span>
              <span className="text-muted-foreground">{pages.length} / {maxPages} pages</span>
            </div>
            <Progress value={Math.min(progressPercent, 100)} />
          </div>
        )}

        {/* Summary stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pages Crawled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{pages.length}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {avgResponseTime}
                <span className="text-base font-normal text-muted-foreground ml-0.5">
                  ms
                </span>
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Error Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{errorPages}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Issues Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{totalIssues}</p>
            </CardContent>
          </Card>
        </div>

        {/* Results table */}
        {pages.length > 0 ? (
          <CrawlResultsTable pages={pages} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {isActive
                ? "Crawl in progress. Pages will appear here as they are discovered."
                : "No pages were crawled."}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
