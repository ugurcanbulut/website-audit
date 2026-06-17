/**
 * Finding grouping — the canonical "group repeated violations into one finding"
 * layer shared by the report UI and the PDF export.
 *
 * An audit produces one `AuditIssue` row PER affected element, so a single rule
 * violated on 30 buttons shows up as 30 issues. Listing 30 near-identical cards
 * is noise; reviewers want one finding ("30 buttons missing an accessible
 * name") with the affected elements underneath. This module collapses issues
 * that share a `ruleId` into a `Finding`, preserving every element so the
 * internal/full view keeps complete detail while summaries can show counts.
 *
 * Previously this grouping was duplicated (and subtly inconsistent) inside
 * `category-detail.tsx` and `executive-overview.tsx`; both now consume this.
 */

import type { AuditIssue, AuditCategory, IssueSeverity } from "@/lib/types";

// Lower rank = more severe. Shared so every surface sorts findings identically.
export const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  pass: 3,
};

// Mirrors the deduction weights in `scoring.ts`; used to rank findings by the
// damage they do (weight × number of affected elements).
export const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 15,
  warning: 5,
  info: 1,
  pass: 0,
};

export interface Finding {
  /** Stable rule identity the elements were grouped on. */
  ruleId: string;
  category: AuditCategory;
  /** Rule-level title (element-specific suffixes stripped). */
  title: string;
  /** Representative (highest-severity) element's description. */
  description: string;
  /** Worst severity across all affected elements. */
  severity: IssueSeverity;
  helpUrl?: string;
  wcagTags?: string[];
  recommendation?: string;
  /** Every affected element, full detail preserved (internal view needs this). */
  elements: AuditIssue[];
  /** elements.length — the affected-element count shown in summaries. */
  count: number;
  /** Distinct viewports the rule was violated on. */
  viewports: string[];
  /** severity_weight(worst) × count — ranking signal. */
  impact: number;
}

/**
 * Per-element titles often embed element specifics after a colon
 * (e.g. "Small touch target: button (30×30px)"). The finding header wants the
 * rule-level prefix so all elements collapse under one stable label.
 */
function ruleTitle(issue: AuditIssue): string {
  const head = issue.title.split(":")[0]?.trim();
  return head && head.length > 0 ? head : issue.title;
}

/**
 * Group issues by `ruleId` into findings. The representative element (used for
 * the finding's title/description/recommendation) is the highest-severity one,
 * with first-seen order as a stable tie-break.
 */
export function groupFindings(issues: AuditIssue[]): Finding[] {
  const groups = new Map<string, AuditIssue[]>();
  for (const issue of issues) {
    const list = groups.get(issue.ruleId);
    if (list) list.push(issue);
    else groups.set(issue.ruleId, [issue]);
  }

  const findings: Finding[] = [];
  for (const [ruleId, elements] of groups) {
    let rep = elements[0];
    for (const el of elements) {
      if ((SEVERITY_RANK[el.severity] ?? 9) < (SEVERITY_RANK[rep.severity] ?? 9)) {
        rep = el;
      }
    }
    const viewports = Array.from(
      new Set(
        elements.map((e) => e.viewportName).filter((v): v is string => !!v),
      ),
    );
    findings.push({
      ruleId,
      category: rep.category,
      title: ruleTitle(rep),
      description: rep.description,
      severity: rep.severity,
      helpUrl: rep.helpUrl ?? (rep.details?.helpUrl as string | undefined),
      wcagTags: rep.wcagTags ?? (rep.details?.wcagTags as string[] | undefined),
      recommendation: rep.recommendation,
      elements,
      count: elements.length,
      viewports,
      impact: (SEVERITY_WEIGHT[rep.severity] ?? 0) * elements.length,
    });
  }
  return findings;
}

/** Findings sorted most-severe-first (then by impact). */
export function sortFindingsBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sev = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    return sev !== 0 ? sev : b.impact - a.impact;
  });
}

/** Top findings ranked by impact (weight × affected count); `pass` excluded. */
export function rankFindings(findings: Finding[], limit?: number): Finding[] {
  const sorted = findings
    .filter((f) => f.severity !== "pass")
    .sort((a, b) => b.impact - a.impact);
  return limit != null ? sorted.slice(0, limit) : sorted;
}

/**
 * A finding rolled up across every page of a whole-site audit: how many pages
 * it appears on and the total affected elements site-wide.
 */
export interface SiteFinding {
  ruleId: string;
  category: AuditCategory;
  title: string;
  description: string;
  severity: IssueSeverity;
  helpUrl?: string;
  wcagTags?: string[];
  recommendation?: string;
  /** Distinct pages (scans) where the rule fired. */
  pageCount: number;
  /** Total affected element instances across all pages. */
  elementCount: number;
  impact: number;
}

/**
 * Merge per-page findings (one Finding[] per audited page) into site-wide
 * findings keyed by ruleId. The representative is the highest-severity instance
 * across pages. Sorted worst-severity first, then by spread (pages affected),
 * then by total elements — so "critical issue on every page" floats to the top.
 */
export function mergeSiteFindings(perPage: Finding[][]): SiteFinding[] {
  const map = new Map<string, { rep: Finding; pages: number; elements: number }>();
  for (const findings of perPage) {
    for (const f of findings) {
      const entry = map.get(f.ruleId);
      if (entry) {
        entry.pages += 1;
        entry.elements += f.count;
        if ((SEVERITY_RANK[f.severity] ?? 9) < (SEVERITY_RANK[entry.rep.severity] ?? 9)) {
          entry.rep = f;
        }
      } else {
        map.set(f.ruleId, { rep: f, pages: 1, elements: f.count });
      }
    }
  }

  return Array.from(map.values())
    .map(({ rep, pages, elements }) => ({
      ruleId: rep.ruleId,
      category: rep.category,
      title: rep.title,
      description: rep.description,
      severity: rep.severity,
      helpUrl: rep.helpUrl,
      wcagTags: rep.wcagTags,
      recommendation: rep.recommendation,
      pageCount: pages,
      elementCount: elements,
      impact: (SEVERITY_WEIGHT[rep.severity] ?? 0) * elements,
    }))
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
        b.pageCount - a.pageCount ||
        b.elementCount - a.elementCount,
    );
}

/**
 * A concise, measurable impact label for a single affected element, pulled from
 * the runner's `details` (e.g. a 30×30px touch target, a Lighthouse
 * displayValue, a failing header value). Returns undefined when the rule has no
 * quantifiable per-element metric — the description already carries the detail.
 */
export function elementImpactLabel(issue: AuditIssue): string | undefined {
  const d = issue.details;
  if (!d) return undefined;

  // Touch targets — small: actual size vs the 44×44 minimum.
  if (typeof d.width === "number" && typeof d.height === "number") {
    return `${d.width}×${d.height}px`;
  }
  // Touch targets — too close: edge distance.
  if (typeof d.distance === "number") {
    return `${d.distance}px apart`;
  }
  // Lighthouse audits carry a human-readable measurement.
  if (typeof d.displayValue === "string" && d.displayValue.length > 0) {
    return d.displayValue;
  }
  // Security / CSS runners record the offending value.
  if (typeof d.currentValue === "string" && d.currentValue.length > 0) {
    return d.currentValue;
  }
  if (typeof d.value === "string" && d.value.length > 0) {
    return d.value;
  }
  return undefined;
}
