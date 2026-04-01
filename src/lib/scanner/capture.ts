import type { Page } from "playwright";
import path from "path";
import fs from "fs/promises";
import type { DevicePreset, PerformanceMetrics } from "@/lib/types";
import type { BrowserSession } from "./browser";

const SCREENSHOTS_DIR =
  process.env.SCREENSHOTS_DIR || "./public/screenshots";

export interface CaptureResult {
  screenshotPath: string;
  domSnapshot: DomSnapshot;
  performanceMetrics: PerformanceMetrics;
  screenshotWidth?: number;
  screenshotHeight?: number;
  // New in v2:
  axeResults?: unknown;                    // AxeResults from @axe-core/playwright
  responseHeaders?: Record<string, string>; // HTTP response headers
  pageHtml?: string;                        // Full HTML for HTMLHint
  pageCss?: string;                         // Aggregated CSS for CSS analyzer
}

export interface DomSnapshot {
  elements: DomElement[];
  documentWidth: number;
  documentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface DomElement {
  tagName: string;
  selector: string;
  rect: { x: number; y: number; width: number; height: number };
  computedStyles: Record<string, string>;
  attributes: Record<string, string>;
  isVisible: boolean;
  isInteractive: boolean;
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
      // Safety timeout
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 15000);
    });
  });
}

export async function captureViewport(
  url: string,
  device: DevicePreset,
  scanId: string,
  session: BrowserSession,
  options?: {
    captureHtmlCss?: boolean; // Only true for first viewport
  }
): Promise<CaptureResult> {
  const context = await session.browser.newContext({
    viewport: { width: device.width, height: device.height },
    userAgent: device.userAgent,
    isMobile: device.isMobile ?? (device.type === "mobile"),
    hasTouch: device.hasTouch ?? (device.type !== "desktop"),
    deviceScaleFactor: device.deviceScaleFactor ?? 1,
  });

  const page = await context.newPage();

  try {
    // Set up CDP session for performance metrics (Chromium only)
    let cdp: import("playwright").CDPSession | null = null;
    if (session.engine === "chromium") {
      cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
    }

    // Navigate and capture response headers
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const responseHeaders: Record<string, string> = {};
    if (response) {
      const headers = response.headers();
      for (const [key, value] of Object.entries(headers)) {
        responseHeaders[key.toLowerCase()] = value;
      }
    }

    // Wait for load event or timeout gracefully
    await page.waitForLoadState("load").catch(() => {});

    // Let animations/lazy content settle
    await page.waitForTimeout(2000);

    // Scroll through the page to trigger lazy-loaded images
    await autoScroll(page);

    // Wait for lazy images to load after scrolling
    await page.waitForTimeout(1500);

    // Scroll back to top for screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Collect performance metrics
    const performanceMetrics = await collectPerformanceMetrics(page, cdp);

    // Capture DOM snapshot BEFORE screenshot (screenshot modifies sticky positioning)
    const domSnapshot = await captureDomSnapshot(page, device);

    // Take full-page screenshot (handles sticky removal, video wait, and dimension capture)
    const { screenshotPath, screenshotWidth, screenshotHeight } =
      await takeScreenshot(page, scanId, device);

    // Run axe-core accessibility analysis
    let axeResults: unknown = null;
    try {
      const { AxeBuilder } = await import(/* webpackIgnore: true */ "@axe-core/playwright");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      axeResults = results;
    } catch (e) {
      console.warn("axe-core analysis failed:", e instanceof Error ? e.message : e);
    }

    // Optionally capture HTML and CSS (only for first viewport to save storage)
    let pageHtml: string | undefined;
    let pageCss: string | undefined;
    if (options?.captureHtmlCss) {
      try {
        pageHtml = await page.content();
      } catch {
        // Ignore HTML capture failure
      }
      try {
        pageCss = await page.evaluate(() => {
          const sheets: string[] = [];
          for (const sheet of Array.from(document.styleSheets)) {
            try {
              for (const rule of Array.from(sheet.cssRules)) {
                sheets.push(rule.cssText);
              }
            } catch {
              // Cross-origin stylesheet, skip
            }
          }
          return sheets.join("\n");
        });
      } catch {
        // Ignore CSS capture failure
      }
    }

    return {
      screenshotPath,
      domSnapshot,
      performanceMetrics,
      screenshotWidth,
      screenshotHeight,
      axeResults,
      responseHeaders,
      pageHtml,
      pageCss,
    };
  } finally {
    await context.close();
  }
}

