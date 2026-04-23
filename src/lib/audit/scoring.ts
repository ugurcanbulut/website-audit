import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, auditIssues, categoryScores } from "@/lib/db/schema";
import type { AuditCategory, Grade } from "@/lib/types";

const SEVERITY_WEIGHTS = {
  critical: 15,
  warning: 5,
  info: 1,
  pass: 0,
};

// Categories that use Lighthouse scores directly when available
const LIGHTHOUSE_CATEGORIES = new Set(["performance", "best-practices", "seo"]);

// All categories in the system
const ALL_CATEGORIES: AuditCategory[] = [
  "accessibility",
  "responsive",
  "performance",
  "typography",
  "touch-targets",
  "forms",
  "visual",
  "seo",
  "best-practices",
  "security",
  "html-quality",
  "css-quality",
];

// Category weights for overall score
const CATEGORY_WEIGHTS: Record<string, number> = {
  performance: 20,
  accessibility: 25,
  seo: 10,
  "best-practices": 10,
  security: 10,
  responsive: 5,
  typography: 5,
  "touch-targets": 5,
  visual: 3,
  "html-quality": 3,
  "css-quality": 2,
  forms: 2,
};

function getGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export async function calculateScores(
  scanId: string,
  lighthouseScores: Record<string, number> | null = null,
): Promise<void> {
  const issues = await db.query.auditIssues.findMany({
    where: eq(auditIssues.scanId, scanId),
  });

  let weightedTotal = 0;
  let weightSum = 0;

  for (const category of ALL_CATEGORIES) {
    const categoryIssues = issues.filter((i) => i.category === category);

    const counts = {
      critical: categoryIssues.filter((i) => i.severity === "critical").length,
      warning: categoryIssues.filter((i) => i.severity === "warning").length,
      info: categoryIssues.filter((i) => i.severity === "info").length,
    };

    let score: number;
    let lighthouseScore: number | null = null;

    // Use Lighthouse score directly for Lighthouse categories
    if (LIGHTHOUSE_CATEGORIES.has(category) && lighthouseScores?.[category] !== undefined) {
      lighthouseScore = Math.round(lighthouseScores[category]);
      score = lighthouseScore;
    } else if (categoryIssues.length === 0 && !LIGHTHOUSE_CATEGORIES.has(category)) {
      // No issues and not a Lighthouse category: either nothing to check or perfect
      score = 100;
    } else {
      // Deduction-based scoring for custom categories
      const deduction =
        counts.critical * SEVERITY_WEIGHTS.critical +
        counts.warning * SEVERITY_WEIGHTS.warning +
        counts.info * SEVERITY_WEIGHTS.info;
      score = Math.max(0, Math.min(100, 100 - deduction));
    }

    // Only record category if it has issues or a Lighthouse score
    const hasData = categoryIssues.length > 0 || lighthouseScore !== null;
    if (!hasData) continue;

    await db.insert(categoryScores).values({
      scanId,
      category,
      score,
      issueCount: counts,
      lighthouseScore,
    });

    const weight = CATEGORY_WEIGHTS[category] ?? 2;
    weightedTotal += score * weight;
    weightSum += weight;
  }

  // Handle AI analysis category separately
  const aiIssues = issues.filter((i) => i.category === "ai-analysis");
  if (aiIssues.length > 0) {
    const counts = {
      critical: aiIssues.filter((i) => i.severity === "critical").length,
      warning: aiIssues.filter((i) => i.severity === "warning").length,
      info: aiIssues.filter((i) => i.severity === "info").length,
    };
    const deduction =
      counts.critical * SEVERITY_WEIGHTS.critical +
      counts.warning * SEVERITY_WEIGHTS.warning +
      counts.info * SEVERITY_WEIGHTS.info;
    const score = Math.max(0, Math.min(100, 100 - deduction));

    await db.insert(categoryScores).values({
      scanId,
      category: "ai-analysis",
      score,
      issueCount: counts,
    });

    // AI analysis gets 5% weight
    weightedTotal += score * 5;
    weightSum += 5;
  }

  const overallScore = weightSum > 0 ? Math.round(weightedTotal / weightSum) : 100;
  const overallGrade = getGrade(overallScore);

  await db.update(scans)
    .set({ overallScore, overallGrade })
    .where(eq(scans.id, scanId));
}
