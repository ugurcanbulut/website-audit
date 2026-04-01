/**
 * Lighthouse audit runner
 *
 * Runs Google Lighthouse against an open Chromium instance via the remote
 * debugging port, then normalises the results into AuditIssueInput records.
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

export interface LighthouseRunnerInput {
  url: string;
  debuggingPort: number;
  categories?: string[];
  formFactor?: "desktop" | "mobile";
}

export interface LighthouseRunnerOutput {
  issues: AuditIssueInput[];
  categoryScores: {
    performance?: number;
    accessibility?: number;
    bestPractices?: number;
    seo?: number;
  };
  lhr: unknown;
}

/** Map a Lighthouse category key to the audit issue category string. */
const CATEGORY_KEY_MAP: Record<string, string> = {
  performance: "performance",
  "best-practices": "best-practices",
  seo: "seo",
  accessibility: "accessibility",
};

/**
 * Derive a severity level from a Lighthouse audit score (0-1).
 *   0       -> critical (complete failure)
 *   < 0.5   -> warning
 *   >= 0.5  -> info
 */
function scoreSeverity(score: number): AuditIssueInput["severity"] {
  if (score === 0) return "critical";
  if (score < 0.5) return "warning";
  return "info";
}

/**
 * Run Lighthouse against `input.url` using the already-open Chromium instance
 * at the given remote debugging port.
 *
 * Returns normalised issues, per-category scores and the raw LHR for
 * downstream consumers that need additional data.
 */
export async function runLighthouse(
  input: LighthouseRunnerInput
): Promise<LighthouseRunnerOutput> {
  const onlyCategories = input.categories ?? [
    "performance",
    "best-practices",
    "seo",
  ];

  // Dynamic import so lighthouse is not bundled eagerly
  const lighthouse = (await import(/* webpackIgnore: true */ "lighthouse"))
    .default;

  const result = await lighthouse(input.url, {
    port: input.debuggingPort,
    output: "json",
    logLevel: "error",
    onlyCategories,
    formFactor: input.formFactor ?? "desktop",
    screenEmulation: input.formFactor === "mobile"
      ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75 }
      : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1 },
    throttling: input.formFactor === "mobile"
      ? { cpuSlowdownMultiplier: 4, downloadThroughputKbps: 1600, uploadThroughputKbps: 750, rttMs: 150 }
      : undefined,
  });

  if (!result) {
    throw new Error("Lighthouse returned no result");
  }
  const lhr = result.lhr;

  // ------------------------------------------------------------------
  // Extract category scores
  // ------------------------------------------------------------------
  const categoryScores: LighthouseRunnerOutput["categoryScores"] = {};

  if (lhr.categories) {
    if (lhr.categories.performance?.score != null) {
      categoryScores.performance = Math.round(
        lhr.categories.performance.score * 100
      );
    }
    if (lhr.categories.accessibility?.score != null) {
      categoryScores.accessibility = Math.round(
        lhr.categories.accessibility.score * 100
      );
    }
    if (lhr.categories["best-practices"]?.score != null) {
      categoryScores.bestPractices = Math.round(
        lhr.categories["best-practices"].score * 100
      );
    }
    if (lhr.categories.seo?.score != null) {
      categoryScores.seo = Math.round(lhr.categories.seo.score * 100);
    }
  }

  // ------------------------------------------------------------------
  // Build a reverse map: audit-id -> category name
  // ------------------------------------------------------------------
  const auditCategoryMap = new Map<string, string>();

  for (const catKey of Object.keys(lhr.categories ?? {})) {
    const cat = lhr.categories[catKey];
    if (!cat?.auditRefs) continue;

    const issueCategory = CATEGORY_KEY_MAP[catKey] ?? catKey;

    for (const ref of cat.auditRefs) {
      // Only set if not already assigned (first category wins)
      if (!auditCategoryMap.has(ref.id)) {
        auditCategoryMap.set(ref.id, issueCategory);
      }
    }
  }

  // ------------------------------------------------------------------
  // Map failed audits to issues
  // ------------------------------------------------------------------
  const issues: AuditIssueInput[] = [];

  for (const [auditId, audit] of Object.entries(lhr.audits ?? {})) {
    const a = audit as {
      score: number | null;
      title: string;
      description: string;
      displayValue?: string;
      details?: Record<string, unknown>;
    };

    // Skip audits that passed, are informational, or are not applicable
    if (a.score === null || a.score >= 1) continue;

    const category = auditCategoryMap.get(auditId) ?? "performance";

    // Attempt to extract a useful recommendation from the description.
    // Lighthouse descriptions often contain a markdown link at the end
    // e.g. "Some text. [Learn more](url)." -- we strip the link part for
    // the recommendation and keep the prose.
    const recommendation = a.description
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();

    issues.push({
      category,
      severity: scoreSeverity(a.score),
      ruleId: `lighthouse-${auditId}`,
      title: a.title,
      description: a.description,
      recommendation: recommendation || undefined,
      details: {
        score: a.score,
        displayValue: a.displayValue ?? null,
        auditDetails: a.details ?? null,
      },
    });
  }

  return { issues, categoryScores, lhr };
}
