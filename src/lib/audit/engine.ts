import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { viewportResults, auditIssues } from "@/lib/db/schema";
import type { BrowserSession } from "@/lib/scanner/browser";
import type { DomSnapshot } from "@/lib/scanner/capture";
import { DEVICE_PRESETS } from "@/lib/scanner/devices";

// Runners
import { processAxeResults } from "./runners/axe-runner";
import { runLighthouse } from "./runners/lighthouse-runner";
import { runHtmlHint } from "./runners/html-runner";
import { runCssAnalysis } from "./runners/css-runner";
import { runSecurityChecks } from "./runners/security-runner";

// Kept custom rules (unique cross-viewport value)
import { runResponsiveChecks } from "./rules/responsive";
import { runTypographyChecks } from "./rules/typography";
import { runTouchTargetChecks } from "./rules/touch-targets";
import { runVisualConsistencyChecks } from "./rules/visual";

interface AuditIssueInsert {
  scanId: string;
  viewportResultId?: string | null;
  category: string;
  severity: string;
  ruleId: string;
  title: string;
  description: string;
  elementSelector?: string | null;
  elementHtml?: string | null;
  recommendation?: string | null;
  details?: Record<string, unknown> | null;
}

// Store lighthouse scores for scoring phase
let lastLighthouseScores: Record<string, number> | null = null;

export function getLastLighthouseScores(): Record<string, number> | null {
  return lastLighthouseScores;
}

