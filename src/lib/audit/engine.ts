import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  viewportResults,
  viewportResultBlobs,
  auditIssues,
} from "@/lib/db/schema";
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

export interface AuditEngineResult {
  lighthouseScores: Record<string, number> | null;
}

export async function runAuditEngine(
  scanId: string,
  url: string,
  session: BrowserSession
): Promise<AuditEngineResult> {
  const results = await db.query.viewportResults.findMany({
    where: eq(viewportResults.scanId, scanId),
  });

  if (results.length === 0) return { lighthouseScores: null };

  // Load the heavy blobs (domSnapshot / axeResults / pageHtml / pageCss) in
  // one round-trip instead of per-row queries. Indexed into a Map for O(1)
  // lookup by viewport-result id.
  const resultIds = results.map((r) => r.id);
  const blobs = await db.query.viewportResultBlobs.findMany({
    where: inArray(viewportResultBlobs.viewportResultId, resultIds),
  });
  const blobById = new Map(blobs.map((b) => [b.viewportResultId, b]));

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
    const blob = blobById.get(result.id);
    const snapshot = (blob?.domSnapshot ?? null) as DomSnapshot | null;

    // 1. axe-core results (REPLACES custom accessibility.ts)
    const axeData = (blob?.axeResults ?? null) as Record<string, unknown> | null;
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
    const pageHtml = (blob?.pageHtml ?? null) as string | null;
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
    const blob = blobById.get(result.id);
    const snapshot = (blob?.domSnapshot ?? null) as DomSnapshot | null;
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
  const pageCss = firstResult
    ? ((blobById.get(firstResult.id)?.pageCss ?? null) as string | null)
    : null;
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

  let lighthouseScores: Record<string, number> | null = null;
  const lighthouseData: Record<string, unknown> = {};

  if (session.debuggingPort) {
    // Lighthouse desktop and mobile run sequentially. They cannot run in
    // parallel within the same Node.js process because Lighthouse uses
    // process-global performance.mark() counters that the two invocations
    // clobber ("The start lh:runner:gather performance mark has not been
    // set"). True parallelism would require either two Node processes or a
    // patched Lighthouse that namespaces its marks — out of scope here.
    try {
      console.log(`Running Lighthouse Desktop on ${url}...`);
      const lhDesktop = await runLighthouse({
        url,
        debuggingPort: session.debuggingPort,
        categories: ["performance", "best-practices", "seo"],
        formFactor: "desktop",
      });

      lighthouseScores = {};
      if (lhDesktop.categoryScores.performance !== undefined)
        lighthouseScores.performance = lhDesktop.categoryScores.performance;
      if (lhDesktop.categoryScores.bestPractices !== undefined)
        lighthouseScores["best-practices"] =
          lhDesktop.categoryScores.bestPractices;
      if (lhDesktop.categoryScores.seo !== undefined)
        lighthouseScores.seo = lhDesktop.categoryScores.seo;

      for (const issue of lhDesktop.issues) {
        allIssues.push({ ...issue, scanId, viewportResultId: firstResult.id });
      }
      lighthouseData.desktop = lhDesktop.lhr;
      console.log(
        `Lighthouse Desktop: perf=${lighthouseScores.performance}, seo=${lighthouseScores.seo}`,
      );
    } catch (e) {
      console.warn(
        "Lighthouse Desktop failed:",
        e instanceof Error ? e.message : e,
      );
    }

    try {
      console.log(`Running Lighthouse Mobile on ${url}...`);
      const lhMobile = await runLighthouse({
        url,
        debuggingPort: session.debuggingPort,
        categories: ["performance", "best-practices", "seo"],
        formFactor: "mobile",
      });
      lighthouseData.mobile = lhMobile.lhr;
      console.log(
        `Lighthouse Mobile: perf=${lhMobile.categoryScores.performance}`,
      );
    } catch (e) {
      console.warn(
        "Lighthouse Mobile failed:",
        e instanceof Error ? e.message : e,
      );
    }

    // Store both LHR results — lighthouse_json lives in viewport_result_blobs
    // now. Upsert so this works whether or not a blob row already exists for
    // the first viewport (it does when captureHtmlCss=true wrote dom+axe+html).
    if (Object.keys(lighthouseData).length > 0) {
      await db
        .insert(viewportResultBlobs)
        .values({
          viewportResultId: firstResult.id,
          lighthouseJson: lighthouseData,
        })
        .onConflictDoUpdate({
          target: viewportResultBlobs.viewportResultId,
          set: { lighthouseJson: lighthouseData },
        });
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

  return { lighthouseScores };
}
