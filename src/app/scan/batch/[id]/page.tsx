import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { scanBatches, scans } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScoreBadge } from "@/components/report/score-badge";
import { BatchAutoRefresh } from "@/components/scan/batch-refresh";
import { cn } from "@/lib/utils";
import type { Grade } from "@/lib/types";

export const dynamic = "force-dynamic";

interface BatchPageProps {
  params: Promise<{ id: string }>;
}

export default async function BatchPage({ params }: BatchPageProps) {
  const { id } = await params;

  const batch = await db.query.scanBatches.findFirst({
    where: eq(scanBatches.id, id),
  });
  if (!batch) notFound();

  const batchScans = await db.query.scans.findMany({
    where: eq(scans.batchId, id),
  });

  const completed = batchScans.filter(
    (s) => s.status === "completed"
  ).length;
  const failed = batchScans.filter(
    (s) => s.status === "failed" || s.status === "cancelled"
  ).length;
  const pending = batchScans.length - completed - failed;
  const progress =
    batchScans.length > 0
      ? Math.round((completed / batchScans.length) * 100)
      : 0;

  const completedScores = batchScans
    .filter((s) => s.status === "completed" && s.overallScore != null)
    .map((s) => s.overallScore!);
  const avgScore =
    completedScores.length > 0
      ? Math.round(
          completedScores.reduce((a, b) => a + b, 0) / completedScores.length
        )
      : null;
  const avgGrade: Grade | null =
    avgScore != null
      ? avgScore >= 90
        ? "A"
        : avgScore >= 80
          ? "B"
          : avgScore >= 70
            ? "C"
            : avgScore >= 60
              ? "D"
              : "F"
      : null;

  const isComplete = pending === 0;

  return (
    <>
      <SiteHeader title={batch.name ?? "Batch Scan"} />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        {/* Progress */}
        {!isComplete && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  Scanning {batchScans.length} URLs...
                </p>
                <span className="text-sm text-muted-foreground">
                  {completed}/{batchScans.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {completed} completed · {failed} failed · {pending} remaining
              </p>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {isComplete && avgScore != null && avgGrade && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Average Score</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {avgScore}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">Grade {avgGrade}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>URLs Scanned</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {batchScans.length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {completed} completed · {failed} failed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Score Range</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {completedScores.length > 0
                    ? `${Math.min(...completedScores)} - ${Math.max(...completedScores)}`
                    : "--"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Lowest to highest
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scan list */}
        <Card>
          <CardHeader>
            <CardTitle>Scans</CardTitle>
            <CardDescription>
              {batchScans.length} URLs in this batch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {batchScans.map((scan) => {
                const hostname = (() => {
                  try {
                    return new URL(scan.url).hostname;
                  } catch {
                    return scan.url;
                  }
                })();
                const statusColor =
                  {
                    completed:
                      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                    failed:
                      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                    cancelled: "bg-muted text-muted-foreground",
                    pending: "bg-muted text-muted-foreground",
                    scanning:
                      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                    auditing:
                      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                    analyzing:
                      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
                  }[scan.status] ?? "bg-muted text-muted-foreground";

                return (
                  <Link
                    key={scan.id}
                    href={`/scan/${scan.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{hostname}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {scan.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          statusColor
                        )}
                      >
                        {scan.status}
                      </span>
                      {scan.status === "completed" &&
                        scan.overallScore != null &&
                        scan.overallGrade && (
                          <ScoreBadge
                            score={scan.overallScore}
                            grade={scan.overallGrade as Grade}
                            size="sm"
                          />
                        )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Auto-refresh if not complete */}
        {!isComplete && <BatchAutoRefresh />}
      </div>
    </>
  );
}
