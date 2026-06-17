import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import type { AuditIssue, CategoryScore, Grade } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/report/score-badge";
import { CATEGORY_LABELS } from "@/lib/ui-constants";
import { cn } from "@/lib/utils";
import { groupCategoryScores } from "@/lib/audit/category-groups";
import { groupFindings, rankFindings } from "@/lib/audit/findings";
import { evaluateCompliance } from "@/lib/audit/wcag-matrix";

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
  const findings = groupFindings(issues);
  const topFindings = rankFindings(findings, 5);
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

  const criticalFindings = findings.filter((f) => f.severity === "critical").length;

  // WCAG 2.2 AA compliance posture (recomputed from the same issues the
  // Compliance tab uses) for an at-a-glance verdict in the summary.
  const compliance = evaluateCompliance(issues);
  const failCount = compliance.filter((c) => c.status === "fail").length;
  const reviewCount = compliance.filter((c) => c.status === "needs-review").length;
  const passCount = compliance.filter((c) => c.status === "pass").length;

  const verdict =
    overallScore >= 90
      ? "Strong result — only minor issues remain."
      : overallScore >= 70
        ? "Close, but a few areas need work before client delivery."
        : criticalFindings > 0
          ? `${criticalFindings} critical finding${criticalFindings === 1 ? "" : "s"} must be resolved before this is client-ready.`
          : "Multiple categories are below target and need attention.";

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
            <p className="text-sm font-medium text-foreground">{verdict}</p>
          </div>

          {/* Right: summary badges */}
          <div className="flex flex-col gap-2 md:items-end">
            {criticalFindings > 0 && (
              <Badge
                variant="destructive"
                className="font-medium"
              >
                {criticalFindings} critical
              </Badge>
            )}
            <Badge variant="outline" className="font-medium">
              {findings.length} finding{findings.length !== 1 ? "s" : ""} · {issues.length} element{issues.length !== 1 ? "s" : ""}
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

        {/* WCAG 2.2 AA compliance posture */}
        <div className="mt-6 rounded-lg border p-4">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex items-center gap-2">
              {failCount > 0 ? (
                <ShieldAlert className="size-4 text-red-600 dark:text-red-400" />
              ) : (
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <h3 className="text-base font-semibold">
                Accessibility compliance — WCAG 2.2 AA
              </h3>
            </div>
            <div className="flex items-center gap-3 text-sm tabular-nums">
              <span className="font-medium text-red-600 dark:text-red-400">
                {failCount} failing
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {reviewCount} need review
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {passCount} pass
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Maps to EAA · ADA Title II · Section 508 · EN 301 549.{" "}
            {failCount > 0
              ? `${failCount} criteria fail automated checks — see the Compliance tab for the regulatory breakdown.`
              : "No automated WCAG failures detected; manual review of the flagged criteria is still required."}
          </p>
        </div>

        {/* Top issues to fix */}
        {topFindings.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Top issues to fix</h3>
              <span className="text-sm text-muted-foreground">
                Ranked by impact × affected elements
              </span>
            </div>
            <ul className="space-y-2">
              {topFindings.map((finding) => {
                const categoryLabel =
                  CATEGORY_LABELS[finding.category] ?? finding.category;
                return (
                  <li
                    key={finding.ruleId}
                    className="flex items-start gap-3 rounded-lg border-l-4 border bg-card px-3 py-2"
                    style={{
                      borderLeftColor:
                        finding.severity === "critical"
                          ? "rgb(220 38 38)"
                          : finding.severity === "warning"
                            ? "rgb(217 119 6)"
                            : "rgb(37 99 235)",
                    }}
                  >
                    <SeverityIcon severity={finding.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-medium">
                          {finding.title}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {categoryLabel}
                        </Badge>
                        {finding.count > 1 && (
                          <Badge variant="outline" className="text-xs">
                            {finding.count} elements
                          </Badge>
                        )}
                      </div>
                      {finding.recommendation && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {finding.recommendation}
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
