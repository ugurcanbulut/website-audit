import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { viewportResults, auditIssues } from "@/lib/db/schema";
import type { DomSnapshot } from "@/lib/scanner/capture";
import { VIEWPORT_PRESETS } from "@/lib/scanner/viewports";
import { runAccessibilityChecks } from "./rules/accessibility";
import { runResponsiveChecks } from "./rules/responsive";
import { runPerformanceChecks } from "./rules/performance";
import { runTypographyChecks } from "./rules/typography";
import { runTouchTargetChecks } from "./rules/touch-targets";
import { runFormChecks } from "./rules/forms";
import { runVisualConsistencyChecks } from "./rules/visual";
import { runSeoChecks } from "./rules/seo";

export async function runAuditEngine(scanId: string): Promise<void> {
  const results = await db.query.viewportResults.findMany({
    where: eq(viewportResults.scanId, scanId),
  });

  if (results.length === 0) return;

  // Build lookup maps
  const snapshotMap = new Map<string, DomSnapshot>();
  const metricsArray: { viewportName: string; metrics: Record<string, unknown> }[] = [];

  for (const result of results) {
    const snapshot = result.domSnapshot as DomSnapshot | null;
    if (snapshot) {
      snapshotMap.set(result.viewportName, snapshot);
    }
    if (result.performanceMetrics) {
      metricsArray.push({
        viewportName: result.viewportName,
        metrics: result.performanceMetrics as Record<string, unknown>,
      });
    }
  }

  // Build viewport result ID lookup
  const viewportResultIds = new Map<string, string>();
  for (const result of results) {
    viewportResultIds.set(result.viewportName, result.id);
  }

  function getViewportType(name: string): string {
    const preset = VIEWPORT_PRESETS.find((v) => v.name === name);
    return preset?.type ?? "desktop";
  }

  // Collect all issues
  const allIssues: Array<{
    category: string;
    severity: string;
    ruleId: string;
    title: string;
    description: string;
    elementSelector?: string;
    elementHtml?: string;
    recommendation?: string;
    details?: Record<string, unknown>;
    viewportResultId?: string;
  }> = [];

  // --- Per-viewport checks ---
  for (const [viewportName, snapshot] of snapshotMap) {
    const viewportResultId = viewportResultIds.get(viewportName);
    const viewportType = getViewportType(viewportName);

    // Accessibility
    const a11yIssues = runAccessibilityChecks(snapshot, viewportName);
    for (const issue of a11yIssues) {
      allIssues.push({ ...issue, viewportResultId });
    }

    // Typography
    const typoIssues = runTypographyChecks(snapshot, viewportName, viewportType);
    for (const issue of typoIssues) {
      allIssues.push({ ...issue, viewportResultId });
    }

    // Touch targets (mobile/tablet only)
    const touchIssues = runTouchTargetChecks(snapshot, viewportName, viewportType);
    for (const issue of touchIssues) {
      allIssues.push({ ...issue, viewportResultId });
    }

    // Forms
    const formIssues = runFormChecks(snapshot, viewportName, viewportType);
    for (const issue of formIssues) {
      allIssues.push({ ...issue, viewportResultId });
    }

    // SEO (run on first viewport only to avoid duplicates)
    if (viewportName === results[0].viewportName) {
      const seoIssues = runSeoChecks(snapshot, viewportName);
      for (const issue of seoIssues) {
        allIssues.push({ ...issue, viewportResultId });
      }
    }
  }

  // --- Cross-viewport checks ---
  if (snapshotMap.size > 0) {
    const responsiveIssues = runResponsiveChecks(snapshotMap);
    for (const issue of responsiveIssues) {
      allIssues.push(issue);
    }

    const visualIssues = runVisualConsistencyChecks(snapshotMap);
    for (const issue of visualIssues) {
      allIssues.push(issue);
    }
  }

  // --- Performance checks ---
  if (metricsArray.length > 0) {
    const perfIssues = runPerformanceChecks(metricsArray);
    const firstViewportResultId = viewportResultIds.get(metricsArray[0].viewportName);
    for (const issue of perfIssues) {
      allIssues.push({ ...issue, viewportResultId: firstViewportResultId });
    }
  }

  // --- Save all issues to DB ---
  if (allIssues.length > 0) {
    // Insert in batches to avoid huge single inserts
    const batchSize = 100;
    for (let i = 0; i < allIssues.length; i += batchSize) {
      const batch = allIssues.slice(i, i + batchSize);
      await db.insert(auditIssues).values(
        batch.map((issue) => ({
          scanId,
          viewportResultId: issue.viewportResultId ?? null,
          category: issue.category,
          severity: issue.severity,
          ruleId: issue.ruleId,
          title: issue.title,
          description: issue.description,
          elementSelector: issue.elementSelector ?? null,
          elementHtml: issue.elementHtml ?? null,
          recommendation: issue.recommendation ?? null,
          details: issue.details ?? null,
        }))
      );
    }
  }

  console.log(
    `Audit engine: found ${allIssues.length} issues across ${results.length} viewports for scan ${scanId}`
  );
}