async function takeScreenshot(
  page: Page,
  scanId: string,
  device: DevicePreset
): Promise<{ screenshotPath: string; screenshotWidth: number; screenshotHeight: number }> {
  const dir = path.join(SCREENSHOTS_DIR, scanId);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${device.name.toLowerCase().replace(/\s+/g, "-")}.png`;
  const filepath = path.join(dir, filename);

  // Hide fixed/sticky elements to prevent them repeating in full-page screenshot
  // Use visibility:hidden instead of changing position (which breaks layouts)
  await page.evaluate(() => {
    const elements = document.querySelectorAll("*");
    for (const el of Array.from(elements)) {
      const style = window.getComputedStyle(el);
      if (style.position === "fixed") {
        (el as HTMLElement).dataset.uiAuditHidden = "true";
        (el as HTMLElement).style.visibility = "hidden";
      }
    }
  });

  // Wait for video elements to have a frame ready
  await page.evaluate(async () => {
    const videos = Array.from(document.querySelectorAll("video"));
    await Promise.all(
      videos.map((video) => {
        if (video.readyState >= 2) return;
        return new Promise<void>((resolve) => {
          video.addEventListener("loadeddata", () => resolve(), { once: true });
          setTimeout(resolve, 5000);
        });
      })
    );
  });

  // Take full-page screenshot (Playwright handles deviceScaleFactor correctly)
  const buffer = await page.screenshot({
    fullPage: true,
    type: "png",
  });

  // Restore hidden fixed elements
  await page.evaluate(() => {
    const hidden = document.querySelectorAll("[data-ui-audit-hidden]");
    for (const el of Array.from(hidden)) {
      (el as HTMLElement).style.visibility = "";
      delete (el as HTMLElement).dataset.uiAuditHidden;
    }
  });
  await fs.writeFile(filepath, buffer);

  // PNG dimensions are stored in bytes 16-23 of the header
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  // Return API path for serving (standalone doesn't serve runtime public files)
  return {
    screenshotPath: `/api/screenshots/${scanId}/${filename}`,
    screenshotWidth: width,
    screenshotHeight: height,
  };
}

async function collectPerformanceMetrics(
  page: Page,
  cdp: import("playwright").CDPSession | null
): Promise<PerformanceMetrics> {
  // The CDP session is only used for Performance.enable which happens earlier.
  // Metrics collection uses the JavaScript Performance API via page.evaluate().
  // When cdp is null (non-Chromium engines), we still get metrics from the API.
  void cdp; // Acknowledge parameter; CDP enable was done at setup time

  const metrics = await page.evaluate(() => {
    return new Promise<Record<string, number>>((resolve) => {
      const result: Record<string, number> = {};

      // Navigation timing
      const nav = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;
      if (nav) {
        result.ttfb = nav.responseStart - nav.requestStart;
        result.domContentLoaded =
          nav.domContentLoadedEventEnd - nav.startTime;
        result.load = nav.loadEventEnd - nav.startTime;
      }

      // First Contentful Paint
      const fcpEntry = performance
        .getEntriesByName("first-contentful-paint")[0];
      if (fcpEntry) {
        result.fcp = fcpEntry.startTime;
      }

      // Largest Contentful Paint
      const lcpEntries = performance.getEntriesByType(
        "largest-contentful-paint"
      );
      if (lcpEntries.length > 0) {
        result.lcp = lcpEntries[lcpEntries.length - 1].startTime;
      }

      // Cumulative Layout Shift
      const layoutShiftEntries = performance.getEntriesByType("layout-shift");
      let cls = 0;
      for (const entry of layoutShiftEntries) {
        if (!(entry as unknown as { hadRecentInput: boolean }).hadRecentInput) {
          cls += (entry as unknown as { value: number }).value;
        }
      }
      result.cls = cls;

      // Resource count and sizes
      const resources = performance.getEntriesByType("resource");
      result.resourceCount = resources.length;
      result.totalResourceSize = resources.reduce(
        (sum, r) =>
          sum + ((r as PerformanceResourceTiming).transferSize || 0),
        0
      );

      resolve(result);
    });
  });

  return {
    lcp: metrics.lcp,
    cls: metrics.cls,
    ttfb: metrics.ttfb,
    fcp: metrics.fcp,
    domContentLoaded: metrics.domContentLoaded,
    load: metrics.load,
    resourceCount: metrics.resourceCount,
    totalResourceSize: metrics.totalResourceSize,
  };
}

async function captureDomSnapshot(
  page: Page,
  device: DevicePreset
): Promise<DomSnapshot> {
  const snapshot = await page.evaluate(() => {
    const interactiveTags = new Set([
      "A",
      "BUTTON",
      "INPUT",
      "SELECT",
      "TEXTAREA",
      "DETAILS",
      "SUMMARY",
    ]);
    const interactiveRoles = new Set([
      "button",
      "link",
      "checkbox",
      "radio",
      "tab",
      "menuitem",
      "switch",
      "textbox",
      "combobox",
      "listbox",
      "slider",
    ]);

    function getSelector(el: Element): string {
      if (el.id) return `#${el.id}`;
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent) return tag;
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === el.tagName
      );
      if (siblings.length === 1) return `${getSelector(parent)} > ${tag}`;
      const index = siblings.indexOf(el) + 1;
      return `${getSelector(parent)} > ${tag}:nth-child(${index})`;
    }

    const elements: Array<{
      tagName: string;
      selector: string;
      rect: { x: number; y: number; width: number; height: number };
      computedStyles: Record<string, string>;
      attributes: Record<string, string>;
      isVisible: boolean;
      isInteractive: boolean;
    }> = [];

    // Collect key elements (interactive, headings, images, forms)
    const selectors =
      "a, button, input, select, textarea, h1, h2, h3, h4, h5, h6, img, form, nav, [role], p, li";
    const nodeList = document.querySelectorAll(selectors);

    // Limit to first 500 elements to avoid huge snapshots
    const els = Array.from(nodeList).slice(0, 500);

    for (const el of els) {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);

      const isVisible =
        styles.display !== "none" &&
        styles.visibility !== "hidden" &&
        styles.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0;

      const role = el.getAttribute("role");
      const isInteractive =
        interactiveTags.has(el.tagName) ||
        (role !== null && interactiveRoles.has(role)) ||
        el.hasAttribute("tabindex") ||
        el.hasAttribute("onclick");

      const attrs: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        attrs[attr.name] = attr.value;
      }

      elements.push({
        tagName: el.tagName.toLowerCase(),
        selector: getSelector(el),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        computedStyles: {
          fontSize: styles.fontSize,
          lineHeight: styles.lineHeight,
          fontWeight: styles.fontWeight,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          display: styles.display,
          position: styles.position,
          overflow: styles.overflow,
          overflowX: styles.overflowX,
          overflowY: styles.overflowY,
          marginTop: styles.marginTop,
          marginBottom: styles.marginBottom,
          marginLeft: styles.marginLeft,
          marginRight: styles.marginRight,
          paddingTop: styles.paddingTop,
          paddingBottom: styles.paddingBottom,
          paddingLeft: styles.paddingLeft,
          paddingRight: styles.paddingRight,
        },
        attributes: attrs,
        isVisible,
        isInteractive,
      });
    }

    return {
      elements,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  return snapshot;
}
