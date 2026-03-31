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
    const smallFontElements: DomElement[] = [];

    for (const el of visibleTextElements) {
      const fontSize = parsePx(el.computedStyles.fontSize);
      if (fontSize !== null && fontSize < 16) {
        smallFontElements.push(el);
      }
    }

    if (smallFontElements.length > 0) {
      // Report summary
      issues.push({
        category: "typography",
        severity: "warning",
        ruleId: "small-font-mobile",
        title: `${smallFontElements.length} text element(s) with small font on ${viewportName}`,
        description: `Found ${smallFontElements.length} visible text element(s) with font-size below 16px on a ${viewportType} viewport. Small text is difficult to read on mobile devices without zooming.`,
        recommendation:
          "Use a minimum font-size of 16px for body text on mobile viewports. This prevents browsers from zooming in on form inputs and improves overall readability.",
        details: {
          count: smallFontElements.length,
          viewport: viewportName,
          viewportType,
        },
      });

      // Report up to 5 individual elements
      for (const el of smallFontElements.slice(0, 5)) {
        issues.push({
          category: "typography",
          severity: "warning",
          ruleId: "small-font-mobile",
          title: `Small font size on ${viewportName}`,
          description: `<${el.tagName}> has font-size: ${el.computedStyles.fontSize}, which is below the recommended 16px minimum for ${viewportType} viewports.`,
          elementSelector: el.selector,
          recommendation:
            "Increase the font-size to at least 16px for mobile readability.",
          details: {
            fontSize: el.computedStyles.fontSize,
            viewport: viewportName,
          },
        });
      }
    }
  }

  // --- Poor line height ---
  const poorLineHeightElements: Array<{
    el: DomElement;
    ratio: number;
    fontSize: number;
    lineHeight: number;
  }> = [];

  for (const el of visibleTextElements) {
    const fontSize = parsePx(el.computedStyles.fontSize);
    const lineHeight = parsePx(el.computedStyles.lineHeight);

    if (fontSize !== null && fontSize > 0 && lineHeight !== null && lineHeight > 0) {
      const ratio = lineHeight / fontSize;
      if (ratio < 1.2 || ratio > 2.0) {
        poorLineHeightElements.push({ el, ratio, fontSize, lineHeight });
      }
    }
  }

  if (poorLineHeightElements.length > 0) {
    issues.push({
      category: "typography",
      severity: "info",
      ruleId: "poor-line-height",
      title: `${poorLineHeightElements.length} element(s) with poor line-height ratio on ${viewportName}`,
      description: `Found ${poorLineHeightElements.length} text element(s) where the line-height to font-size ratio is outside the recommended 1.2 - 2.0 range. This can affect readability.`,
      recommendation:
        "Use a line-height between 1.2x and 2.0x the font-size. For body text, 1.5 to 1.6 is generally ideal for readability.",
      details: {
        count: poorLineHeightElements.length,
        viewport: viewportName,
      },
    });

    for (const { el, ratio, fontSize, lineHeight } of poorLineHeightElements.slice(0, 5)) {
      const issue = ratio < 1.2 ? "too tight" : "too loose";
      issues.push({
        category: "typography",
        severity: "info",
        ruleId: "poor-line-height",
        title: `Line height ${issue} on ${viewportName}`,
        description: `<${el.tagName}> has a line-height/font-size ratio of ${ratio.toFixed(2)} (line-height: ${lineHeight}px, font-size: ${fontSize}px). The recommended range is 1.2 - 2.0.`,
        elementSelector: el.selector,
        recommendation:
          ratio < 1.2
            ? "Increase the line-height to improve readability. A ratio of 1.5 is a good starting point for body text."
            : "Decrease the line-height to reduce excessive spacing between lines. A ratio of 1.5 to 1.6 is typical for body text.",
        details: {
          ratio: parseFloat(ratio.toFixed(2)),
          fontSize,
          lineHeight,
          viewport: viewportName,
        },
      });
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

  for (const el of truncatedElements.slice(0, 10)) {
    issues.push({
      category: "typography",
      severity: "warning",
      ruleId: "text-overflow",
      title: `Possible text truncation on ${viewportName}`,
      description: `<${el.tagName}> has overflow: hidden which may clip text content. If this element contains truncated text, users may miss important information.`,
      elementSelector: el.selector,
      recommendation:
        "Ensure text is not unintentionally clipped. If truncation is intentional, provide a way for users to access the full text (e.g., a tooltip, expandable section, or a link to the full content).",
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

    if (longLineElements.length > 0) {
      issues.push({
        category: "typography",
        severity: "info",
        ruleId: "long-lines",
        title: `${longLineElements.length} text container(s) with long line lengths on ${viewportName}`,
        description: `Found ${longLineElements.length} text element(s) wider than the recommended ~80 character line length. Long lines are harder to read as the eye must travel far to find the start of the next line.`,
        recommendation:
          "Set a max-width on text containers (e.g., max-width: 65ch or ~640px) to keep line lengths comfortable for reading.",
        details: {
          count: longLineElements.length,
          viewport: viewportName,
        },
      });

      for (const el of longLineElements.slice(0, 5)) {
        issues.push({
          category: "typography",
          severity: "info",
          ruleId: "long-lines",
          title: `Long line length on ${viewportName}`,
          description: `<${el.tagName}> is ${Math.round(el.rect.width)}px wide, which likely produces lines exceeding 80 characters.`,
          elementSelector: el.selector,
          recommendation:
            "Add max-width: 65ch or a similar constraint to improve readability.",
          details: {
            width: Math.round(el.rect.width),
            viewport: viewportName,
          },
        });
      }
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
