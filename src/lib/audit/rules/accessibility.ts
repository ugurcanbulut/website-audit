import type { DomSnapshot, DomElement } from "@/lib/scanner/capture";

export interface AuditIssueInput {
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

// ---------------------------------------------------------------------------
// Color helpers (WCAG 2.1 contrast ratio calculation)
// ---------------------------------------------------------------------------

function parseColor(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(
  color1: [number, number, number],
  color2: [number, number, number]
): number {
  const l1 = relativeLuminance(...color1);
  const l2 = relativeLuminance(...color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse a CSS font-size value to a number in pixels.  Returns null when the
 * value cannot be determined.
 */
function parseFontSizePx(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^([\d.]+)px$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Return true when the font weight string resolves to bold (>= 700).
 */
function isBold(fontWeight: string | undefined): boolean {
  if (!fontWeight) return false;
  if (fontWeight === "bold" || fontWeight === "bolder") return true;
  const numeric = parseInt(fontWeight, 10);
  return !isNaN(numeric) && numeric >= 700;
}

/**
 * Determines whether text should be considered "large" per WCAG 2.1.
 * Large text is >= 18px, or >= 14px and bold.
 */
function isLargeText(el: DomElement): boolean {
  const size = parseFontSizePx(el.computedStyles.fontSize);
  if (size === null) return false;
  if (size >= 18) return true;
  if (size >= 14 && isBold(el.computedStyles.fontWeight)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Snapshot query helpers
// ---------------------------------------------------------------------------

function visible(el: DomElement): boolean {
  return el.isVisible;
}

function attr(el: DomElement, name: string): string | undefined {
  return el.attributes[name];
}

function hasAttr(el: DomElement, name: string): boolean {
  return name in el.attributes;
}

/**
 * Build a minimal HTML representation of an element from the snapshot data.
 * This is used in issue reports so the user can identify the element.
 */
function elementHtml(el: DomElement): string {
  const attrStr = Object.entries(el.attributes)
    .slice(0, 6) // keep it short
    .map(([k, v]) => (v ? `${k}="${v}"` : k))
    .join(" ");
  return `<${el.tagName}${attrStr ? " " + attrStr : ""}>`;
}

// ---------------------------------------------------------------------------
// Individual rule checks
// ---------------------------------------------------------------------------

/**
 * Rule: img-alt
 * Images must have an alt attribute.  An empty alt="" is acceptable only when
 * the image is explicitly decorative (role="presentation" or role="none").
 */
function checkImgAlt(elements: DomElement[]): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  for (const el of elements) {
    if (el.tagName !== "img" || !visible(el)) continue;

    const alt = attr(el, "alt");
    const role = attr(el, "role");
    const isDecorative = role === "presentation" || role === "none";

    if (!hasAttr(el, "alt")) {
      // Missing alt attribute entirely
      issues.push({
        category: "accessibility",
        severity: "critical",
        ruleId: "img-alt",
        title: "Image missing alt attribute",
        description: `The image at "${el.selector}" has no alt attribute. Screen readers cannot describe this image to users.`,
        elementSelector: el.selector,
        elementHtml: elementHtml(el),
        recommendation:
          "Add a descriptive alt attribute. If the image is purely decorative, use alt=\"\" together with role=\"presentation\".",
        details: { src: attr(el, "src") },
      });
    } else if (alt === "" && !isDecorative) {
      // Empty alt without decorative role -- might be an oversight
      issues.push({
        category: "accessibility",
        severity: "warning",
        ruleId: "img-alt",
        title: "Image has empty alt text without decorative role",
        description: `The image at "${el.selector}" has an empty alt attribute but is not marked as decorative. If the image conveys meaning, it needs descriptive alt text.`,
        elementSelector: el.selector,
        elementHtml: elementHtml(el),
        recommendation:
          'Add descriptive alt text, or explicitly mark the image as decorative with role="presentation".',
        details: { src: attr(el, "src") },
      });
    }
  }

  return issues;
}

/**
 * Rule: form-label
 * Form controls must have an accessible label via aria-label,
 * aria-labelledby, a wrapping <label>, or an associated <label for="...">.
 */
function checkFormLabels(elements: DomElement[]): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];
  const formTags = new Set(["input", "select", "textarea"]);

  // Build a set of IDs that have a <label for="..."> pointing at them.
  const labelledIds = new Set<string>();
  for (const el of elements) {
    if (el.tagName === "label") {
      const forId = attr(el, "for");
      if (forId) labelledIds.add(forId);
    }
  }

  for (const el of elements) {
    if (!formTags.has(el.tagName) || !visible(el)) continue;

    // Hidden inputs never need labels
    if (attr(el, "type") === "hidden") continue;

    // Submit / reset / button inputs have built-in labels via their value
    const inputType = attr(el, "type");
    if (
      inputType === "submit" ||
      inputType === "reset" ||
      inputType === "button" ||
      inputType === "image"
    ) {
      continue;
    }

    const hasAriaLabel = !!attr(el, "aria-label");
    const hasAriaLabelledby = !!attr(el, "aria-labelledby");
    const hasTitle = !!attr(el, "title");
    const hasPlaceholder = !!attr(el, "placeholder");
    const id = attr(el, "id");
    const hasAssociatedLabel = id ? labelledIds.has(id) : false;

    if (!hasAriaLabel && !hasAriaLabelledby && !hasAssociatedLabel && !hasTitle) {
      issues.push({
        category: "accessibility",
        severity: "critical",
        ruleId: "form-label",
        title: "Form control missing accessible label",
        description: `The ${el.tagName} at "${el.selector}" does not have an associated label. Screen reader users will not know what this field is for.`,
        elementSelector: el.selector,
        elementHtml: elementHtml(el),
        recommendation:
          "Associate a <label> element using the for/id pairing, or add an aria-label or aria-labelledby attribute.",
        details: {
          tagName: el.tagName,
          type: inputType ?? null,
          hasPlaceholder,
        },
      });
    }
  }

  return issues;
}

/**
 * Rule: empty-interactive
 * Links and buttons must have discernible text so screen readers can
 * announce them.  We approximate this from the snapshot attributes since
 * we do not have full innerText.
 */
function checkEmptyInteractive(elements: DomElement[]): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];
  const interactiveTags = new Set(["a", "button"]);

  for (const el of elements) {
    if (!interactiveTags.has(el.tagName) || !visible(el)) continue;

    const hasAriaLabel = !!attr(el, "aria-label");
    const hasAriaLabelledby = !!attr(el, "aria-labelledby");
    const hasTitle = !!attr(el, "title");
    const hasValue = !!attr(el, "value");

    // If the element has no text-providing attribute and is very small
    // (icon-only buttons/links are common), flag it.  Since we cannot
    // inspect innerText from the snapshot we rely on attribute heuristics:
    // an element with none of the known text-providing attributes is suspect.
    if (!hasAriaLabel && !hasAriaLabelledby && !hasTitle && !hasValue) {
      // Extra heuristic: if the element has an inner img with alt, it is
      // likely fine, but we cannot inspect child relationships in a flat
      // element list.  We flag it as a warning so it can be reviewed.
      issues.push({
        category: "accessibility",
        severity: "warning",
        ruleId: "empty-interactive",
        title: `Possibly empty ${el.tagName} element`,
        description: `The ${el.tagName} at "${el.selector}" has no aria-label, aria-labelledby, or title attribute. If it also lacks visible text content, screen reader users will hear no label.`,
        elementSelector: el.selector,
        elementHtml: elementHtml(el),
        recommendation:
          "Add visible text content, or provide an aria-label attribute describing the purpose of the element.",
        details: { tagName: el.tagName },
      });
    }
  }

  return issues;
}

/**
 * Rule: heading-hierarchy
 * Headings should not skip levels (e.g. h1 -> h3 without h2).
 */
function checkHeadingHierarchy(elements: DomElement[]): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];
  const headingRegex = /^h([1-6])$/;

