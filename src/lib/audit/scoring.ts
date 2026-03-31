import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, auditIssues, categoryScores } from "@/lib/db/schema";
import type { AuditCategory, Grade } from "@/lib/types";

const SEVERITY_WEIGHTS = {
  critical: 10,
  warning: 5,
  info: 1,
  pass: 0,
};

const ALL_CATEGORIES: AuditCategory[] = [
  "accessibility",
  "responsive",
  "performance",
  "typography",
  "touch-targets",
  "forms",
  "visual",
  "seo",
];

function getGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export async function calculateScores(scanId: string): Promise<void> {
  const issues = await db.query.auditIssues.findMany({
    where: eq(auditIssues.scanId, scanId),
  });

  let totalScore = 0;
  let categoryCount = 0;

  for (const category of ALL_CATEGORIES) {
    const categoryIssues = issues.filter((i) => i.category === category);

    const counts = {
      critical: categoryIssues.filter((i) => i.severity === "critical").length,
      warning: categoryIssues.filter((i) => i.severity === "warning").length,
      info: categoryIssues.filter((i) => i.severity === "info").length,
    };

    // Calculate deductions
    const deduction =
      counts.critical * SEVERITY_WEIGHTS.critical +
      counts.warning * SEVERITY_WEIGHTS.warning +
      counts.info * SEVERITY_WEIGHTS.info;

    const score = Math.max(0, Math.min(100, 100 - deduction));
    totalScore += score;
    categoryCount++;

    await db.insert(categoryScores).values({
      scanId,
      category,
      score,
      issueCount: counts,
    });
  }

  // Also handle AI analysis category if present
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
    totalScore += score;
    categoryCount++;

    await db.insert(categoryScores).values({
      scanId,
      category: "ai-analysis",
      score,
      issueCount: counts,
    });
  }

  const overallScore = categoryCount > 0 ? Math.round(totalScore / categoryCount) : 100;
  const overallGrade = getGrade(overallScore);

  await db
    .update(scans)
    .set({ overallScore, overallGrade })
    .where(eq(scans.id, scanId));
}
