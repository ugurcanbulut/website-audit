"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import type { AuditIssue, AuditCategory, IssueSeverity, Grade } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { SEVERITY_COLORS, CATEGORY_LABELS } from "@/lib/ui-constants";
import { ScoreBadge } from "@/components/report/score-badge";
import {
  groupFindings,
  sortFindingsBySeverity,
  elementImpactLabel,
  type Finding,
} from "@/lib/audit/findings";
import { useReportView } from "@/components/report/report-mode";
import { SuppressButton } from "@/components/report/suppress-button";
import { cn } from "@/lib/utils";

function getGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

interface CategoryDetailProps {
  category: AuditCategory;
  score: number;
  issues: AuditIssue[];
  issueCount: { critical: number; warning: number; info: number };
  scanId: string;
}

function RuleGroup({ finding, scanId }: { finding: Finding; scanId: string }) {
  const isClient = useReportView() === "client";
  const [expanded, setExpanded] = useState(finding.count <= 3); // Auto-expand small groups
  const { severity, elements, helpUrl, wcagTags } = finding;
  const colors = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info;

  const headerBody = (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-sm font-medium", colors.badge)}>
          {severity}
        </span>
        <span className="text-base font-semibold">{finding.title}</span>
        <Badge variant="secondary" className="text-sm">{finding.count} element{finding.count !== 1 ? "s" : ""}</Badge>
        {finding.viewports.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {finding.viewports.length === 1
              ? finding.viewports[0]
              : `${finding.viewports.length} viewports`}
          </span>
        )}
        {wcagTags && wcagTags.length > 0 && (
          <span className="text-sm text-muted-foreground">{wcagTags.join(", ")}</span>
        )}
      </div>
      {finding.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{finding.description}</p>
      )}
    </div>
  );

  const learnMore = helpUrl ? (
    <a
      href={helpUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-sm text-primary hover:underline shrink-0 flex items-center gap-1"
    >
      Learn more <ExternalLink className="size-3" />
    </a>
  ) : null;

  // Client mode: a clean finding card — count + recommendation, no per-element
  // CSS selectors / HTML / code fixes (internal-only technical detail).
  if (isClient) {
    return (
      <div className="rounded-lg border p-3">
        <div className="flex items-start gap-3">
          {headerBody}
          {learnMore}
        </div>
        {finding.recommendation && (
          <div className="mt-2 rounded bg-primary/5 border border-primary/10 p-2">
            <p className="text-sm font-medium text-primary mb-1">Recommendation</p>
            <p className="text-sm">{finding.recommendation}</p>
          </div>
        )}
      </div>
    );
  }

  // Internal mode: expandable group with the full per-element drill-down.
  // The expand toggle and the action buttons are siblings (no nested buttons).
  return (
    <div className="rounded-lg border">
      <div className="flex items-start gap-3 p-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="size-4 mt-0.5 shrink-0" /> : <ChevronRight className="size-4 mt-0.5 shrink-0" />}
          {headerBody}
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {learnMore}
          <SuppressButton scanId={scanId} ruleId={finding.ruleId} />
        </div>
      </div>

      {/* Element rows */}
      {expanded && (
        <div className="border-t divide-y">
          {elements.map((issue, i) => (
            <ElementRow key={issue.id ?? i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function ElementRow({ issue }: { issue: AuditIssue }) {
  const [showDetails, setShowDetails] = useState(false);
  const impact = elementImpactLabel(issue);

  return (
    <div className="px-3 py-2 hover:bg-muted/30 transition-colors">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-start gap-2 text-left text-sm"
      >
        {showDetails ? <ChevronDown className="size-3 mt-1 shrink-0" /> : <ChevronRight className="size-3 mt-1 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {issue.elementSelector && (
              <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[300px]">
                {issue.elementSelector}
              </code>
            )}
            {impact && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                {impact}
              </span>
            )}
            {issue.viewportName && (
              <span className="text-sm text-muted-foreground">{issue.viewportName}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{issue.description}</p>
        </div>
      </button>

      {showDetails && (
        <div className="ml-5 mt-2 space-y-2">
          {issue.elementHtml && (
            <div className="rounded bg-muted p-2">
              <p className="text-sm text-muted-foreground mb-1">HTML</p>
              <pre className="text-sm font-mono break-words whitespace-pre-wrap">{issue.elementHtml}</pre>
            </div>
          )}
          {issue.recommendation && (
            <div className="rounded bg-primary/5 border border-primary/10 p-2">
              <p className="text-sm font-medium text-primary mb-1">Fix</p>
              <p className="text-sm">{issue.recommendation}</p>
            </div>
          )}
          {/* Code fix from AI */}
          {(() => {
            const cf = issue.details?.codeFix;
            if (!cf || typeof cf !== "object") return null;
            const fix = cf as { before?: string; after?: string; language?: string };
            if (!fix.before || !fix.after) return null;
            return (
              <div className="rounded border overflow-hidden">
                <div className="grid grid-cols-2 divide-x text-sm font-mono">
                  <div className="p-2 bg-red-50/50 dark:bg-red-950/20">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-1 font-sans font-medium">Before</p>
                    <pre className="whitespace-pre-wrap break-words text-sm">{fix.before}</pre>
                  </div>
                  <div className="p-2 bg-green-50/50 dark:bg-green-950/20">
                    <p className="text-sm text-green-600 dark:text-green-400 mb-1 font-sans font-medium">After</p>
                    <pre className="whitespace-pre-wrap break-words text-sm">{fix.after}</pre>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export function CategoryDetail({ category, score, issues, issueCount, scanId }: CategoryDetailProps) {
  const [filter, setFilter] = useState<"all" | IssueSeverity>("all");
  const grade = getGrade(score);
  const label = CATEGORY_LABELS[category] ?? category;

  const filteredIssues =
    filter === "all" ? issues : issues.filter((i) => i.severity === filter);

  const findings = sortFindingsBySeverity(groupFindings(filteredIssues));
  const totalIssues = issueCount.critical + issueCount.warning + issueCount.info;

  return (
    <section id={`category-${category}`} className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{label}</h3>
          <ScoreBadge score={score} grade={grade} size="sm" />
        </div>
        <p className="text-sm text-muted-foreground">{totalIssues} issue{totalIssues !== 1 ? "s" : ""}</p>
      </div>

      {/* Severity filter */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "critical", "warning", "info"] as const).map((sev) => {
          const count = sev === "all" ? totalIssues : issueCount[sev as keyof typeof issueCount] ?? 0;
          if (sev !== "all" && count === 0) return null;
          return (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                filter === sev
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Rule groups */}
      <div className="space-y-3">
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No issues in this category.</p>
        ) : (
          findings.map((finding) => (
            <RuleGroup key={finding.ruleId} finding={finding} scanId={scanId} />
          ))
        )}
      </div>
    </section>
  );
}
