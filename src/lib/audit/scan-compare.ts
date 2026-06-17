/**
 * Before/after diff between two scans of the same URL (Phase 4 baseline).
 * Findings are matched by ruleId: a rule present only in the current scan is a
 * regression (added), only in the baseline is resolved (fixed), in both is
 * persisting — with the affected-element count delta surfaced.
 */

import { SEVERITY_RANK, type Finding } from "./findings";

export interface FindingDelta {
  finding: Finding; // current-scan finding (or baseline, for fixed)
  prevCount: number;
  currCount: number;
}

export interface ScanDiff {
  added: Finding[]; // new in the current scan (regressions)
  fixed: Finding[]; // present in the baseline, gone now (resolved)
  changed: FindingDelta[]; // in both, element count changed
  unchanged: FindingDelta[]; // in both, same count
}

function bySeverityThenImpact(a: Finding, b: Finding) {
  return (
    (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
    b.impact - a.impact
  );
}

export function diffFindings(baseline: Finding[], current: Finding[]): ScanDiff {
  const prevByRule = new Map(baseline.map((f) => [f.ruleId, f]));
  const currByRule = new Map(current.map((f) => [f.ruleId, f]));

  const added: Finding[] = [];
  const changed: FindingDelta[] = [];
  const unchanged: FindingDelta[] = [];

  for (const f of current) {
    const prev = prevByRule.get(f.ruleId);
    if (!prev) {
      added.push(f);
    } else if (prev.count !== f.count) {
      changed.push({ finding: f, prevCount: prev.count, currCount: f.count });
    } else {
      unchanged.push({ finding: f, prevCount: prev.count, currCount: f.count });
    }
  }

  const fixed = baseline.filter((f) => !currByRule.has(f.ruleId));

  added.sort(bySeverityThenImpact);
  fixed.sort(bySeverityThenImpact);
  changed.sort((a, b) => bySeverityThenImpact(a.finding, b.finding));
  unchanged.sort((a, b) => bySeverityThenImpact(a.finding, b.finding));

  return { added, fixed, changed, unchanged };
}
