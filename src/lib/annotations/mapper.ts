import type { AuditIssue, IssueSeverity, AuditCategory } from "@/lib/types";
import type { DomSnapshot, DomElement } from "@/lib/scanner/capture";

export interface Annotation {
  id: string;
  issueId: string;
  number: number;
  severity: IssueSeverity;
  category: AuditCategory;
  title: string;
  rect: { x: number; y: number; width: number; height: number };
  source: "tool" | "ai";
}

export function mapIssuesToAnnotations(
  issues: AuditIssue[],
  domSnapshot: DomSnapshot,
  viewportName: string
): Annotation[] {
  const annotations: Annotation[] = [];
  let number = 1;

  for (const issue of issues) {
    // Filter to issues for this viewport
    const issueViewport =
      issue.viewportName ?? (issue.details?.viewport as string | undefined);
    if (issueViewport && issueViewport !== viewportName) continue;

    // AI issues with explicit region coordinates
    if (issue.category === "ai-analysis" && issue.details?.region) {
      const region = issue.details.region as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      if (region.width > 0 && region.height > 0) {
        annotations.push({
          id: `ann-${issue.id}`,
          issueId: issue.id,
          number: number++,
          severity: issue.severity,
          category: issue.category as AuditCategory,
          title: issue.title,
          rect: region,
          source: "ai",
        });
      }
      continue;
    }

    // Tool issues with element selectors
    if (!issue.elementSelector) continue;

    const element = findElementBySelector(domSnapshot, issue.elementSelector);
    if (!element || !element.isVisible) continue;
    if (element.rect.width <= 0 || element.rect.height <= 0) continue;

    annotations.push({
      id: `ann-${issue.id}`,
      issueId: issue.id,
      number: number++,
      severity: issue.severity,
      category: issue.category as AuditCategory,
      title: issue.title,
      rect: element.rect,
      source: "tool",
    });
  }

  return annotations.sort((a, b) => a.rect.y - b.rect.y);
}

function findElementBySelector(
  snapshot: DomSnapshot,
  selector: string
): DomElement | undefined {
  // 1. Exact match
  const exact = snapshot.elements.find((el) => el.selector === selector);
  if (exact) return exact;

  // 2. Try matching by last segment (e.g., for axe-core selectors like "html > body > main > div > a")
  // Axe-core often uses simplified selectors, try matching the end
  const selectorParts = selector.split(" > ");
  if (selectorParts.length >= 2) {
    const lastTwo = selectorParts.slice(-2).join(" > ");
    const partial = snapshot.elements.find((el) =>
      el.selector.endsWith(lastTwo)
    );
    if (partial) return partial;
  }

  // 3. Try matching by tag + id
  const idMatch = selector.match(/#([\w-]+)/);
  if (idMatch) {
    const element = snapshot.elements.find(
      (el) => el.attributes?.id === idMatch[1]
    );
    if (element) return element;
  }

  // 4. Try matching by tag and class
  const classMatch = selector.match(/\.([\w-]+)/);
  if (classMatch) {
    const element = snapshot.elements.find((el) =>
      el.attributes?.class?.includes(classMatch[1])
    );
    if (element) return element;
  }

  return undefined;
}
