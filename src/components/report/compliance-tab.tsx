"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, XCircle, AlertCircle, ExternalLink, MinusCircle } from "lucide-react";
import type { AuditIssue } from "@/lib/types";
import {
  WCAG_22_AA_CRITERIA,
  evaluateCompliance,
  regulatoryMappingFor,
  type ComplianceStatus,
  type WcagLevel,
} from "@/lib/audit/wcag-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ComplianceTabProps {
  issues: AuditIssue[];
}

type StatusFilter = "all" | ComplianceStatus;
type LevelFilter = "all" | WcagLevel;

function StatusIcon({ status }: { status: ComplianceStatus }) {
  if (status === "pass")
    return (
      <CheckCircle2
        className="size-4 text-emerald-600 dark:text-emerald-400"
        aria-label="Passes"
      />
    );
  if (status === "fail")
    return (
      <XCircle
        className="size-4 text-red-600 dark:text-red-400"
        aria-label="Fails"
      />
    );
  if (status === "needs-review")
    return (
      <AlertCircle
        className="size-4 text-amber-600 dark:text-amber-400"
        aria-label="Needs manual review"
      />
    );
  return (
    <MinusCircle
      className="size-4 text-muted-foreground"
      aria-label="Not applicable"
    />
  );
}

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  "needs-review": "Needs manual review",
  "not-applicable": "Not applicable",
};

export function ComplianceTab({ issues }: ComplianceTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  const evaluated = useMemo(() => evaluateCompliance(issues), [issues]);

  const summary = useMemo(() => {
    const counts = { pass: 0, fail: 0, "needs-review": 0, "not-applicable": 0 };
    for (const r of evaluated) counts[r.status]++;
    const automatedTotal = counts.pass + counts.fail;
    const automatedPassRate =
      automatedTotal > 0
        ? Math.round((counts.pass / automatedTotal) * 100)
        : null;
    return { counts, automatedPassRate };
  }, [evaluated]);

  const filtered = evaluated.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (levelFilter !== "all" && r.criterion.level !== levelFilter) return false;
    return true;
  });

  const total = WCAG_22_AA_CRITERIA.length;

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <Card>
        <CardHeader>
          <CardTitle>WCAG 2.2 Level A + AA compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryStat
              label="Automated pass rate"
              value={
                summary.automatedPassRate != null
                  ? `${summary.automatedPassRate}%`
                  : "—"
              }
              hint={`${summary.counts.pass} passes of ${
                summary.counts.pass + summary.counts.fail
              } automated checks`}
              tone={
                summary.automatedPassRate == null
                  ? "neutral"
                  : summary.automatedPassRate >= 90
                    ? "good"
                    : summary.automatedPassRate >= 70
                      ? "warn"
                      : "bad"
              }
            />
            <SummaryStat
              label="Passing"
              value={String(summary.counts.pass)}
              hint="No automated failures"
              tone="good"
            />
            <SummaryStat
              label="Failing"
              value={String(summary.counts.fail)}
              hint={
                summary.counts.fail > 0
                  ? "Needs remediation"
                  : "None detected"
              }
              tone={summary.counts.fail > 0 ? "bad" : "good"}
            />
            <SummaryStat
              label="Needs review"
              value={String(summary.counts["needs-review"])}
              hint={`Manual testing required (of ${total} total criteria)`}
              tone="warn"
            />
          </div>

          <div className="mt-6 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Regulatory scope:</span>
            <Badge variant="outline">EAA</Badge>
            <Badge variant="outline">ADA Title II</Badge>
            <Badge variant="outline">Section 508</Badge>
            <Badge variant="outline">EN 301 549</Badge>
          </div>

          {/* Filters */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {(
              [
                ["all", "All"],
                ["fail", "Failing"],
                ["needs-review", "Needs review"],
                ["pass", "Passing"],
              ] as Array<[StatusFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  statusFilter === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
            <span className="w-px bg-border mx-1" />
            {(
              [
                ["all", "All levels"],
                ["A", "Level A"],
                ["AA", "Level AA"],
              ] as Array<[LevelFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setLevelFilter(value)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  levelFilter === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Criteria table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Criterion</th>
                  <th className="px-3 py-2 font-medium">Level</th>
                  <th className="px-3 py-2 font-medium">Principle</th>
                  <th className="px-3 py-2 font-medium text-right">
                    Affected elements
                  </th>
                  <th className="px-3 py-2 font-medium">Regulations</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ criterion, status, affectedElementCount }) => {
                  const regs = regulatoryMappingFor(criterion.level);
                  return (
                    <tr
                      key={criterion.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={status} />
                          <span
                            className={cn(
                              "text-sm",
                              status === "fail" &&
                                "text-red-700 dark:text-red-400 font-medium",
                              status === "needs-review" &&
                                "text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="font-mono text-sm tabular-nums">
                          {criterion.id}
                        </div>
                        <div>{criterion.title}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Badge
                          variant={criterion.level === "AA" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {criterion.level}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-top text-muted-foreground">
                        {criterion.principle}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums">
                        {affectedElementCount > 0 ? affectedElementCount : "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex gap-1 flex-wrap">
                          {regs.eaa && <Badge variant="outline" className="text-xs">EAA</Badge>}
                          {regs.adaTitleII && <Badge variant="outline" className="text-xs">ADA</Badge>}
                          {regs.section508 && <Badge variant="outline" className="text-xs">508</Badge>}
                          {regs.en301549 && <Badge variant="outline" className="text-xs">EN 301 549</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <a
                          href={criterion.understandingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-0.5 text-sm"
                        >
                          Understanding
                          <ExternalLink className="size-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No criteria match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const color =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-red-600 dark:text-red-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", color)}>{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}
