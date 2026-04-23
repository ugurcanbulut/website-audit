import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { viewportResults, auditIssues } from "@/lib/db/schema";
import type { AiProvider } from "@/lib/types";
import type { DomSnapshot } from "@/lib/scanner/capture";
import type { ViewportDimensions, AuditContext } from "./prompts";
import { analyzeWithClaude } from "./claude";
import { analyzeWithOpenAI } from "./openai";

export interface AiCodeFix {
  before: string;
  after: string;
  language: "html" | "css";
}

export interface AiAltTextSuggestion {
  selector: string;
  currentAlt: string | null;
  suggestedAlt: string;
  viewport: string;
}

export interface AiAnalysisIssue {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  recommendation: string;
  viewport: string;
  region?: { x: number; y: number; width: number; height: number } | null;
  codeFix?: AiCodeFix | null;
}

export interface AiAnalysisResult {
  issues: AiAnalysisIssue[];
  altTextSuggestions?: AiAltTextSuggestion[];
  summary: string;
}

export async function runAiAnalysis(
  scanId: string,
  provider: AiProvider
): Promise<void> {
  const results = await db.query.viewportResults.findMany({
    where: eq(viewportResults.scanId, scanId),
  });

  if (results.length === 0) return;

  // Limit screenshots to 3 max (one per type: mobile, tablet, desktop)
  // to avoid exceeding AI token limits
  const selectedResults = selectRepresentativeViewports(results);

  // Prefer the viewport-sized thumbnail over the full-page screenshot: AI
  // providers downscale images (Claude: 1568px long edge; GPT-5: 2048px for
  // "high" detail) and a 1920x8000 full-page capture loses UI fidelity.
  // The viewport thumbnail is natively within the model's full-resolution band.
  const screenshots = selectedResults.map((r) => ({
    viewportName: r.viewportName,
    imagePath: r.viewportScreenshotPath ?? r.screenshotPath,
  }));

  const dimensions: ViewportDimensions[] = selectedResults.map((r) => {
    const snapshot = r.domSnapshot as DomSnapshot | null;
    const usesViewportThumbnail = !!r.viewportScreenshotPath;
    return {
      name: r.viewportName,
      width: usesViewportThumbnail ? r.width : r.screenshotWidth ?? r.width,
      height: usesViewportThumbnail
        ? r.height
        : r.screenshotHeight ?? snapshot?.documentHeight ?? r.height * 4,
    };
  });

  // Build audit context from existing tool results
  const context = await buildAuditContext(scanId, results[0]);

  // Run analysis
  let analysis: AiAnalysisResult;
  if (provider === "claude") {
    analysis = await analyzeWithClaude(screenshots, dimensions, context);
  } else {
    analysis = await analyzeWithOpenAI(screenshots, dimensions, context);
  }

  // Save AI issues
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
        details: {
          viewport: issue.viewport,
          provider,
          summary: analysis.summary,
          region: issue.region ?? null,
          codeFix: issue.codeFix ?? null,
        },
      }))
    );
  }

  // Save alt text suggestions as separate info-level issues
  if (analysis.altTextSuggestions && analysis.altTextSuggestions.length > 0) {
    await db.insert(auditIssues).values(
      analysis.altTextSuggestions.map((alt) => ({
        scanId,
        viewportResultId: null,
        category: "ai-analysis",
        severity: "info" as const,
        ruleId: `ai-${provider}-alt-text-suggestion`,
        title: `Alt text suggestion: ${alt.selector.slice(0, 60)}`,
        description: `Image "${alt.selector}" is missing descriptive alt text.`,
        recommendation: `Add alt="${alt.suggestedAlt}"`,
        details: {
          viewport: alt.viewport,
          provider,
          codeFix: {
            before: alt.currentAlt
              ? `alt="${alt.currentAlt}"`
              : `<img src="..." />`,
            after: `alt="${alt.suggestedAlt}"`,
            language: "html",
          },
        },
      }))
    );
  }
}

/** Select max 3 representative viewports (1 mobile, 1 tablet, 1 desktop) */
function selectRepresentativeViewports(
  results: typeof viewportResults.$inferSelect[]
): typeof viewportResults.$inferSelect[] {
  const mobile = results.find((r) => r.width < 600);
  const tablet = results.find((r) => r.width >= 600 && r.width < 1024);
  const desktop = results.find((r) => r.width >= 1024);
  const selected = [mobile, tablet, desktop].filter(Boolean) as typeof results;
  return selected.length > 0 ? selected : results.slice(0, 3);
}

/** Build context from existing audit results for the AI */
async function buildAuditContext(
  scanId: string,
  firstResult: typeof viewportResults.$inferSelect
): Promise<AuditContext> {
  const context: AuditContext = {};

  // Get existing audit issues (from axe-core, lighthouse, etc.)
  const existingIssues = await db.query.auditIssues.findMany({
    where: eq(auditIssues.scanId, scanId),
  });

  // Summarize accessibility violations
  const a11yIssues = existingIssues.filter((i) => i.category === "accessibility");
  if (a11yIssues.length > 0) {
    context.accessibilityViolations = a11yIssues.map(
      (i) => `[${i.severity}] ${i.title}${i.elementSelector ? ` (${i.elementSelector})` : ""}`
    );
  }

  // Summarize Lighthouse failures
  const lhIssues = existingIssues.filter(
    (i) => i.category === "performance" || i.category === "seo" || i.category === "best-practices"
  );
  if (lhIssues.length > 0) {
    context.lighthouseFailures = lhIssues.map(
      (i) => `[${i.category}/${i.severity}] ${i.title}`
    );
  }

  // Build page structure summary from DOM snapshot
  const snapshot = firstResult.domSnapshot as DomSnapshot | null;
  if (snapshot) {
    const headings = snapshot.elements
      .filter((el) => /^h[1-6]$/.test(el.tagName) && el.isVisible)
      .map((el) => `${"  ".repeat(parseInt(el.tagName[1]) - 1)}<${el.tagName}> (${el.rect.width}x${el.rect.height})`)
      .slice(0, 10);

    const navElements = snapshot.elements
      .filter((el) => el.tagName === "nav" || el.attributes?.role === "navigation")
      .length;

    const forms = snapshot.elements.filter((el) => el.tagName === "form").length;
    const images = snapshot.elements.filter((el) => el.tagName === "img").length;
    const imagesNoAlt = snapshot.elements.filter(
      (el) => el.tagName === "img" && (!el.attributes?.alt || el.attributes.alt === "")
    ).length;
    const links = snapshot.elements.filter((el) => el.tagName === "a" && el.isVisible).length;
    const buttons = snapshot.elements.filter(
      (el) => (el.tagName === "button" || el.attributes?.role === "button") && el.isVisible
    ).length;

    context.pageStructure = [
      `Document: ${snapshot.documentWidth}x${snapshot.documentHeight}`,
      `Navigation elements: ${navElements}`,
      `Visible links: ${links}, Buttons: ${buttons}`,
      `Forms: ${forms}`,
      `Images: ${images} (${imagesNoAlt} missing alt)`,
      headings.length > 0 ? `Heading structure:\n${headings.join("\n")}` : "No headings found",
    ].join("\n");
  }

  return context;
}