  // Collect visible headings in document order (snapshot preserves DOM order).
  const headings: { level: number; el: DomElement }[] = [];
  for (const el of elements) {
    const match = el.tagName.match(headingRegex);
    if (match && visible(el)) {
      headings.push({ level: parseInt(match[1]), el });
    }
  }

  if (headings.length === 0) return issues;

  // Check that the first heading starts at h1
  if (headings[0].level !== 1) {
    issues.push({
      category: "accessibility",
      severity: "warning",
      ruleId: "heading-hierarchy",
      title: "Page does not start with an h1 heading",
      description: `The first heading on the page is an h${headings[0].level}. Every page should begin with an h1 as the primary heading.`,
      elementSelector: headings[0].el.selector,
      elementHtml: elementHtml(headings[0].el),
      recommendation: "Ensure the page has an h1 element as its first heading.",
      details: {
        firstHeadingLevel: headings[0].level,
      },
    });
  }

  // Walk headings and flag skipped levels
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;

    // Going deeper by more than one level is a skip
    if (curr > prev + 1) {
      const skipped: number[] = [];
      for (let lvl = prev + 1; lvl < curr; lvl++) skipped.push(lvl);

      issues.push({
        category: "accessibility",
        severity: "warning",
        ruleId: "heading-hierarchy",
        title: `Heading level skipped: h${prev} to h${curr}`,
        description: `The heading "${headings[i].el.selector}" jumps from h${prev} to h${curr}, skipping h${skipped.join(", h")}. This creates a confusing document outline for screen reader users.`,
        elementSelector: headings[i].el.selector,
        elementHtml: elementHtml(headings[i].el),
        recommendation: `Add the missing h${skipped.join("/h")} heading(s), or restructure the heading levels so they don't skip.`,
        details: {
          previousLevel: prev,
          currentLevel: curr,
          skippedLevels: skipped,
        },
      });
    }
  }

  return issues;
}

