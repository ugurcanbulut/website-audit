import type { DomSnapshot, DomElement } from "@/lib/scanner/capture";

interface AuditIssueInput {
  category: string;
  severity: "critical" | "warning" | "info" | "pass";
  ruleId: string;
  title: string;
  description: string;
  elementSelector?: string;
  elementHtml?: string;
  recommendation?: string;
  details?: Record<string, unknown>;
}

const TEXT_TAGS = new Set([
  "p",
  "span",
  "li",
  "a",
  "label",
  "td",
  "th",
  "dt",
  "dd",
  "blockquote",
  "figcaption",
  "caption",
]);

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * Typography checks for a single viewport snapshot.
 */
export function runTypographyChecks(
  domSnapshot: DomSnapshot,
  viewportName: string,
  viewportType: string
): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];
  const isMobileOrTablet = viewportType === "mobile" || viewportType === "tablet";

  const visibleTextElements = domSnapshot.elements.filter(
    (el) =>
      el.isVisible &&
      (TEXT_TAGS.has(el.tagName) || HEADING_TAGS.has(el.tagName))
  );

  // --- Small font size on mobile/tablet ---
  if (isMobileOrTablet) {
    for (const el of visibleTextElements) {
      const fontSize = parsePx(el.computedStyles.fontSize);
      if (fontSize !== null && fontSize < 16) {
        issues.push({
          category: "typography",
          severity: "warning",
          ruleId: "small-font-mobile",
          title: `Small font: ${el.tagName} (${el.computedStyles.fontSize})`,
          description: `<${el.tagName}> has font-size: ${el.computedStyles.fontSize}, which is below the recommended 16px minimum for ${viewportType} viewports.`,
          elementSelector: el.selector,
          recommendation:
            `Set font-size: 16px; or use a responsive size (e.g. clamp(16px, 4vw, 18px)).`,
          details: {
            fontSize: el.computedStyles.fontSize,
            viewport: viewportName,
          },
        });
      }
    }
  }

  // --- Poor line height ---
  for (const el of visibleTextElements) {
    const fontSize = parsePx(el.computedStyles.fontSize);
    const lineHeight = parsePx(el.computedStyles.lineHeight);

    if (fontSize !== null && fontSize > 0 && lineHeight !== null && lineHeight > 0) {
      const ratio = lineHeight / fontSize;
      if (ratio < 1.2 || ratio > 2.0) {
        const issue = ratio < 1.2 ? "too tight" : "too loose";
        issues.push({
          category: "typography",
          severity: "info",
          ruleId: "poor-line-height",
          title: `Line height ${issue}: ${el.tagName} (${ratio.toFixed(2)}x)`,
          description: `<${el.tagName}> has a line-height/font-size ratio of ${ratio.toFixed(2)} (line-height: ${lineHeight}px, font-size: ${fontSize}px). The recommended range is 1.2 - 2.0.`,
          elementSelector: el.selector,
          recommendation:
            ratio < 1.2
              ? `Set line-height: 1.5; to improve readability.`
              : `Set line-height: 1.5; to reduce excessive spacing.`,
          details: {
            ratio: parseFloat(ratio.toFixed(2)),
            fontSize,
            lineHeight,
            viewport: viewportName,
          },
        });
      }
    }
  }

  // --- Text overflow/truncation ---
  const truncatedElements = domSnapshot.elements.filter(
    (el) =>
      el.isVisible &&
      (TEXT_TAGS.has(el.tagName) || HEADING_TAGS.has(el.tagName)) &&
      (el.computedStyles.overflow === "hidden" ||
        el.computedStyles.overflowX === "hidden")
  );

  for (const el of truncatedElements) {
    issues.push({
      category: "typography",
      severity: "warning",
      ruleId: "text-overflow",
      title: `Possible text truncation: ${el.tagName} (${Math.round(el.rect.width)}px wide)`,
      description: `<${el.tagName}> has overflow: hidden which may clip text content. If this element contains truncated text, users may miss important information.`,
      elementSelector: el.selector,
      recommendation:
        "Ensure text is not unintentionally clipped. If truncation is intentional, add a tooltip or expandable section for the full text.",
      details: {
        overflow: el.computedStyles.overflow,
        overflowX: el.computedStyles.overflowX,
        width: Math.round(el.rect.width),
        viewport: viewportName,
      },
    });
  }

  // --- Very long line lengths (desktop only) ---
  if (viewportType === "desktop") {
    const longLineElements: DomElement[] = [];

    for (const el of visibleTextElements) {
      // Approximate 80ch as ~640px at 16px font, scale proportionally
      const fontSize = parsePx(el.computedStyles.fontSize) ?? 16;
      const maxWidth = fontSize * 40; // ~80 characters at 0.5em average char width
      // Use a more generous threshold: 640px as the floor
      const threshold = Math.max(640, maxWidth);

      if (el.rect.width > threshold) {
        longLineElements.push(el);
      }
    }

    for (const el of longLineElements) {
      issues.push({
        category: "typography",
        severity: "info",
        ruleId: "long-lines",
        title: `Long line length: ${el.tagName} (${Math.round(el.rect.width)}px)`,
        description: `<${el.tagName}> is ${Math.round(el.rect.width)}px wide, which likely produces lines exceeding 80 characters.`,
        elementSelector: el.selector,
        recommendation:
          "Add max-width: 65ch; or a similar constraint to improve readability.",
        details: {
          width: Math.round(el.rect.width),
          viewport: viewportName,
        },
      });
    }
  }

  return issues;
}

function parsePx(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^([\d.]+)px$/);
  if (match) return parseFloat(match[1]);
  return null;
}
