import type { DomSnapshot } from "@/lib/scanner/capture";

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

/**
 * Visual consistency checks across multiple viewport snapshots.
 */
export function runVisualConsistencyChecks(
  snapshots: Map<string, DomSnapshot>
): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  // Aggregate data across all snapshots
  const allMarginTops = new Set<string>();
  const allTextColors = new Set<string>();
  const allBgColors = new Set<string>();
  const visibleCountByViewport = new Map<string, number>();

  for (const [viewportName, snapshot] of snapshots) {
    let visibleCount = 0;

    for (const el of snapshot.elements) {
      if (!el.isVisible) continue;
      visibleCount++;

      // Collect spacing values
      if (el.computedStyles.marginTop) {
        allMarginTops.add(el.computedStyles.marginTop);
      }

      // Collect colors (normalize to avoid trivial duplicates)
      const textColor = normalizeColor(el.computedStyles.color);
      const bgColor = normalizeColor(el.computedStyles.backgroundColor);

      if (textColor && textColor !== "transparent") {
        allTextColors.add(textColor);
      }
      if (bgColor && bgColor !== "transparent") {
        allBgColors.add(bgColor);
      }
    }

    visibleCountByViewport.set(viewportName, visibleCount);
  }

  // --- Inconsistent spacing ---
  // Parse and deduplicate margin-top values as numbers
  const uniqueMarginValues = new Set<number>();
  for (const val of allMarginTops) {
    const px = parsePx(val);
    if (px !== null && px > 0) {
      uniqueMarginValues.add(Math.round(px));
    }
  }

  if (uniqueMarginValues.size > 8) {
    const sortedValues = Array.from(uniqueMarginValues).sort((a, b) => a - b);
    issues.push({
      category: "visual",
      severity: "info",
      ruleId: "inconsistent-spacing",
      title: `${uniqueMarginValues.size} distinct margin-top values detected`,
      description: `Found ${uniqueMarginValues.size} unique non-zero margin-top values across all viewports. A consistent design system typically uses 4-8 spacing values. Too many unique values may indicate ad-hoc spacing decisions.`,
      recommendation:
        "Adopt a consistent spacing scale (e.g., 4, 8, 12, 16, 24, 32, 48, 64px) and refactor existing margins to align with it. CSS custom properties or utility classes can help enforce consistency.",
      details: {
        uniqueCount: uniqueMarginValues.size,
        values: sortedValues.slice(0, 20),
        threshold: 8,
      },
    });
  }

  // --- Color palette analysis ---
  if (allTextColors.size > 15) {
    issues.push({
      category: "visual",
      severity: "info",
      ruleId: "color-palette",
      title: `${allTextColors.size} distinct text colors detected`,
      description: `Found ${allTextColors.size} unique text colors across all viewports. A well-defined design system typically uses a limited palette of text colors. Too many distinct colors may indicate inconsistencies.`,
      recommendation:
        "Define a text color palette with primary, secondary, and muted text colors. Use CSS custom properties (e.g., --text-primary, --text-secondary) to enforce consistency across the site.",
      details: {
        uniqueTextColors: allTextColors.size,
        threshold: 15,
        sampleColors: Array.from(allTextColors).slice(0, 20),
      },
    });
  }

  if (allBgColors.size > 15) {
    issues.push({
      category: "visual",
      severity: "info",
      ruleId: "color-palette",
      title: `${allBgColors.size} distinct background colors detected`,
      description: `Found ${allBgColors.size} unique background colors across all viewports. Consider consolidating into a defined color palette for visual consistency.`,
      recommendation:
        "Define a background color palette and use CSS custom properties to apply them consistently. Limit surface colors to a manageable set (e.g., base, surface, elevated, overlay).",
      details: {
        uniqueBgColors: allBgColors.size,
        threshold: 15,
        sampleColors: Array.from(allBgColors).slice(0, 20),
      },
    });
  }

  // --- Element count variation across viewports ---
  const viewportCounts = Array.from(visibleCountByViewport.entries());
  if (viewportCounts.length >= 2) {
    const counts = viewportCounts.map(([, count]) => count);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);

    // Check if the difference exceeds 50%
    if (maxCount > 0 && (maxCount - minCount) / maxCount > 0.5) {
      const maxViewport = viewportCounts.find(([, c]) => c === maxCount)![0];
      const minViewport = viewportCounts.find(([, c]) => c === minCount)![0];
      const percentDiff = Math.round(((maxCount - minCount) / maxCount) * 100);

      issues.push({
        category: "visual",
        severity: "warning",
        ruleId: "element-count-variation",
        title: `Large element count variation across viewports (${percentDiff}% difference)`,
        description: `The number of visible elements varies significantly between viewports: ${maxViewport} has ${maxCount} elements while ${minViewport} has only ${minCount}. A ${percentDiff}% reduction may mean mobile users are missing important content.`,
        recommendation:
          "Review content parity between viewports. While some reduction is expected (e.g., hiding decorative elements), ensure all essential content and functionality is available across all viewport sizes.",
        details: {
          counts: Object.fromEntries(viewportCounts),
          maxViewport,
          maxCount,
          minViewport,
          minCount,
          percentDifference: percentDiff,
          threshold: 50,
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

/**
 * Normalize a CSS color string for deduplication.
 * Trims whitespace and lowercases. The computed style will typically be in
 * rgb()/rgba() format, which is already fairly normalized.
 */
function normalizeColor(color: string | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim().toLowerCase();
  if (!trimmed || trimmed === "transparent" || trimmed === "rgba(0, 0, 0, 0)") {
    return "transparent";
  }
  return trimmed;
}
