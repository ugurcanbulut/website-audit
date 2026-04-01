/**
 * Axe-core audit runner
 *
 * Transforms axe-core violation and incomplete results (collected during the
 * browser capture phase) into normalised AuditIssueInput records.
 */

export interface AuditIssueInput {
  category: string;
  severity: "critical" | "warning" | "info" | "pass";
  ruleId: string;
  title: string;
  description: string;
  elementSelector?: string;
  elementHtml?: string;
  recommendation?: string;
  details?: Record<string, unknown>;
}

interface AxeNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

interface AxeViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  help: string;
  description: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeNode[];
}

interface AxeIncomplete {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  help: string;
  description: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
}

export interface AxeRunnerInput {
  axeResults: {
    violations: AxeViolation[];
    incomplete?: AxeIncomplete[];
  };
  viewportName: string;
}

const IMPACT_SEVERITY_MAP: Record<
  AxeViolation["impact"],
  AuditIssueInput["severity"]
> = {
  critical: "critical",
  serious: "critical",
  moderate: "warning",
  minor: "info",
};

/**
 * Process axe-core results into a flat list of audit issues.
 *
 * Each violation node produces a separate issue so individual DOM elements can
 * be identified in the report.  Incomplete results are also included at
 * info-level since they indicate potential (but unconfirmed) problems.
 */
export function processAxeResults(input: AxeRunnerInput): AuditIssueInput[] {
  const { axeResults, viewportName } = input;
  const issues: AuditIssueInput[] = [];

  // --- Violations ---
  for (const violation of axeResults.violations) {
    const severity = IMPACT_SEVERITY_MAP[violation.impact] ?? "warning";

    for (const node of violation.nodes) {
      issues.push({
        category: "accessibility",
        severity,
        ruleId: `axe-${violation.id}`,
        title: violation.help,
        description: violation.description,
        elementSelector: node.target[0],
        elementHtml: node.html,
        recommendation: node.failureSummary ?? undefined,
        details: {
          helpUrl: violation.helpUrl,
          impact: violation.impact,
          tags: violation.tags,
          viewport: viewportName,
        },
      });
    }
  }

  // --- Incomplete (needs-review) results ---
  if (axeResults.incomplete) {
    for (const item of axeResults.incomplete) {
      for (const node of item.nodes) {
        issues.push({
          category: "accessibility",
          severity: "info",
          ruleId: `axe-${item.id}`,
          title: `[Needs Review] ${item.help}`,
          description: item.description,
          elementSelector: node.target[0],
          elementHtml: node.html,
          recommendation:
            node.failureSummary ??
            "Manual review is required to determine if this element is accessible.",
          details: {
            helpUrl: item.helpUrl,
            impact: item.impact,
            incomplete: true,
            viewport: viewportName,
          },
        });
      }
    }
  }

  return issues;
}
