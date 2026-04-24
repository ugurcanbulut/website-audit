"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  MinusCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { AuditIssue } from "@/lib/types";
import {
  WCAG_22_AA_CRITERIA,
  evaluateCompliance,
  regulatoryMappingFor,
  type ComplianceStatus,
  type WcagLevel,
  type CriterionResult,
} from "@/lib/audit/wcag-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ComplianceTabProps {
  issues: AuditIssue[];
}

type StatusFilter = "fail" | "needs-review" | "pass" | "all";
type LevelFilter = "all" | WcagLevel;

const STATUS_ORDER: Record<ComplianceStatus, number> = {
  fail: 0,
  "needs-review": 1,
  pass: 2,
  "not-applicable": 3,
};

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  "needs-review": "Needs manual review",
  "not-applicable": "Not applicable",
};

function StatusIcon({
  status,
  className,
}: {
  status: ComplianceStatus;
  className?: string;
}) {
  const cls = cn("size-4 shrink-0", className);
  if (status === "pass")
    return (
      <CheckCircle2
        className={cn(cls, "text-emerald-600 dark:text-emerald-400")}
        aria-label="Passes"
      />
    );
  if (status === "fail")
    return (
      <XCircle
        className={cn(cls, "text-red-600 dark:text-red-400")}
        aria-label="Fails"
      />
    );
  if (status === "needs-review")
    return (
      <AlertCircle
        className={cn(cls, "text-amber-600 dark:text-amber-400")}
        aria-label="Needs manual review"
      />
    );
  return (
    <MinusCircle
      className={cn(cls, "text-muted-foreground")}
      aria-label="Not applicable"
    />
  );
}

/**
 * Group the scan's audit_issues by the axe rule id embedded in their ruleId
 * (format: "axe-<rule-id>"). Used to surface each WCAG criterion's
 * underlying element-level violations inside expanded rows.
 */
function indexIssuesByAxeRule(
  issues: AuditIssue[],
): Map<string, AuditIssue[]> {
  const index = new Map<string, AuditIssue[]>();
  for (const issue of issues) {
    if (issue.category !== "accessibility") continue;
    if (issue.severity === "pass") continue;
    if (!issue.ruleId.startsWith("axe-")) continue;
    const ruleId = issue.ruleId.replace(/^axe-/, "");
    const list = index.get(ruleId) ?? [];
    list.push(issue);
    index.set(ruleId, list);
  }
  return index;
}

