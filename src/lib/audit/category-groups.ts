import type { AuditCategory } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// 13 → 6 category consolidation (see docs/scoring-methodology.md).
// The six presentation categories align with the vocabulary of Lighthouse,
// Siteimprove, and Sitebulb so buyers recognize them immediately.
// ─────────────────────────────────────────────────────────────────────────────

export type PresentationCategory =
  | "performance"
  | "accessibility"
  | "seo"
  | "best-practices"
  | "security"
  | "ux-quality"
  | "ai-analysis"; // shown in the UI, excluded from scoring

export const PRESENTATION_CATEGORY_ORDER: PresentationCategory[] = [
  "performance",
  "accessibility",
  "seo",
  "best-practices",
  "security",
  "ux-quality",
  "ai-analysis",
];

export const PRESENTATION_CATEGORY_LABEL: Record<PresentationCategory, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  seo: "SEO",
  "best-practices": "Best Practices",
  security: "Security",
  "ux-quality": "UX Quality",
  "ai-analysis": "AI Insights",
};

export const PRESENTATION_CATEGORY_WEIGHT: Record<
  Exclude<PresentationCategory, "ai-analysis">,
  number
> = {
  accessibility: 25,
  performance: 20,
  seo: 15,
  "best-practices": 15,
  security: 15,
  "ux-quality": 10,
};

const INTERNAL_TO_PRESENTATION: Record<AuditCategory, PresentationCategory> = {
  performance: "performance",
  accessibility: "accessibility",
  seo: "seo",
  "best-practices": "best-practices",
  "html-quality": "best-practices",
  "css-quality": "best-practices",
  security: "security",
  responsive: "ux-quality",
  typography: "ux-quality",
  "touch-targets": "ux-quality",
  visual: "ux-quality",
  forms: "ux-quality",
  "ai-analysis": "ai-analysis",
};

export function toPresentationCategory(
  legacy: AuditCategory | string,
): PresentationCategory {
  return (
    INTERNAL_TO_PRESENTATION[legacy as AuditCategory] ?? "best-practices"
  );
}

export interface GroupedCategory {
  category: PresentationCategory;
  label: string;
  score: number;
  weight: number;
  issueCount: { critical: number; warning: number; info: number };
  // Which legacy categories rolled up into this presentation category, for
  // transparency in the UI ("includes axe-core accessibility + html-quality").
  sources: AuditCategory[];
}

/**
 * Aggregate per-legacy-category scores into per-presentation-category scores.
 * The score for each presentation category is a weighted average of its
 * constituent internal categories, weighted by their issue volume + a small
 * baseline so an internal category with zero issues still contributes.
 */
export function groupCategoryScores(
  scores: Array<{
    category: AuditCategory | string;
    score: number;
    issueCount: { critical: number; warning: number; info: number };
  }>,
): GroupedCategory[] {
  const buckets = new Map<
    PresentationCategory,
    {
      totalScore: number;
      totalWeight: number;
      issueCount: { critical: number; warning: number; info: number };
      sources: AuditCategory[];
    }
  >();

  for (const s of scores) {
    const presentation = toPresentationCategory(s.category);
    const issues =
      s.issueCount.critical + s.issueCount.warning + s.issueCount.info;
    const weight = 1 + issues;

    const bucket =
      buckets.get(presentation) ?? {
        totalScore: 0,
        totalWeight: 0,
        issueCount: { critical: 0, warning: 0, info: 0 },
        sources: [],
      };
    bucket.totalScore += s.score * weight;
    bucket.totalWeight += weight;
    bucket.issueCount.critical += s.issueCount.critical;
    bucket.issueCount.warning += s.issueCount.warning;
    bucket.issueCount.info += s.issueCount.info;
    if (!bucket.sources.includes(s.category as AuditCategory)) {
      bucket.sources.push(s.category as AuditCategory);
    }
    buckets.set(presentation, bucket);
  }

  const result: GroupedCategory[] = [];
  for (const [category, bucket] of buckets) {
    const score =
      bucket.totalWeight > 0
        ? Math.round(bucket.totalScore / bucket.totalWeight)
        : 0;
    const weight =
      category === "ai-analysis"
        ? 0
        : PRESENTATION_CATEGORY_WEIGHT[category];
    result.push({
      category,
      label: PRESENTATION_CATEGORY_LABEL[category],
      score,
      weight,
      issueCount: bucket.issueCount,
      sources: bucket.sources,
    });
  }

  result.sort(
    (a, b) =>
      PRESENTATION_CATEGORY_ORDER.indexOf(a.category) -
      PRESENTATION_CATEGORY_ORDER.indexOf(b.category),
  );
  return result;
}
