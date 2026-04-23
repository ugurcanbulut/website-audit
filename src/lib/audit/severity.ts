import type { IssueSeverity } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Unified severity model
//
// Internally audit_issues.severity is stored as one of 'critical' | 'warning'
// | 'info' | 'pass' for backwards compatibility with existing data. This
// module provides a 5-tier presentation layer aligned with the industry
// convention (Sitebulb, SEMrush): Critical · High · Medium · Low · Pass.
//
// The mapping respects legacy data so old scans continue to render sensibly.
// ─────────────────────────────────────────────────────────────────────────────

export type UnifiedSeverity = "critical" | "high" | "medium" | "low" | "pass";

export const UNIFIED_SEVERITY_ORDER: Record<UnifiedSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  pass: 4,
};

export const UNIFIED_SEVERITY_WEIGHT: Record<UnifiedSeverity, number> = {
  critical: 15,
  high: 8,
  medium: 3,
  low: 1,
  pass: 0,
};

export const UNIFIED_SEVERITY_LABEL: Record<UnifiedSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  pass: "Pass",
};

/**
 * Map the legacy stored severity string to the unified 5-tier presentation
 * value. Legacy values mostly come from three sources:
 *   - axe-core: critical / serious → 'critical'; moderate → 'warning'; minor → 'info'
 *   - Lighthouse: score 0 → 'critical'; <0.5 → 'warning'; ≥0.5 → 'info'
 *   - custom rules: 'critical' | 'warning' | 'info' | 'pass'
 *
 * We split the coarse 'warning' bucket into High vs Medium when we can infer
 * the original impact from details.impact (axe) or details.score (Lighthouse).
 * Missing signal defaults to 'medium' for 'warning' and 'low' for 'info'.
 */
export function toUnifiedSeverity(
  legacy: IssueSeverity | string,
  details?: Record<string, unknown> | null,
): UnifiedSeverity {
  if (legacy === "critical") return "critical";
  if (legacy === "pass") return "pass";

  if (legacy === "warning") {
    const impact = details?.impact as string | undefined;
    if (impact === "serious") return "critical";
    if (impact === "moderate") return "high";
    const score = details?.score as number | undefined;
    if (typeof score === "number" && score < 0.5) return "high";
    return "medium";
  }

  if (legacy === "info") {
    const impact = details?.impact as string | undefined;
    if (impact === "minor") return "low";
    const score = details?.score as number | undefined;
    if (typeof score === "number" && score >= 0.9) return "low";
    if (typeof score === "number" && score >= 0.5) return "medium";
    return "low";
  }

  return "medium";
}

/**
 * Compare function usable by Array.prototype.sort; orders most severe first.
 */
export function compareUnifiedSeverity(
  a: UnifiedSeverity,
  b: UnifiedSeverity,
): number {
  return UNIFIED_SEVERITY_ORDER[a] - UNIFIED_SEVERITY_ORDER[b];
}