export async function runAuditEngine(
  scanId: string,
  url: string,
  session: BrowserSession
): Promise<void> {
  const results = await db.query.viewportResults.findMany({
    where: eq(viewportResults.scanId, scanId),
  });

  if (results.length === 0) return;

  const allIssues: AuditIssueInsert[] = [];

  // Build lookup maps
  const viewportResultIds = new Map<string, string>();
  for (const result of results) {
    viewportResultIds.set(result.viewportName, result.id);
  }

  function getViewportType(name: string): string {
    const preset = DEVICE_PRESETS.find((d) => d.name === name);
    return preset?.type ?? "desktop";
  }

  // ── Per-viewport checks ────────────────────────────────────────────

  for (const result of results) {
    const viewportResultId = result.id;
    const viewportName = result.viewportName;
    const viewportType = getViewportType(viewportName);
    const snapshot = result.domSnapshot as DomSnapshot | null;

    // 1. axe-core results (REPLACES custom accessibility.ts)
    const axeData = result.axeResults as Record<string, unknown> | null;
    if (axeData) {
      try {
        const axeIssues = processAxeResults({
          axeResults: axeData as any,
          viewportName,
        });
        for (const issue of axeIssues) {
          allIssues.push({ ...issue, scanId, viewportResultId });
        }
      } catch (e) {
        console.warn(`axe-runner failed for ${viewportName}:`, e);
      }
    }

    // 2. HTMLHint (run once on first viewport)
    const pageHtml = result.pageHtml as string | null;
    if (pageHtml && result.id === results[0].id) {
      try {
        const htmlIssues = await runHtmlHint({ html: pageHtml, viewportName });
        for (const issue of htmlIssues) {
          allIssues.push({ ...issue, scanId, viewportResultId });
        }
      } catch (e) {
        console.warn("HTMLHint failed:", e);
      }
    }

    // 3. Security headers (run once on first viewport)
    const responseHeaders = result.responseHeaders as Record<string, string> | null;
    if (responseHeaders && result.id === results[0].id) {
      try {
        const secIssues = runSecurityChecks({ responseHeaders, url });
        for (const issue of secIssues) {
          allIssues.push({ ...issue, scanId, viewportResultId });
        }
      } catch (e) {
        console.warn("Security checks failed:", e);
      }
    }

    // 4. Kept custom rules (snapshot-based)
    if (snapshot) {
      // Typography
      const typoIssues = runTypographyChecks(snapshot, viewportName, viewportType);
      for (const issue of typoIssues) {
        allIssues.push({ ...issue, scanId, viewportResultId });
      }

      // Touch targets (mobile/tablet only)
      const touchIssues = runTouchTargetChecks(snapshot, viewportName, viewportType);
      for (const issue of touchIssues) {
        allIssues.push({ ...issue, scanId, viewportResultId });
      }
    }
  }

  // ── Cross-viewport checks (KEPT, unique value) ────────────────────

  const snapshotMap = new Map<string, DomSnapshot>();
  for (const result of results) {
    const snapshot = result.domSnapshot as DomSnapshot | null;
    if (snapshot) {
      snapshotMap.set(result.viewportName, snapshot);
    }
  }

  if (snapshotMap.size > 0) {
    const responsiveIssues = runResponsiveChecks(snapshotMap);
    for (const issue of responsiveIssues) {
      allIssues.push({ ...issue, scanId });
    }

    const visualIssues = runVisualConsistencyChecks(snapshotMap);
    for (const issue of visualIssues) {
      allIssues.push({ ...issue, scanId });
    }
  }

  // ── CSS analysis (run once) ───────────────────────────────────────

  const firstResult = results[0];
  const pageCss = firstResult?.pageCss as string | null;
  if (pageCss) {
    try {
      const cssOutput = await runCssAnalysis({
        css: pageCss,
        viewportName: firstResult.viewportName,
      });
      for (const issue of cssOutput.issues) {
        allIssues.push({
          ...issue,
          scanId,
          viewportResultId: firstResult.id,
        });
      }
    } catch (e) {
      console.warn("CSS analysis failed:", e);
    }
  }

  // ── Lighthouse (Chromium only, desktop + mobile) ────────────────

  lastLighthouseScores = null;
  let lighthouseData: Record<string, unknown> = {};

  if (session.debuggingPort) {
    // Desktop run
    try {
      console.log(`Running Lighthouse Desktop on ${url}...`);
      const lhDesktop = await runLighthouse({
        url,
        debuggingPort: session.debuggingPort,
        categories: ["performance", "best-practices", "seo"],
        formFactor: "desktop",
      });

      lastLighthouseScores = {};
      if (lhDesktop.categoryScores.performance !== undefined) lastLighthouseScores.performance = lhDesktop.categoryScores.performance;
      if (lhDesktop.categoryScores.bestPractices !== undefined) lastLighthouseScores["best-practices"] = lhDesktop.categoryScores.bestPractices;
      if (lhDesktop.categoryScores.seo !== undefined) lastLighthouseScores.seo = lhDesktop.categoryScores.seo;

      for (const issue of lhDesktop.issues) {
        allIssues.push({ ...issue, scanId, viewportResultId: firstResult.id });
      }

      lighthouseData.desktop = lhDesktop.lhr;
      console.log(`Lighthouse Desktop: perf=${lastLighthouseScores.performance}, seo=${lastLighthouseScores.seo}`);
    } catch (e) {
      console.warn("Lighthouse Desktop failed:", e instanceof Error ? e.message : e);
    }

    // Mobile run
    try {
      console.log(`Running Lighthouse Mobile on ${url}...`);
      const lhMobile = await runLighthouse({
        url,
        debuggingPort: session.debuggingPort,
        categories: ["performance", "best-practices", "seo"],
        formFactor: "mobile",
      });

      lighthouseData.mobile = lhMobile.lhr;
      console.log(`Lighthouse Mobile: perf=${lhMobile.categoryScores.performance}`);
    } catch (e) {
      console.warn("Lighthouse Mobile failed:", e instanceof Error ? e.message : e);
    }

    // Store both LHR results
    if (Object.keys(lighthouseData).length > 0) {
      await db.update(viewportResults)
        .set({ lighthouseJson: lighthouseData })
        .where(eq(viewportResults.id, firstResult.id));
    }
  } else {
    console.log(`Lighthouse skipped (engine: ${session.engine}, no debugging port)`);
  }

  // ── Save all issues to DB ─────────────────────────────────────────

  if (allIssues.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < allIssues.length; i += batchSize) {
      const batch = allIssues.slice(i, i + batchSize);
      await db.insert(auditIssues).values(
        batch.map((issue) => ({
          scanId: issue.scanId,
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
