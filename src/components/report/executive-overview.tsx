import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { AuditIssue, CategoryScore, Grade } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/report/score-badge";
import { CATEGORY_LABELS } from "@/lib/ui-constants";
import { cn } from "@/lib/utils";
import { groupCategoryScores } from "@/lib/audit/category-groups";

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  pass: 3,
};

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 15,
  warning: 5,
  info: 1,
  pass: 0,
};

interface ExecutiveOverviewProps {
  overallScore: number;
  overallGrade: Grade;
  scanUrl: string;
  scanCreatedAt: string;
  issues: AuditIssue[];
  categoryScores: CategoryScore[];
  previousScore?: number | null;
  previousScanId?: string | null;
}

function TrendArrow({
  current,
  previous,
}: {
  current: number;
  previous: number | null | undefined;
}) {
  if (previous == null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
        <Minus className="size-3.5" />
        No prior scan
      </span>
    );
  }
  const delta = current - previous;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground text-sm tabular-nums">
        <Minus className="size-3.5" />
        Unchanged vs previous
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium tabular-nums">
        <ArrowUpRight className="size-3.5" />
        +{delta} vs previous scan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-medium tabular-nums">
      <ArrowDownRight className="size-3.5" />
      {delta} vs previous scan
    </span>
  );
}

interface RankedIssue {
  issue: AuditIssue;
  impact: number;
  frequency: number;
}

function rankTopIssues(issues: AuditIssue[], limit = 5): RankedIssue[] {
  // Group by ruleId; score = severity_weight × count_of_affected_elements.
  const byRule = new Map<string, { issue: AuditIssue; count: number }>();
  for (const i of issues) {
    if (i.severity === "pass") continue;
    const existing = byRule.get(i.ruleId);
    if (existing) {
      existing.count++;
      // Prefer the highest-severity representative for the card.
      if (
        (SEVERITY_RANK[i.severity] ?? 9) <
        (SEVERITY_RANK[existing.issue.severity] ?? 9)
      ) {
        existing.issue = i;
      }
    } else {
      byRule.set(i.ruleId, { issue: i, count: 1 });
    }
  }

  const ranked: RankedIssue[] = Array.from(byRule.values()).map((g) => ({
    issue: g.issue,
    frequency: g.count,
    impact: (SEVERITY_WEIGHT[g.issue.severity] ?? 0) * g.count,
  }));

  ranked.sort((a, b) => b.impact - a.impact);
  return ranked.slice(0, limit);
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical")
    return (
      <AlertCircle className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
    );
  if (severity === "warning")
    return (
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
    );
  return (
    <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
  );
}

export function ExecutiveOverview({
  overallScore,
  overallGrade,
  scanUrl,
  scanCreatedAt,
  issues,
  categoryScores,
  previousScore,
}: ExecutiveOverviewProps) {
  const topIssues = rankTopIssues(issues, 5);
  const grouped = groupCategoryScores(
    categoryScores.map((cs) => ({
      category: cs.category,
      score: cs.score,
      issueCount: cs.issueCount,
    })),
  );

  const date = new Date(scanCreatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const hostname = (() => {
    try {
      return new URL(scanUrl).hostname;
    } catch {
      return scanUrl;
    }
  })();

  const totalCritical = issues.filter((i) => i.severity === "critical").length;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="grid gap-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          {/* Left: Score */}
          <div className="flex items-center justify-center md:justify-start">
            <ScoreBadge
              score={overallScore}
              grade={overallGrade}
              size="lg"
            />
          </div>

          {/* Middle: URL + trend + date */}
          <div className="min-w-0 space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Scanned URL</p>
              <h2 className="text-xl font-semibold truncate">{hostname}</h2>
              <p className="text-sm text-muted-foreground truncate">
                {scanUrl}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TrendArrow current={overallScore} previous={previousScore} />
              <span className="text-sm text-muted-foreground">· {date}</span>
            </div>
          </div>

          {/* Right: summary badges */}
          <div className="flex flex-col gap-2 md:items-end">
            {totalCritical > 0 && (
              <Badge
                variant="destructive"
                className="font-medium"
              >
                {totalCritical} critical
              </Badge>
            )}
            <Badge variant="outline" className="font-medium">
              {issues.length} total findings
            </Badge>
          </div>
        </div>

        {/* Category strip */}
        {grouped.length > 0 && (
          <div className="mt-6 grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {grouped
              .filter((g) => g.category !== "ai-analysis")
              .map((g) => (
                <div
                  key={g.category}
                  className="rounded-lg border px-3 py-2"
                >
                  <p className="text-sm text-muted-foreground truncate">
                    {g.label}
                  </p>
                  <p
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      g.score >= 90
                        ? "text-emerald-600 dark:text-emerald-400"
                        : g.score >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {g.score}
                  </p>
                </div>
              ))}
          </div>
        )}

        {/* Top issues to fix */}
        {topIssues.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Top issues to fix</h3>
              <span className="text-sm text-muted-foreground">
                Ranked by impact × frequency
              </span>
            </div>
            <ul className="space-y-2">
              {topIssues.map((ranked) => {
                const { issue, frequency } = ranked;
                const categoryLabel =
                  CATEGORY_LABELS[issue.category] ?? issue.category;
                return (
                  <li
                    key={issue.ruleId}
                    className="flex items-start gap-3 rounded-lg border-l-4 border bg-card px-3 py-2"
                    style={{
                      borderLeftColor:
                        issue.severity === "critical"
                          ? "rgb(220 38 38)"
                          : issue.severity === "warning"
                            ? "rgb(217 119 6)"
                            : "rgb(37 99 235)",
                    }}
                  >
                    <SeverityIcon severity={issue.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-medium">
                          {issue.title}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {categoryLabel}
                        </Badge>
                        {frequency > 1 && (
                          <Badge variant="outline" className="text-xs">
                            {frequency} elements
                          </Badge>
                        )}
                      </div>
                      {issue.recommendation && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {issue.recommendation}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
