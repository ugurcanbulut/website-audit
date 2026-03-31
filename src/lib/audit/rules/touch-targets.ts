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

const MIN_TARGET_SIZE = 44; // px, per WCAG 2.5.5 / Apple HIG
const MIN_TARGET_SPACING = 8; // px, minimum spacing between targets

/**
 * Touch target checks for mobile and tablet viewports.
 * Only runs on non-desktop viewports.
 */
export function runTouchTargetChecks(
  domSnapshot: DomSnapshot,
  viewportName: string,
  viewportType: string
): AuditIssueInput[] {
  // Only relevant for touch viewports
  if (viewportType === "desktop") {
    return [];
  }

  const issues: AuditIssueInput[] = [];

  const interactiveElements = domSnapshot.elements.filter(
    (el) => el.isInteractive && el.isVisible
  );

  // --- Small touch targets ---
  const smallTargets: Array<{ el: DomElement; width: number; height: number }> = [];

  for (const el of interactiveElements) {
    const width = Math.round(el.rect.width);
    const height = Math.round(el.rect.height);

    if (width < MIN_TARGET_SIZE || height < MIN_TARGET_SIZE) {
      smallTargets.push({ el, width, height });
    }
  }

  if (smallTargets.length > 0) {
    issues.push({
      category: "touch-targets",
      severity: "critical",
      ruleId: "small-touch-target",
      title: `${smallTargets.length} small touch target(s) on ${viewportName}`,
      description: `Found ${smallTargets.length} interactive element(s) smaller than the recommended ${MIN_TARGET_SIZE}x${MIN_TARGET_SIZE}px minimum touch target size. Small targets are difficult to tap accurately on touchscreens.`,
      recommendation:
        "Increase the size of interactive elements to at least 44x44px. Use padding to increase the tappable area without changing visual appearance. This follows WCAG 2.5.5 and mobile platform guidelines.",
      details: {
        count: smallTargets.length,
        minSize: MIN_TARGET_SIZE,
        viewport: viewportName,
        viewportType,
      },
    });

    for (const { el, width, height } of smallTargets.slice(0, 10)) {
      const underW = width < MIN_TARGET_SIZE ? MIN_TARGET_SIZE - width : 0;
      const underH = height < MIN_TARGET_SIZE ? MIN_TARGET_SIZE - height : 0;

      issues.push({
        category: "touch-targets",
        severity: "critical",
        ruleId: "small-touch-target",
        title: `Small touch target on ${viewportName}`,
        description: `<${el.tagName}> is ${width}x${height}px, which is below the ${MIN_TARGET_SIZE}x${MIN_TARGET_SIZE}px minimum. ${underW > 0 ? `${underW}px too narrow.` : ""} ${underH > 0 ? `${underH}px too short.` : ""}`.trim(),
        elementSelector: el.selector,
        recommendation:
          "Increase the element's tappable area to at least 44x44px using padding or min-width/min-height.",
        details: {
          width,
          height,
          minSize: MIN_TARGET_SIZE,
          shortfall: { width: underW, height: underH },
          viewport: viewportName,
        },
      });
    }
  }

  // --- Close touch targets ---
  // Limit pairwise comparison to a reasonable count to avoid O(n^2) explosion
  const targetsToCheck = interactiveElements.slice(0, 100);
  const closePairs: Array<{
    elA: DomElement;
    elB: DomElement;
    distance: number;
  }> = [];

  for (let i = 0; i < targetsToCheck.length; i++) {
    const a = targetsToCheck[i];
    for (let j = i + 1; j < targetsToCheck.length; j++) {
      const b = targetsToCheck[j];
      const distance = edgeDistance(a, b);

      if (distance >= 0 && distance < MIN_TARGET_SPACING) {
        closePairs.push({ elA: a, elB: b, distance });
      }
    }
  }

  if (closePairs.length > 0) {
    issues.push({
      category: "touch-targets",
      severity: "warning",
      ruleId: "close-touch-targets",
      title: `${closePairs.length} pair(s) of touch targets too close together on ${viewportName}`,
      description: `Found ${closePairs.length} pair(s) of interactive elements within ${MIN_TARGET_SPACING}px of each other. Close targets increase the risk of accidental taps.`,
      recommendation:
        `Increase spacing between interactive elements to at least ${MIN_TARGET_SPACING}px. Use margin or gap properties to create adequate spacing.`,
      details: {
        pairCount: closePairs.length,
        minSpacing: MIN_TARGET_SPACING,
        viewport: viewportName,
        viewportType,
      },
    });

    for (const { elA, elB, distance } of closePairs.slice(0, 5)) {
      issues.push({
        category: "touch-targets",
        severity: "warning",
        ruleId: "close-touch-targets",
        title: `Touch targets too close on ${viewportName}`,
        description: `<${elA.tagName}> and <${elB.tagName}> are only ${Math.round(distance)}px apart (minimum recommended: ${MIN_TARGET_SPACING}px).`,
        elementSelector: elA.selector,
        recommendation:
          "Add more spacing between these interactive elements to prevent accidental taps.",
        details: {
          distance: Math.round(distance),
          minSpacing: MIN_TARGET_SPACING,
          elementA: elA.selector,
          elementB: elB.selector,
          viewport: viewportName,
        },
      });
    }
  }

  return issues;
}

/**
 * Compute the minimum edge-to-edge distance between two element rects.
 * Returns the gap between the closest edges. Negative values mean overlap.
 */
function edgeDistance(a: DomElement, b: DomElement): number {
  const aRight = a.rect.x + a.rect.width;
  const aBottom = a.rect.y + a.rect.height;
  const bRight = b.rect.x + b.rect.width;
  const bBottom = b.rect.y + b.rect.height;

  // Horizontal gap
  const hGap = Math.max(0, Math.max(b.rect.x - aRight, a.rect.x - bRight));
  // Vertical gap
  const vGap = Math.max(0, Math.max(b.rect.y - aBottom, a.rect.y - bBottom));

  // If they don't overlap on both axes, the distance is the Euclidean gap
  if (hGap > 0 && vGap > 0) {
    return Math.sqrt(hGap * hGap + vGap * vGap);
  }

  // If they overlap on one axis, the distance is the gap on the other
  return Math.max(hGap, vGap);
}
