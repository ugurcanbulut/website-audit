/**
 * CSS analysis audit runner
 *
 * Uses @projectwallace/css-analyzer to gather statistical data about the
 * page's CSS and flags potential quality issues based on configurable
 * thresholds.
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

export interface CssRunnerInput {
  css: string;
  viewportName: string;
}

export interface CssRunnerOutput {
  issues: AuditIssueInput[];
  stats: Record<string, unknown>;
}

interface ThresholdCheck {
  /** Path segments used to reach the value inside the stats object. */
  paths: string[][];
  threshold: number;
  severity: AuditIssueInput["severity"];
  ruleId: string;
  title: string;
  description: string;
  recommendation: string;
}

const CHECKS: ThresholdCheck[] = [
  {
    paths: [
      ["values", "colors", "unique"],
      ["colors", "unique"],
      ["values", "colors", "totalUnique"],
    ],
    threshold: 20,
    severity: "info",
    ruleId: "css-color-count",
    title: "High number of unique colors",
    description:
      "The stylesheet defines more than 20 unique colors. This may indicate inconsistent use of a design token palette.",
    recommendation:
      "Consolidate colors into CSS custom properties or design tokens to ensure palette consistency.",
  },
  {
    paths: [
      ["values", "fontSizes", "unique"],
      ["fontSizes", "unique"],
      ["values", "fontSizes", "totalUnique"],
    ],
    threshold: 15,
    severity: "info",
    ruleId: "css-font-sizes",
    title: "High number of unique font sizes",
    description:
      "The stylesheet uses more than 15 unique font sizes. A well-defined typographic scale typically uses fewer sizes.",
    recommendation:
      "Adopt a typographic scale and use CSS custom properties or utility classes for consistent sizing.",
  },
  {
    paths: [
      ["declarations", "importants", "total"],
      ["declarations", "important", "total"],
      ["importants", "total"],
    ],
    threshold: 20,
    severity: "warning",
    ruleId: "css-important",
    title: "Excessive use of !important",
    description:
      "The stylesheet uses !important more than 20 times. Heavy use of !important is usually a sign of specificity wars and makes CSS harder to maintain.",
    recommendation:
      "Refactor selectors to rely on the natural cascade rather than !important overrides.",
  },
  {
    paths: [
      ["selectors", "specificity", "max"],
      ["selectors", "specificity", "highest"],
      ["specificity", "max"],
    ],
    threshold: 100,
    severity: "warning",
    ruleId: "css-specificity",
    title: "Very high selector specificity",
    description:
      "At least one selector has a specificity value exceeding 100. Extremely specific selectors are difficult to override and indicate structural issues.",
    recommendation:
      "Prefer low-specificity selectors (single classes). Avoid deeply nested selectors and ID-based styling.",
  },
  {
    paths: [
      ["declarations", "total"],
      ["declarations", "totalDeclarations"],
      ["totalDeclarations"],
    ],
    threshold: 5000,
    severity: "info",
    ruleId: "css-size",
    title: "Large CSS codebase",
    description:
      "The stylesheet contains more than 5,000 declarations. This may increase load time and maintenance burden.",
    recommendation:
      "Consider splitting the CSS into critical and non-critical bundles, removing unused rules, or adopting a utility-first methodology.",
  },
  {
    paths: [
      ["values", "fontFamilies", "unique"],
      ["fontFamilies", "unique"],
      ["values", "fontFamilies", "totalUnique"],
    ],
    threshold: 8,
    severity: "info",
    ruleId: "css-font-families",
    title: "Many different font families",
    description:
      "The stylesheet references more than 8 unique font families. Excessive font variety hurts visual consistency and increases page weight.",
    recommendation:
      "Limit font families to 2-3 and define them as CSS custom properties.",
  },
];

/**
 * Safely traverse a nested object using a list of property keys.
 * Returns `undefined` when the path does not resolve.
 */
function getNestedValue(
  obj: Record<string, unknown>,
  path: string[]
): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object")
      return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Try multiple property paths and return the first numeric value found.
 */
function resolveNumeric(
  stats: Record<string, unknown>,
  paths: string[][]
): number | undefined {
  for (const path of paths) {
    const val = getNestedValue(stats, path);
    if (typeof val === "number") return val;

    // Some versions return an array for "unique"; use its length.
    if (Array.isArray(val)) return val.length;
  }
  return undefined;
}

/**
 * Analyse a CSS string and produce quality-related audit issues.
 *
 * The function is resilient to API differences between versions of
 * @projectwallace/css-analyzer -- it tries multiple property paths for
 * each metric and silently skips checks whose data cannot be located.
 */
export async function runCssAnalysis(
  input: CssRunnerInput
): Promise<CssRunnerOutput> {
  let stats: Record<string, unknown> = {};

  try {
    const { analyze } = await import(
      /* webpackIgnore: true */ "@projectwallace/css-analyzer"
    );
    stats = analyze(input.css) as Record<string, unknown>;
  } catch (err) {
    console.error("[css-runner] Failed to analyse CSS:", err);
    return {
      issues: [
        {
          category: "css-quality",
          severity: "info",
          ruleId: "css-analysis-error",
          title: "CSS analysis could not be completed",
          description:
            "The CSS analyser encountered an error. CSS quality checks have been skipped for this page.",
          details: {
            error: err instanceof Error ? err.message : String(err),
            viewport: input.viewportName,
          },
        },
      ],
      stats,
    };
  }

  const issues: AuditIssueInput[] = [];
  let isFirstIssue = true;

  for (const check of CHECKS) {
    const value = resolveNumeric(stats, check.paths);
    if (value === undefined) continue;

    if (value > check.threshold) {
      const issue: AuditIssueInput = {
        category: "css-quality",
        severity: check.severity,
        ruleId: check.ruleId,
        title: check.title,
        description: `${check.description} (found ${value}).`,
        recommendation: check.recommendation,
        details: {
          value,
          threshold: check.threshold,
          viewport: input.viewportName,
          // Attach the full stats snapshot to the first issue for reference
          ...(isFirstIssue ? { stats } : {}),
        },
      };

      issues.push(issue);
      isFirstIssue = false;
    }
  }

  // If no threshold was exceeded, include the stats in a pass issue so
  // downstream consumers still have access to them.
  if (issues.length === 0) {
    issues.push({
      category: "css-quality",
      severity: "pass",
      ruleId: "css-quality-pass",
      title: "CSS quality checks passed",
      description:
        "No CSS quality issues exceeded the configured thresholds.",
      details: { stats, viewport: input.viewportName },
    });
  }

  return { issues, stats };
}