/**
 * Rule: landmark-regions
 * Pages should use landmark regions (main, nav, header, footer) either via
 * semantic HTML5 elements or ARIA roles.
 */
function checkLandmarkRegions(elements: DomElement[]): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  // Map of landmark kind -> HTML tags and ARIA roles that satisfy it
  const landmarks: Record<string, { tags: string[]; roles: string[] }> = {
    main: { tags: ["main"], roles: ["main"] },
    navigation: { tags: ["nav"], roles: ["navigation"] },
    banner: { tags: ["header"], roles: ["banner"] },
    contentinfo: { tags: ["footer"], roles: ["contentinfo"] },
  };

  const found: Record<string, boolean> = {};

  for (const [key, { tags, roles }] of Object.entries(landmarks)) {
    found[key] = elements.some(
      (el) =>
        visible(el) &&
        (tags.includes(el.tagName) ||
          (attr(el, "role") !== undefined && roles.includes(attr(el, "role")!)))
    );
  }

  const missing = Object.entries(found)
    .filter(([, present]) => !present)
    .map(([name]) => name);

  if (missing.length > 0) {
    issues.push({
      category: "accessibility",
      severity: "info",
      ruleId: "landmark-regions",
      title: "Page missing landmark regions",
      description: `The page is missing the following landmark regions: ${missing.join(", ")}. Landmark regions help screen reader users navigate the page structure quickly.`,
      recommendation:
        "Use semantic HTML5 elements (<main>, <nav>, <header>, <footer>) or equivalent ARIA role attributes to define landmark regions.",
      details: { presentLandmarks: Object.keys(found).filter((k) => found[k]), missingLandmarks: missing },
    });
  }

  // Additionally report a pass if all landmarks are present
  if (missing.length === 0) {
    issues.push({
      category: "accessibility",
      severity: "pass",
      ruleId: "landmark-regions",
      title: "All expected landmark regions are present",
      description:
        "The page contains main, navigation, banner, and contentinfo landmark regions.",
      details: { presentLandmarks: Object.keys(found) },
    });
  }

  return issues;
}

/**
 * Rule: color-contrast
 * Check text elements for sufficient color contrast between foreground and
 * background colors (WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text).
 */
