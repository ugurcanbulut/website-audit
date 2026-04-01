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
  for (const el of interactiveElements) {
    const width = Math.round(el.rect.width);
    const height = Math.round(el.rect.height);

    if (width < MIN_TARGET_SIZE || height < MIN_TARGET_SIZE) {
      const shortfallW = width < MIN_TARGET_SIZE ? MIN_TARGET_SIZE - width : 0;
      const shortfallH = height < MIN_TARGET_SIZE ? MIN_TARGET_SIZE - height : 0;

      issues.push({
        category: "touch-targets",
        severity: "critical",
        ruleId: "small-touch-target",
        title: `Small touch target: ${el.tagName} (${width}\u00d7${height}px)`,
        description: `Element is ${width}\u00d7${height}px, needs minimum 44\u00d744px. ${shortfallW > 0 ? shortfallW + "px too narrow. " : ""}${shortfallH > 0 ? shortfallH + "px too short." : ""}`.trim(),
        elementSelector: el.selector,
        recommendation: `Add min-width: 44px; min-height: 44px; or use padding to increase tap area.`,
        details: {
          viewport: viewportName,
          width,
          height,
          shortfall: { width: shortfallW, height: shortfallH },
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

  for (const { elA, elB, distance } of closePairs) {
    issues.push({
      category: "touch-targets",
      severity: "warning",
      ruleId: "close-touch-targets",
      title: `Touch targets too close: ${elA.tagName} and ${elB.tagName} (${Math.round(distance)}px apart)`,
      description: `<${elA.tagName}> and <${elB.tagName}> are only ${Math.round(distance)}px apart (minimum recommended: ${MIN_TARGET_SPACING}px).`,
      elementSelector: elA.selector,
      recommendation:
        `Add margin or gap of at least ${MIN_TARGET_SPACING}px between these interactive elements.`,
      details: {
        distance: Math.round(distance),
        minSpacing: MIN_TARGET_SPACING,
        elementA: elA.selector,
        elementB: elB.selector,
        viewport: viewportName,
      },
    });
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
