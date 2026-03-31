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

interface ViewportMetrics {
  viewportName: string;
  metrics: Record<string, unknown>;
}

/**
 * Performance metric checks across viewports.
 */
export function runPerformanceChecks(
  metricsArray: ViewportMetrics[]
): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  for (const { viewportName, metrics } of metricsArray) {
    // --- Largest Contentful Paint ---
    const lcp = toNumber(metrics.lcp);
    if (lcp !== null) {
      if (lcp > 4000) {
        issues.push({
          category: "performance",
          severity: "critical",
          ruleId: "lcp-slow",
          title: `Very slow LCP on ${viewportName} (${formatMs(lcp)})`,
          description: `Largest Contentful Paint is ${formatMs(lcp)}, which exceeds the 4s threshold for a poor experience. Users may perceive the page as broken or unresponsive.`,
          recommendation:
            "Optimize the largest content element's load time. Consider preloading critical images, using responsive image formats (WebP/AVIF), reducing server response time, and eliminating render-blocking resources.",
          details: { lcp, threshold: 4000, viewport: viewportName },
        });
      } else if (lcp > 2500) {
        issues.push({
          category: "performance",
          severity: "warning",
          ruleId: "lcp-slow",
          title: `Slow LCP on ${viewportName} (${formatMs(lcp)})`,
          description: `Largest Contentful Paint is ${formatMs(lcp)}, which exceeds the 2.5s threshold for a good experience.`,
          recommendation:
            "Optimize the largest content element. Preload hero images, use modern image formats, and reduce server response time to bring LCP under 2.5 seconds.",
          details: { lcp, threshold: 2500, viewport: viewportName },
        });
      }
    }

    // --- Cumulative Layout Shift ---
    const cls = toNumber(metrics.cls);
    if (cls !== null) {
      if (cls > 0.25) {
        issues.push({
          category: "performance",
          severity: "critical",
          ruleId: "cls-high",
          title: `Very high CLS on ${viewportName} (${cls.toFixed(3)})`,
          description: `Cumulative Layout Shift is ${cls.toFixed(3)}, far exceeding the 0.25 threshold. The page has severe layout instability that degrades user experience.`,
          recommendation:
            "Set explicit width and height on images and embeds, avoid inserting content above existing content, and use CSS contain where appropriate. Check for dynamically injected banners or ads.",
          details: { cls, threshold: 0.25, viewport: viewportName },
        });
      } else if (cls > 0.1) {
        issues.push({
          category: "performance",
          severity: "warning",
          ruleId: "cls-high",
          title: `Elevated CLS on ${viewportName} (${cls.toFixed(3)})`,
          description: `Cumulative Layout Shift is ${cls.toFixed(3)}, exceeding the 0.1 threshold for a good experience. Users may experience unexpected content movement.`,
          recommendation:
            "Set explicit dimensions on images and embeds, avoid inserting dynamic content above the fold, and preload web fonts to prevent layout shifts.",
          details: { cls, threshold: 0.1, viewport: viewportName },
        });
      }
    }

    // --- Time to First Byte ---
    const ttfb = toNumber(metrics.ttfb);
    if (ttfb !== null && ttfb > 800) {
      issues.push({
        category: "performance",
        severity: "warning",
        ruleId: "ttfb-slow",
        title: `Slow TTFB on ${viewportName} (${formatMs(ttfb)})`,
        description: `Time to First Byte is ${formatMs(ttfb)}, exceeding the 800ms threshold. This delays all subsequent loading stages.`,
        recommendation:
          "Improve server response time by using a CDN, optimizing server-side rendering, implementing caching, upgrading hosting, or reducing database query times.",
        details: { ttfb, threshold: 800, viewport: viewportName },
      });
    }

    // --- First Contentful Paint ---
    const fcp = toNumber(metrics.fcp);
    if (fcp !== null && fcp > 3000) {
      issues.push({
        category: "performance",
        severity: "warning",
        ruleId: "fcp-slow",
        title: `Slow FCP on ${viewportName} (${formatMs(fcp)})`,
        description: `First Contentful Paint is ${formatMs(fcp)}, exceeding the 3s threshold. Users see a blank screen for too long before any content appears.`,
        recommendation:
          "Reduce render-blocking resources (CSS, JS), inline critical CSS, defer non-critical scripts, and optimize server response time.",
        details: { fcp, threshold: 3000, viewport: viewportName },
      });
    }

    // --- Resource count ---
    const resourceCount = toNumber(metrics.resourceCount);
    if (resourceCount !== null && resourceCount > 100) {
      issues.push({
        category: "performance",
        severity: "warning",
        ruleId: "resource-count",
        title: `Too many resources on ${viewportName} (${resourceCount})`,
        description: `The page loads ${resourceCount} resources, exceeding the recommended limit of 100. Each HTTP request adds overhead and can slow down page loading.`,
        recommendation:
          "Reduce the number of HTTP requests by bundling scripts and stylesheets, using CSS sprites or icon fonts, lazy-loading below-the-fold images, and removing unused resources.",
        details: {
          resourceCount,
          threshold: 100,
          viewport: viewportName,
        },
      });
    }

    // --- Total page weight ---
    const totalResourceSize = toNumber(metrics.totalResourceSize);
    if (totalResourceSize !== null && totalResourceSize > 5 * 1024 * 1024) {
      const sizeMB = (totalResourceSize / (1024 * 1024)).toFixed(1);
      issues.push({
        category: "performance",
        severity: "warning",
        ruleId: "page-weight",
        title: `Large page weight on ${viewportName} (${sizeMB} MB)`,
        description: `Total transferred resource size is ${sizeMB} MB, exceeding the 5 MB threshold. Large pages are slow to load, especially on mobile networks.`,
        recommendation:
          "Compress images (use WebP/AVIF), enable gzip/brotli compression, minify CSS and JavaScript, remove unused code, and lazy-load non-critical resources.",
        details: {
          totalResourceSize,
          totalResourceSizeMB: parseFloat(sizeMB),
          threshold: 5 * 1024 * 1024,
          viewport: viewportName,
        },
      });
    }
  }

  return issues;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}