function checkColorContrast(elements: DomElement[]): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  // Only check elements that are likely to contain text
  const textTags = new Set([
    "p",
    "a",
    "button",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "label",
    "input",
    "select",
    "textarea",
    "summary",
  ]);

  for (const el of elements) {
    if (!textTags.has(el.tagName) || !visible(el)) continue;

    const fgRaw = el.computedStyles.color;
    const bgRaw = el.computedStyles.backgroundColor;

    if (!fgRaw || !bgRaw) continue;

    const fg = parseColor(fgRaw);
    const bg = parseColor(bgRaw);

    if (!fg || !bg) continue;

    // Skip fully transparent backgrounds -- we cannot determine the effective
    // background in that case since we lack the parent chain.
    const bgAlphaMatch = bgRaw.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
    if (bgAlphaMatch && parseFloat(bgAlphaMatch[1]) === 0) continue;

    const ratio = contrastRatio(fg, bg);
    const large = isLargeText(el);
    const requiredRatio = large ? 3 : 4.5;

    if (ratio < requiredRatio) {
      issues.push({
        category: "accessibility",
        severity: "warning",
        ruleId: "color-contrast",
        title: "Insufficient color contrast",
        description: `The element at "${el.selector}" has a contrast ratio of ${ratio.toFixed(2)}:1, which is below the WCAG AA requirement of ${requiredRatio}:1 for ${large ? "large" : "normal"} text.`,
        elementSelector: el.selector,
        elementHtml: elementHtml(el),
        recommendation: `Increase the contrast ratio to at least ${requiredRatio}:1. Current foreground: ${fgRaw}, background: ${bgRaw}.`,
        details: {
          contrastRatio: parseFloat(ratio.toFixed(2)),
          requiredRatio,
          foreground: fgRaw,
          background: bgRaw,
          fontSize: el.computedStyles.fontSize,
          fontWeight: el.computedStyles.fontWeight,
          isLargeText: large,
        },
      });
    }
  }

  return issues;
}

/**
 * Rule: keyboard-accessible
 * Elements with click handlers should be keyboard-accessible.  Non-native
 * interactive elements (divs, spans) that carry an onclick attribute but
 * have no tabindex and are not natively focusable are flagged.
 */
function checkKeyboardAccessible(elements: DomElement[]): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  // Tags that are natively keyboard-focusable
  const nativelyFocusable = new Set([
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    "details",
  ]);

  for (const el of elements) {
    if (!visible(el)) continue;
    if (!hasAttr(el, "onclick")) continue;

    // Already natively focusable
    if (nativelyFocusable.has(el.tagName)) continue;

    // Has a role that implies focusability and a tabindex
    if (hasAttr(el, "tabindex")) continue;

    issues.push({
      category: "accessibility",
      severity: "warning",
      ruleId: "keyboard-accessible",
      title: "Click handler without keyboard access",
      description: `The ${el.tagName} at "${el.selector}" has an onclick handler but is not natively focusable and has no tabindex attribute. Keyboard-only users cannot interact with this element.`,
      elementSelector: el.selector,
      elementHtml: elementHtml(el),
      recommendation:
        'Add tabindex="0" and appropriate keyboard event handlers (onkeydown/onkeypress) to make this element keyboard-accessible, or use a native interactive element like <button>.',
      details: {
        tagName: el.tagName,
        role: attr(el, "role") ?? null,
      },
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run all accessibility checks against a captured DOM snapshot.
 *
 * This is designed to run *after* the browser session is closed, operating
 * purely on the serialised DomSnapshot data that was collected during the
 * capture phase.  It does not require a live browser.
 */
export function runAccessibilityChecks(
  domSnapshot: DomSnapshot,
  viewportName: string
): AuditIssueInput[] {
  const { elements } = domSnapshot;

  const issues: AuditIssueInput[] = [
    ...checkImgAlt(elements),
    ...checkFormLabels(elements),
    ...checkEmptyInteractive(elements),
    ...checkHeadingHierarchy(elements),
    ...checkLandmarkRegions(elements),
    ...checkColorContrast(elements),
    ...checkKeyboardAccessible(elements),
  ];

  // Tag every issue with the viewport that produced it (via details)
  for (const issue of issues) {
    issue.details = { ...issue.details, viewport: viewportName };
  }

  return issues;
}
