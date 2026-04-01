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

  const baseName = device.name.toLowerCase().replace(/\s+/g, "-");
  const filename = `${baseName}.webp`;
  const filepath = path.join(dir, filename);

  const viewportWidth = device.width;
  const viewportHeight = device.height;

  // 1. Identify fixed/sticky elements and classify as header vs footer
  const fixedElements = await page.evaluate((vpHeight: number) => {
    const elements: Array<{ selector: string; type: "header" | "footer" }> = [];
    const allEls = document.querySelectorAll("*");
    for (const el of Array.from(allEls)) {
      const style = window.getComputedStyle(el);
      if (style.position === "fixed" || style.position === "sticky") {
        const rect = el.getBoundingClientRect();
        const isFooter = rect.top >= vpHeight * 0.5;
        // Build a unique selector
        let selector = "";
        if (el.id) {
          selector = `#${el.id}`;
        } else {
          selector = el.tagName.toLowerCase();
          if (el.className && typeof el.className === "string") {
            selector += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
          }
        }
        elements.push({ selector, type: isFooter ? "footer" : "header" });
      }
    }
    return elements;
  }, viewportHeight);

  // 2. Get real content height (strip min-height constraints)
  const contentHeight = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const origHtmlMin = html.style.minHeight;
    const origBodyMin = body.style.minHeight;
    html.style.minHeight = "0";
    body.style.minHeight = "0";

    // Force reflow
    void html.offsetHeight;

    const height = Math.max(
      body.scrollHeight, body.offsetHeight,
      html.clientHeight, html.scrollHeight, html.offsetHeight
    );

    // Restore
    html.style.minHeight = origHtmlMin;
    body.style.minHeight = origBodyMin;
    return height;
  });

  // If the page fits in one viewport, just take a simple screenshot
  if (contentHeight <= viewportHeight * 1.1) {
    const buffer = await page.screenshot({
      fullPage: false,
      type: "png",
      clip: { x: 0, y: 0, width: viewportWidth, height: Math.min(contentHeight, viewportHeight) },
    });

    // Convert to WebP with Sharp
    const sharp = (await import(/* webpackIgnore: true */ "sharp")).default;
    const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
    await fs.writeFile(filepath, webpBuffer);

    const metadata = await sharp(webpBuffer).metadata();
    return {
      screenshotPath: `/api/screenshots/${scanId}/${filename}`,
      screenshotWidth: metadata.width ?? viewportWidth,
      screenshotHeight: metadata.height ?? contentHeight,
    };
  }

  // 3. Scroll-and-stitch approach
  const tiles: Buffer[] = [];
  const totalTiles = Math.ceil(contentHeight / viewportHeight);
  const maxTiles = 15; // Safety cap
  const numTiles = Math.min(totalTiles, maxTiles);

  // Helper to hide/show elements
  async function setElementVisibility(selectors: string[], visible: boolean) {
    await page.evaluate(({ sels, vis }: { sels: string[]; vis: boolean }) => {
      for (const sel of sels) {
        try {
          const els = document.querySelectorAll(sel);
          for (const el of Array.from(els)) {
            (el as HTMLElement).style.visibility = vis ? "" : "hidden";
          }
        } catch { /* invalid selector, skip */ }
      }
    }, { sels: selectors, vis: visible });
  }

  const headerSelectors = fixedElements.filter(e => e.type === "header").map(e => e.selector);
  const footerSelectors = fixedElements.filter(e => e.type === "footer").map(e => e.selector);
  const allFixedSelectors = [...headerSelectors, ...footerSelectors];

  for (let i = 0; i < numTiles; i++) {
    const scrollY = i * viewportHeight;
    const isFirst = i === 0;
    const isLast = i === numTiles - 1;

    // Scroll to position
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(150); // Let rendering settle

    // Selective visibility
    if (isFirst) {
      // Show headers, hide footers
      await setElementVisibility(headerSelectors, true);
      await setElementVisibility(footerSelectors, false);
    } else if (isLast) {
      // Hide headers, show footers
      await setElementVisibility(headerSelectors, false);
      await setElementVisibility(footerSelectors, true);
    } else {
      // Hide all fixed elements
      await setElementVisibility(allFixedSelectors, false);
    }

    // Calculate clip height for last tile (avoid whitespace)
    const remainingHeight = contentHeight - scrollY;
    const tileHeight = isLast ? Math.min(remainingHeight, viewportHeight) : viewportHeight;

    // Capture tile
    const tile = await page.screenshot({
      fullPage: false,
      type: "png",
      clip: { x: 0, y: 0, width: viewportWidth, height: tileHeight },
    });
    tiles.push(tile);
  }

  // Restore all element visibility
  await setElementVisibility(allFixedSelectors, true);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));

  // 4. Stitch tiles with Sharp
  const sharp = (await import(/* webpackIgnore: true */ "sharp")).default;

  // Get actual tile dimensions (accounting for deviceScaleFactor)
  const firstTileMeta = await sharp(tiles[0]).metadata();
  const tilePixelWidth = firstTileMeta.width!;
  const scale = tilePixelWidth / viewportWidth;

  // Calculate total stitched height
  let totalPixelHeight = 0;
  const tileMetas = [];
  for (const tile of tiles) {
    const meta = await sharp(tile).metadata();
    tileMetas.push(meta);
    totalPixelHeight += meta.height!;
  }

  // Composite all tiles
  let currentY = 0;
  const composites: Array<{ input: Buffer; top: number; left: number }> = [];
  for (let i = 0; i < tiles.length; i++) {
    composites.push({ input: tiles[i], top: currentY, left: 0 });
    currentY += tileMetas[i].height!;
  }

  const stitched = await sharp({
    create: {
      width: tilePixelWidth,
      height: totalPixelHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .webp({ quality: 80 })
    .toBuffer();

  await fs.writeFile(filepath, stitched);

  return {
    screenshotPath: `/api/screenshots/${scanId}/${filename}`,
    screenshotWidth: tilePixelWidth,
    screenshotHeight: totalPixelHeight,
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
