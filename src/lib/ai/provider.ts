import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { viewportResults, auditIssues } from "@/lib/db/schema";
import type { AiProvider } from "@/lib/types";
import { analyzeWithClaude } from "./claude";
import { analyzeWithOpenAI } from "./openai";

export interface AiAnalysisIssue {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  recommendation: string;
  viewport: string;
}

export interface AiAnalysisResult {
  issues: AiAnalysisIssue[];
  summary: string;
}

export async function runAiAnalysis(
  scanId: string,
  provider: AiProvider
): Promise<void> {
  // Fetch viewport results to get screenshot paths
  const results = await db.query.viewportResults.findMany({
    where: eq(viewportResults.scanId, scanId),
  });

  if (results.length === 0) return;

  const screenshots = results.map((r) => ({
    viewportName: r.viewportName,
    imagePath: r.screenshotPath,
  }));

  // Run analysis with selected provider
  let analysis: AiAnalysisResult;
  if (provider === "claude") {
    analysis = await analyzeWithClaude(screenshots);
  } else {
    analysis = await analyzeWithOpenAI(screenshots);
  }

  // Save AI issues to database
  if (analysis.issues.length > 0) {
    await db.insert(auditIssues).values(
      analysis.issues.map((issue) => ({
        scanId,
        viewportResultId: null,
        category: "ai-analysis",
        severity: issue.severity,
        ruleId: `ai-${provider}-${issue.title.toLowerCase().replace(/\s+/g, "-").slice(0, 50)}`,
        title: issue.title,
        description: issue.description,
        recommendation: issue.recommendation,
        details: { viewport: issue.viewport, provider, summary: analysis.summary },
      }))
    );
  }
}
