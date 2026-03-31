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
 * Responsive layout checks across multiple viewport snapshots.
 */
export function runResponsiveChecks(
  snapshots: Map<string, DomSnapshot>
): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  // --- Horizontal overflow ---
  for (const [viewportName, snapshot] of snapshots) {
    if (snapshot.documentWidth > snapshot.viewportWidth) {
      // Find specific elements causing the overflow
      const overflowingElements = snapshot.elements.filter(
        (el) =>
          el.isVisible && el.rect.x + el.rect.width > snapshot.viewportWidth
      );

      issues.push({
        category: "responsive",
        severity: "critical",
        ruleId: "horizontal-overflow",
        title: `Horizontal overflow detected on ${viewportName}`,
        description: `The document width (${snapshot.documentWidth}px) exceeds the viewport width (${snapshot.viewportWidth}px). ${overflowingElements.length} element(s) extend beyond the viewport boundary.`,
        recommendation:
          "Ensure all content fits within the viewport width. Check for fixed-width elements, overflowing images, or elements with explicit widths that exceed the viewport. Use max-width: 100% on images and overflow-x: hidden cautiously.",
        details: {
          documentWidth: snapshot.documentWidth,
          viewportWidth: snapshot.viewportWidth,
          overflowAmount: snapshot.documentWidth - snapshot.viewportWidth,
          overflowingSelectors: overflowingElements
            .slice(0, 10)
            .map((el) => el.selector),
          viewport: viewportName,
        },
      });

      // Report up to 5 individual overflowing elements
      for (const el of overflowingElements.slice(0, 5)) {
        issues.push({
          category: "responsive",
          severity: "critical",
          ruleId: "horizontal-overflow",
          title: `Element overflows viewport on ${viewportName}`,
          description: `<${el.tagName}> extends ${Math.round(el.rect.x + el.rect.width - snapshot.viewportWidth)}px beyond the viewport right edge.`,
          elementSelector: el.selector,
          recommendation:
            "Add max-width: 100%, use overflow: hidden on a parent, or adjust the element's width to fit the viewport.",
          details: {
            elementRight: Math.round(el.rect.x + el.rect.width),
            viewportWidth: snapshot.viewportWidth,
            viewport: viewportName,
          },
        });
      }
    }
  }

  // --- Content clipping ---
  for (const [viewportName, snapshot] of snapshots) {
    const clippingElements = snapshot.elements.filter(
      (el) =>
        el.isVisible &&
        (el.computedStyles.overflow === "hidden" ||
          el.computedStyles.overflowX === "hidden" ||
          el.computedStyles.overflowY === "hidden") &&
        el.rect.width > 0 &&
        el.rect.height > 0
    );

    for (const el of clippingElements.slice(0, 10)) {
      // Check if interactive children might be clipped
      const hasInteractiveContent =
        el.isInteractive ||
        el.tagName === "nav" ||
        el.tagName === "form";

      if (hasInteractiveContent) {
        issues.push({
          category: "responsive",
          severity: "warning",
          ruleId: "content-clipping",
          title: `Interactive element may clip content on ${viewportName}`,
          description: `<${el.tagName}> has overflow: hidden and contains interactive content that may be inaccessible if clipped.`,
          elementSelector: el.selector,
          recommendation:
            "Verify that no interactive content is hidden by overflow clipping. Consider using overflow: auto or overflow: visible, or ensure the container is large enough for its content.",
          details: {
            overflow: el.computedStyles.overflow,
            overflowX: el.computedStyles.overflowX,
            overflowY: el.computedStyles.overflowY,
            width: Math.round(el.rect.width),
            height: Math.round(el.rect.height),
            viewport: viewportName,
          },
        });
      }
    }
  }

  // --- Element visibility across viewports ---
  const viewportNames = Array.from(snapshots.keys());
  if (viewportNames.length >= 2) {
    // Build a map of selectors to visibility per viewport
    const selectorVisibility = new Map<
      string,
      Map<string, boolean>
    >();

    for (const [viewportName, snapshot] of snapshots) {
      for (const el of snapshot.elements) {
        if (!el.isInteractive) continue;
        if (!selectorVisibility.has(el.selector)) {
          selectorVisibility.set(el.selector, new Map());
        }
        selectorVisibility.get(el.selector)!.set(viewportName, el.isVisible);
      }
    }

    // Find elements visible in some viewports but not others
    for (const [selector, visMap] of selectorVisibility) {
      const visibleIn = Array.from(visMap.entries())
        .filter(([, vis]) => vis)
        .map(([name]) => name);
      const hiddenIn = Array.from(visMap.entries())
        .filter(([, vis]) => !vis)
        .map(([name]) => name);

      if (visibleIn.length > 0 && hiddenIn.length > 0) {
        issues.push({
          category: "responsive",
          severity: "warning",
          ruleId: "element-visibility",
          title: "Interactive element hidden in some viewports",
          description: `An interactive element is visible in ${visibleIn.join(", ")} but hidden in ${hiddenIn.join(", ")}. Ensure equivalent functionality is available in all viewports.`,
          elementSelector: selector,
          recommendation:
            "If this element provides important functionality, ensure an alternative is available in the viewports where it is hidden. Common patterns include hamburger menus or responsive navigation.",
          details: {
            visibleIn,
            hiddenIn,
          },
        });
      }
    }
  }

  // --- Layout consistency across viewports ---
  if (viewportNames.length >= 2) {
    // Compare the proportional positions of key elements across viewports
    const firstViewportName = viewportNames[0];
    const firstSnapshot = snapshots.get(firstViewportName)!;
    const lastViewportName = viewportNames[viewportNames.length - 1];
    const lastSnapshot = snapshots.get(lastViewportName)!;

    // Build a lookup for the second viewport
    const lastSelectorMap = new Map(
      lastSnapshot.elements.map((el) => [el.selector, el])
    );

    let largeShiftCount = 0;
    for (const el of firstSnapshot.elements) {
      if (!el.isVisible) continue;
      const counterpart = lastSelectorMap.get(el.selector);
      if (!counterpart || !counterpart.isVisible) continue;

      // Compare proportional horizontal positions
      const firstPropX = el.rect.x / firstSnapshot.viewportWidth;
      const lastPropX = counterpart.rect.x / lastSnapshot.viewportWidth;
      const xShift = Math.abs(firstPropX - lastPropX);

      if (xShift > 0.3) {
        largeShiftCount++;
      }
    }

    if (largeShiftCount > 5) {
      issues.push({
        category: "responsive",
        severity: "info",
        ruleId: "layout-consistency",
        title: "Significant layout shifts between viewports",
        description: `${largeShiftCount} elements have significantly different proportional positions between ${firstViewportName} and ${lastViewportName}. This may indicate layout inconsistencies or could be expected responsive behavior.`,
        recommendation:
          "Review the layout across viewports to ensure content reflows intentionally and maintains a logical reading order.",
        details: {
          elementCount: largeShiftCount,
          comparedViewports: [firstViewportName, lastViewportName],
        },
      });
    }
  }

  return issues;
}