function CriterionRow({
  result,
  byRule,
  isExpanded,
  onToggle,
}: {
  result: CriterionResult;
  byRule: Map<string, AuditIssue[]>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { criterion, status, failingRules, affectedElementCount } = result;
  const regs = regulatoryMappingFor(criterion.level);
  const canExpand =
    (status === "fail" && failingRules.length > 0) ||
    status === "needs-review" ||
    criterion.axeRuleIds.length > 0;

  return (
    <>
      <tr
        className={cn(
          "border-b last:border-0 transition-colors",
          canExpand && "cursor-pointer hover:bg-muted/40",
          isExpanded && "bg-muted/30",
        )}
        onClick={canExpand ? onToggle : undefined}
      >
        <td className="px-3 py-3 align-top">
          <div className="flex items-center gap-2">
            {canExpand ? (
              isExpanded ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-4" />
            )}
            <StatusIcon status={status} />
          </div>
        </td>
        <td className="px-3 py-3 align-top min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {criterion.id}
            </span>
            <Badge
              variant={criterion.level === "AA" ? "default" : "secondary"}
              className="text-xs"
            >
              {criterion.level}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {criterion.principle}
            </span>
          </div>
          <div className="text-sm font-medium mt-0.5">{criterion.title}</div>
          <div
            className={cn(
              "text-sm mt-1",
              status === "fail" && "text-red-700 dark:text-red-400",
              status === "needs-review" &&
                "text-amber-700 dark:text-amber-400",
              status === "pass" && "text-muted-foreground",
            )}
          >
            {STATUS_LABELS[status]}
            {affectedElementCount > 0 && (
              <span className="ml-1 tabular-nums">
                · {affectedElementCount} element
                {affectedElementCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex gap-1 flex-wrap">
            {regs.eaa && <Badge variant="outline" className="text-xs">EAA</Badge>}
            {regs.adaTitleII && <Badge variant="outline" className="text-xs">ADA</Badge>}
            {regs.section508 && <Badge variant="outline" className="text-xs">508</Badge>}
            {regs.en301549 && (
              <Badge variant="outline" className="text-xs">EN 301 549</Badge>
            )}
          </div>
        </td>
        <td className="px-3 py-3 align-top whitespace-nowrap">
          <a
            href={criterion.understandingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline inline-flex items-center gap-0.5 text-sm"
          >
            Understanding
            <ExternalLink className="size-3" />
          </a>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b bg-muted/10">
          <td colSpan={4} className="px-3 py-4">
            <CriterionDetail
              result={result}
              byRule={byRule}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function CriterionDetail({
  result,
  byRule,
}: {
  result: CriterionResult;
  byRule: Map<string, AuditIssue[]>;
}) {
  const { criterion, status, failingRules, passingRules } = result;

  if (status === "needs-review") {
    return (
      <div className="space-y-3 text-sm">
        <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Requires manual testing
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            No automated rule can reliably detect this criterion. A human must
            evaluate the page against the WCAG Understanding document to
            confirm compliance.
          </p>
        </div>
        {criterion.axeRuleIds.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Related automated rules:{" "}
            <span className="font-mono">
              {criterion.axeRuleIds.join(", ")}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (status === "pass") {
    return (
      <div className="text-sm text-muted-foreground">
        Automated checks passed for rules:{" "}
        <span className="font-mono">
          {passingRules.length > 0
            ? passingRules.join(", ")
            : criterion.axeRuleIds.join(", ")}
        </span>
        . Manual testing may still find issues; use the Understanding
        reference to verify.
      </div>
    );
  }

  // Fail
  return (
    <div className="space-y-4">
      {failingRules.map((ruleId) => {
        const elementIssues = byRule.get(ruleId) ?? [];
        const rep = elementIssues[0];
        return (
          <div key={ruleId} className="rounded-md border bg-card p-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">
                    axe-{ruleId}
                  </span>
                  <span className="text-sm font-medium">
                    {rep?.title ?? "Accessibility violation"}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {elementIssues.length} element
                    {elementIssues.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {rep?.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {rep.description}
                  </p>
                )}
                {rep?.recommendation && (
                  <p className="text-sm mt-2">
                    <span className="font-medium">How to fix:</span>{" "}
                    {rep.recommendation}
                  </p>
                )}
              </div>
              {rep?.helpUrl && (
                <a
                  href={rep.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5 text-sm shrink-0"
                >
                  axe reference
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            {elementIssues.length > 0 && (
              <div className="mt-3 space-y-2">
                {elementIssues.slice(0, 8).map((issue) => (
                  <div
                    key={issue.id}
                    className="text-sm rounded-sm border bg-muted/30 px-2 py-1.5 space-y-1"
                  >
                    {issue.elementSelector && (
                      <code className="block text-xs font-mono break-all text-muted-foreground">
                        {issue.elementSelector}
                      </code>
                    )}
                    {issue.elementHtml && (
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-background rounded px-2 py-1 border">
                        {issue.elementHtml.slice(0, 400)}
                        {issue.elementHtml.length > 400 && "…"}
                      </pre>
                    )}
                  </div>
                ))}
                {elementIssues.length > 8 && (
                  <p className="text-xs text-muted-foreground">
                    … and {elementIssues.length - 8} more element
                    {elementIssues.length - 8 === 1 ? "" : "s"}. See Issues tab
                    for the full list.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ComplianceTab({ issues }: ComplianceTabProps) {
  // Default landing filter: "Failing" — most actionable. User can broaden.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("fail");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const evaluated = useMemo(() => evaluateCompliance(issues), [issues]);
  const byRule = useMemo(() => indexIssuesByAxeRule(issues), [issues]);

  const counts = useMemo(() => {
    const c = { pass: 0, fail: 0, "needs-review": 0, "not-applicable": 0 };
    for (const r of evaluated) c[r.status]++;
    return c;
  }, [evaluated]);

  const automatedTotal = counts.pass + counts.fail;
  const automatedPassRate =
    automatedTotal > 0 ? Math.round((counts.pass / automatedTotal) * 100) : null;

  const filtered = useMemo(() => {
    const list = evaluated.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (levelFilter !== "all" && r.criterion.level !== levelFilter) return false;
      return true;
    });
    // Sort: fail first, then needs-review, then pass. Within status, by criterion id.
    list.sort((a, b) => {
      const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (s !== 0) return s;
      return a.criterion.id.localeCompare(b.criterion.id, undefined, {
        numeric: true,
      });
    });
    return list;
  }, [evaluated, statusFilter, levelFilter]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const total = WCAG_22_AA_CRITERIA.length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>WCAG 2.2 Level A + AA compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryStat
              label="Automated pass rate"
              value={automatedPassRate != null ? `${automatedPassRate}%` : "—"}
              hint={`${counts.pass} of ${automatedTotal} automated checks`}
              tone={
                automatedPassRate == null
                  ? "neutral"
                  : automatedPassRate >= 90
                    ? "good"
                    : automatedPassRate >= 70
                      ? "warn"
                      : "bad"
              }
            />
            <SummaryStat
              label="Failing"
              value={String(counts.fail)}
              hint={counts.fail > 0 ? "Needs remediation" : "None detected"}
              tone={counts.fail > 0 ? "bad" : "good"}
            />
            <SummaryStat
              label="Needs review"
              value={String(counts["needs-review"])}
              hint="Manual testing required"
              tone="warn"
            />
            <SummaryStat
              label="Passing"
              value={String(counts.pass)}
              hint={`of ${total} total criteria`}
              tone="good"
            />
          </div>

          <div className="mt-6 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Regulatory scope:
            </span>
            <Badge variant="outline">EAA</Badge>
            <Badge variant="outline">ADA Title II</Badge>
            <Badge variant="outline">Section 508</Badge>
            <Badge variant="outline">EN 301 549</Badge>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            {(
              [
                ["fail", `Failing (${counts.fail})`],
                ["needs-review", `Needs review (${counts["needs-review"]})`],
                ["pass", `Passing (${counts.pass})`],
                ["all", `All (${total})`],
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

      {/* Criteria */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium w-14">Status</th>
                  <th className="px-3 py-2 font-medium">Criterion</th>
                  <th className="px-3 py-2 font-medium">Regulations</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((result) => (
                  <CriterionRow
                    key={result.criterion.id}
                    result={result}
                    byRule={byRule}
                    isExpanded={expanded.has(result.criterion.id)}
                    onToggle={() => toggleExpanded(result.criterion.id)}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
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
