/**
 * HTMLHint audit runner
 *
 * Lints raw page HTML with HTMLHint and normalises the messages into
 * AuditIssueInput records.
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

export interface HtmlRunnerInput {
  html: string;
  viewportName: string;
}

/** Maximum number of issues to return to avoid flooding the report. */
const MAX_ISSUES = 50;

/** HTMLHint ruleset -- covers the most impactful quality checks. */
const HTMLHINT_RULES: Record<string, boolean> = {
  "tagname-lowercase": true,
  "attr-lowercase": true,
  "attr-value-double-quotes": true,
  "doctype-first": true,
  "tag-pair": true,
  "spec-char-escape": true,
  "id-unique": true,
  "src-not-empty": true,
  "attr-no-duplication": true,
  "title-require": true,
  "alt-require": true,
};

/**
 * Run HTMLHint on the given HTML string and return normalised audit issues.
 */
export async function runHtmlHint(
  input: HtmlRunnerInput
): Promise<AuditIssueInput[]> {
  const htmlhintModule = await import(/* webpackIgnore: true */ "htmlhint");
  const HTMLHint = htmlhintModule.HTMLHint ?? htmlhintModule.default?.HTMLHint ?? htmlhintModule.default;

  const results = HTMLHint.verify(input.html, HTMLHINT_RULES);

  const issues: AuditIssueInput[] = [];

  for (const result of results) {
    if (issues.length >= MAX_ISSUES) break;

    const severity: AuditIssueInput["severity"] =
      result.type === "error" ? "warning" : "info";

    issues.push({
      category: "html-quality",
      severity,
      ruleId: `htmlhint-${result.rule.id}`,
      title: result.rule.description,
      description: result.message,
      recommendation: `Fix the HTML issue reported by rule "${result.rule.id}" at line ${result.line}, col ${result.col}.`,
      details: {
        line: result.line,
        col: result.col,
        evidence: result.evidence,
        viewport: input.viewportName,
      },
    });
  }

  return issues;
}
