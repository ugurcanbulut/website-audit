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

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

const GENERIC_LINK_TEXTS = new Set([
  "click here",
  "here",
  "read more",
  "learn more",
  "more",
  "link",
  "this",
  "go",
  "see more",
  "details",
  "continue",
  "continue reading",
]);

/**
 * SEO-related checks for a single viewport snapshot.
 * Typically run once on the desktop/primary viewport.
 */
export function runSeoChecks(
  domSnapshot: DomSnapshot,
  viewportName: string
): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  // --- Missing H1 ---
  const h1Elements = domSnapshot.elements.filter(
    (el) => el.tagName === "h1" && el.isVisible
  );

  if (h1Elements.length === 0) {
    issues.push({
      category: "seo",
      severity: "critical",
      ruleId: "missing-h1",
      title: "No H1 heading found",
      description:
        "The page does not contain a visible <h1> element. The H1 is a primary signal for search engines to understand the page's main topic and is important for both SEO and accessibility.",
      recommendation:
        "Add a single, descriptive <h1> element that clearly communicates the page's primary topic. It should be visible and placed early in the document.",
      details: { viewport: viewportName },
    });
  }

  // --- Multiple H1s ---
  if (h1Elements.length > 1) {
    issues.push({
      category: "seo",
      severity: "warning",
      ruleId: "multiple-h1",
      title: `${h1Elements.length} H1 headings found`,
      description: `The page contains ${h1Elements.length} visible <h1> elements. While HTML5 technically allows multiple H1s in sectioning content, best practice for SEO is to have a single H1 that defines the page's primary topic.`,
      recommendation:
        "Use a single <h1> for the page's main heading. Downgrade secondary headings to <h2> or lower to establish a clear heading hierarchy.",
      details: {
        count: h1Elements.length,
        selectors: h1Elements.map((el) => el.selector),
        viewport: viewportName,
      },
    });
  }

  // --- Images without alt ---
  const images = domSnapshot.elements.filter(
    (el) => el.tagName === "img" && el.isVisible
  );

  const imagesWithoutAlt: DomElement[] = [];
  for (const img of images) {
    // alt attribute must exist (even empty string is acceptable for decorative images,
    // but missing attribute entirely is the SEO issue)
    if (!("alt" in img.attributes)) {
      imagesWithoutAlt.push(img);
    }
  }

  if (imagesWithoutAlt.length > 0) {
    issues.push({
      category: "seo",
      severity: "warning",
      ruleId: "img-missing-alt",
      title: `${imagesWithoutAlt.length} image(s) missing alt attribute`,
      description: `Found ${imagesWithoutAlt.length} visible <img> element(s) without an alt attribute. Alt text helps search engines understand image content and is required for accessibility.`,
      recommendation:
        "Add descriptive alt text to all meaningful images. Use alt=\"\" (empty string) only for purely decorative images. Never omit the attribute entirely.",
      details: {
        count: imagesWithoutAlt.length,
        viewport: viewportName,
      },
    });

    for (const img of imagesWithoutAlt.slice(0, 10)) {
      const src = img.attributes.src ?? "";
      const filename = src.split("/").pop()?.split("?")[0] ?? src;
      issues.push({
        category: "seo",
        severity: "warning",
        ruleId: "img-missing-alt",
        title: "Image missing alt text",
        description: `<img src="${truncate(filename, 60)}"> is missing the alt attribute.`,
        elementSelector: img.selector,
        recommendation:
          "Add a descriptive alt attribute that conveys the image's content or function. If the image is decorative, use alt=\"\".",
        details: {
          src: truncate(src, 200),
          viewport: viewportName,
        },
      });
    }
  }

  // --- Empty heading tags ---
  const emptyHeadings: DomElement[] = [];
  for (const el of domSnapshot.elements) {
    if (!HEADING_TAGS.has(el.tagName)) continue;
    if (!el.isVisible) continue;

    // Check for empty content indicators:
    // - Very small dimensions suggest no content
    // - No text attributes available, so use rect as proxy
    const isTiny = el.rect.width < 1 || el.rect.height < 1;

    // Also check if aria-label is present (might be an icon-only heading)
    const hasAriaLabel = !!el.attributes["aria-label"];

    if (isTiny && !hasAriaLabel) {
      emptyHeadings.push(el);
    }
  }

  if (emptyHeadings.length > 0) {
    issues.push({
      category: "seo",
      severity: "warning",
      ruleId: "empty-heading",
      title: `${emptyHeadings.length} empty heading(s) detected`,
      description: `Found ${emptyHeadings.length} heading element(s) that appear to have no visible content. Empty headings confuse screen readers and provide no SEO value.`,
      recommendation:
        "Remove empty heading elements or add meaningful content to them. Every heading should describe the section it introduces.",
      details: {
        count: emptyHeadings.length,
        viewport: viewportName,
      },
    });

    for (const el of emptyHeadings.slice(0, 5)) {
      issues.push({
        category: "seo",
        severity: "warning",
        ruleId: "empty-heading",
        title: `Empty <${el.tagName}> element`,
        description: `A <${el.tagName}> element appears to have no visible content (dimensions: ${Math.round(el.rect.width)}x${Math.round(el.rect.height)}px).`,
        elementSelector: el.selector,
        recommendation:
          "Add descriptive text content to this heading or remove it if it serves no purpose.",
        details: {
          tagName: el.tagName,
          width: Math.round(el.rect.width),
          height: Math.round(el.rect.height),
          viewport: viewportName,
        },
      });
    }
  }

  // --- Generic link text ---
  const links = domSnapshot.elements.filter(
    (el) => el.tagName === "a" && el.isVisible
  );

  const genericLinks: Array<{ el: DomElement; text: string }> = [];
  for (const link of links) {
    // Attempt to infer link text from available attributes
    const ariaLabel = link.attributes["aria-label"] ?? "";
    const title = link.attributes.title ?? "";

    // Use aria-label or title as proxy for link text
    const text = (ariaLabel || title).trim().toLowerCase();

    if (text && GENERIC_LINK_TEXTS.has(text)) {
      genericLinks.push({ el: link, text });
    }

    // Also flag links that have no discernible text at all
    // (no aria-label, no title, and very small size suggesting icon-only with no label)
    if (
      !ariaLabel &&
      !title &&
      link.rect.width > 0 &&
      link.rect.height > 0 &&
      link.rect.width < 30 &&
      link.rect.height < 30
    ) {
      // Likely an icon-only link without accessible text
      if (!link.attributes["aria-labelledby"]) {
        genericLinks.push({ el: link, text: "(no discernible text)" });
      }
    }
  }

  if (genericLinks.length > 0) {
    issues.push({
      category: "seo",
      severity: "info",
      ruleId: "generic-link-text",
      title: `${genericLinks.length} link(s) with generic or missing text`,
      description: `Found ${genericLinks.length} link(s) with generic text like "click here" or "read more", or with no discernible text at all. Descriptive link text improves SEO and helps users understand link destinations.`,
      recommendation:
        "Replace generic link text with descriptive text that explains the link's destination or purpose. Instead of \"Read more\", use \"Read our accessibility guide\" or similar.",
      details: {
        count: genericLinks.length,
        viewport: viewportName,
      },
    });

    for (const { el, text } of genericLinks.slice(0, 10)) {
      const href = el.attributes.href ?? "";
      issues.push({
        category: "seo",
        severity: "info",
        ruleId: "generic-link-text",
        title: "Generic or missing link text",
        description: `Link with text "${text}" pointing to "${truncate(href, 80)}" does not describe its destination. Search engines and screen readers rely on link text for context.`,
        elementSelector: el.selector,
        recommendation:
          "Use descriptive link text that conveys where the link leads or what action it performs.",
        details: {
          linkText: text,
          href: truncate(href, 200),
          viewport: viewportName,
        },
      });
    }
  }

  return issues;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
