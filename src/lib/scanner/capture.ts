import type { Page } from "playwright";
import path from "path";
import fs from "fs/promises";
import type { DevicePreset, PerformanceMetrics } from "@/lib/types";
import type { BrowserSession } from "./browser";

const SCREENSHOTS_DIR =
  process.env.SCREENSHOTS_DIR || "./public/screenshots";

export interface CaptureResult {
  screenshotPath: string;
  viewportScreenshotPath?: string;
  domSnapshot: DomSnapshot;
  performanceMetrics: PerformanceMetrics;
  screenshotWidth?: number;
  screenshotHeight?: number;
  axeResults?: unknown;
  responseHeaders?: Record<string, string>;
  pageHtml?: string;
  pageCss?: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// Stabilization stylesheet — applied only during screenshot calls via
// Playwright's `style` option. Normalizes sticky/fixed positioning so each
// sticky element renders once in its natural flow position (matches Chromatic /
// Percy / Urlbox-native behavior) and pauses animations.
// ─────────────────────────────────────────────────────────────────────────────
const STABILIZATION_CSS = `
/* Ordinary sticky / fixed elements tagged by tagStickyElements(): revert to
   static so each renders once in its natural flow position (matches
   Chromatic / Percy / Urlbox-native behaviour). */
[data-screenshot-sticky="true"] {
  position: static !important;
  top: auto !important;
  bottom: auto !important;
  left: auto !important;
  right: auto !important;
  transform: none !important;
  z-index: auto !important;
}

/* "Reveal footer" pattern: position:sticky combined with negative z-index
   hides the element behind content until the user scrolls past it (seen on
   americas.land's .footer-dustin and many Elementor-Pro sites). Stabilising
   these to static resurfaces them — but Chromium's captureBeyondViewport
   then paints duplicated page content into the area their old natural flow
   occupied, producing a surprising "page appears twice" artefact on
   narrower viewports. Hide them instead; the decorative reveal is not a
   meaningful part of the audit capture. */
[data-screenshot-reveal="true"] {
  display: none !important;
}

/* Elementor's spacer placeholder that exists only while a sibling is fixed;
   when we revert sticky to static, the spacer becomes double empty space. */
.elementor-sticky__spacer,
[class*="elementor-sticky__spacer"] {
  display: none !important;
}


/* Cancel CSS animations and transitions for a consistent frame.
   Playwright's animations:"disabled" covers most cases but explicit rules
   catch JS-driven inline transitions. */
*, *::before, *::after {
  animation-delay: -1ms !important;
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  animation-play-state: paused !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
  caret-color: transparent !important;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Phase helpers
// ─────────────────────────────────────────────────────────────────────────────

async function waitForNetworkIdle(page: Page, timeout = 3000): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout });
  } catch {
    // Pages with persistent connections (SSE, WebSocket) never reach idle.
  }
}

async function waitForMediaReady(page: Page): Promise<void> {
  // Wait for fonts, images with src set, and videos whose sources are already
  // injected. Anything still missing a src is considered intentionally absent.
  await page.evaluate(async () => {
    const promises: Promise<void>[] = [];

    promises.push(document.fonts.ready.then(() => {}).catch(() => {}));

    const images = Array.from(document.querySelectorAll("img"));
    for (const img of images) {
      if (!img.src) continue;
      if (img.complete && img.naturalWidth > 0) continue;
      promises.push(
        new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 8000);
          const done = () => {
            clearTimeout(timeout);
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
      );
    }

    const videos = Array.from(document.querySelectorAll("video"));
    for (const video of videos) {
      if (!video.src && video.querySelectorAll("source").length === 0) {
        // Elementor and similar page builders inject <source> tags lazily.
        // Wait briefly for that to happen, but do not block forever.
        promises.push(
          new Promise<void>((resolve) => {
            const deadline = Date.now() + 5000;
            const check = () => {
              const hasSrc =
                video.src || video.querySelectorAll("source").length > 0;
              if (hasSrc || Date.now() > deadline) {
                resolve();
                return;
              }
              setTimeout(check, 200);
            };
            check();
          }),
        );
        continue;
      }

      if (video.readyState >= 2) continue;

      promises.push(
        new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 10000);
          const done = () => {
            clearTimeout(timeout);
            resolve();
          };
          video.addEventListener("loadeddata", done, { once: true });
          video.addEventListener("canplay", done, { once: true });
          video.addEventListener("error", done, { once: true });
          // Some browsers don't advance past readyState=0 until play() is called.
          video.play().catch(() => {});
        }),
      );
    }

    await Promise.all(promises);
  });
}

async function measureContentBottom(page: Page): Promise<number> {
  // Return the CSS-pixel y of the last visible non-hidden element in the
  // document. Used to clip the full-page screenshot so Chromium's
  // captureBeyondViewport cannot paint phantom content into trailing
  // whitespace — e.g., a reveal-footer pattern like americas.land's
  // .footer-dustin creates ~3000px of padding below the real content end
  // and Chromium fills it with duplicated hero content on mobile widths.
  return page.evaluate(() => {
    let maxBottom = 0;
    const nodes = document.querySelectorAll<HTMLElement>("*");
    for (const el of Array.from(nodes)) {
      const style = window.getComputedStyle(el);
      if (style.display === "none") continue;
      if (style.visibility === "hidden") continue;
      if (style.opacity === "0") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Sticky/fixed elements report their current stuck position which may
      // be above where they would naturally flow; skip those and trust the
      // static-flow bottom from other elements.
      if (style.position === "fixed" || style.position === "sticky") continue;
      const bottom = rect.bottom + window.scrollY;
      if (bottom > maxBottom) maxBottom = bottom;
    }
    const fallback = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );
    // Guard: if the walk found nothing (unusual), fall back.
    return Math.ceil(maxBottom > 0 ? maxBottom : fallback);
  });
}

async function tagStickyElements(page: Page): Promise<number> {
  // Tag visible position:sticky and position:fixed elements so the
  // stabilization stylesheet can revert them to static. Narrowings:
  //
  // 1. Hidden elements are skipped (display:none / visibility:hidden /
  //    opacity:0). Sites use position:fixed + display:none for inactive
  //    popups, mobile nav drawers, cookie banners, and modal overlays.
  //    Surfacing them into the captured layout would duplicate content.
  //
  // 2. Zero-size fixed elements are skipped. Same reason — modal overlays
  //    often sit at 0x0 until opened.
  //
  // 3. Tagging position:fixed is necessary: Elementor Pro's sticky header
  //    applies `position: fixed; top: 0` via inline JS at init, even before
  //    the user scrolls. Without tagging, Chromium's captureBeyondViewport
  //    renders these fixed headers at unpredictable positions (or skips
  //    them entirely in some viewport resize paths), so the final image
  //    loses the page's top bar.
  return page.evaluate(() => {
    const elements = document.querySelectorAll<HTMLElement>("*");
    let tagged = 0;
    for (const el of Array.from(elements)) {
      const style = window.getComputedStyle(el);
      if (style.position !== "sticky" && style.position !== "fixed") continue;
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      ) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) continue;

      // Reveal-footer pattern: sticky + negative z-index. Hide rather than
      // stabilize — Chromium's captureBeyondViewport otherwise paints
      // duplicated page content into the area they occupy.
      const zIndex = parseInt(style.zIndex, 10);
      if (style.position === "sticky" && !Number.isNaN(zIndex) && zIndex < 0) {
        el.setAttribute("data-screenshot-reveal", "true");
        tagged++;
        continue;
      }

      el.setAttribute("data-screenshot-sticky", "true");
      tagged++;
    }
    return tagged;
  });
}

async function driveScroll(page: Page): Promise<void> {
  // Scroll to the bottom in roughly viewport-sized steps to trigger
  // IntersectionObserver-based lazy loading and scroll-position animations.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const viewportHeight = window.innerHeight;
      const stepSize = Math.max(200, Math.floor(viewportHeight * 0.75));
      let lastHeight = document.documentElement.scrollHeight;
      let stableCount = 0;

      const tick = () => {
        const currentScroll = window.scrollY + window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;

        if (docHeight === lastHeight) {
          stableCount++;
        } else {
          stableCount = 0;
          lastHeight = docHeight;
        }

        // Reached the bottom and height has been stable for two ticks.
        if (currentScroll >= docHeight && stableCount >= 2) {
          resolve();
          return;
        }

        window.scrollBy({ top: stepSize, behavior: "instant" as ScrollBehavior });
        setTimeout(tick, 150);
      };

      // Safety timeout — never block capture longer than 20s.
      setTimeout(resolve, 20000);
      tick();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main capture
// ─────────────────────────────────────────────────────────────────────────────

export async function captureViewport(
  url: string,
  device: DevicePreset,
  scanId: string,
  session: BrowserSession,
  options?: {
    captureHtmlCss?: boolean;
  },
): Promise<CaptureResult> {
  const context = await session.browser.newContext({
    viewport: { width: device.width, height: device.height },
    userAgent: device.userAgent,
    isMobile: device.isMobile ?? device.type === "mobile",
    hasTouch: device.hasTouch ?? device.type !== "desktop",
    deviceScaleFactor: device.deviceScaleFactor ?? 1,
  });

  const page = await context.newPage();

  try {
    let cdp: import("playwright").CDPSession | null = null;
    if (session.engine === "chromium") {
      cdp = await context.newCDPSession(page);
      await cdp.send("Performance.enable");
    }

    // ── Phase 1: Navigate ───────────────────────────────────────────────────
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const responseHeaders: Record<string, string> = {};
    if (response) {
      for (const [key, value] of Object.entries(response.headers())) {
        responseHeaders[key.toLowerCase()] = value;
      }
    }

    // ── Phase 2: Load ───────────────────────────────────────────────────────
    await page.waitForLoadState("load").catch(() => {});
    await waitForMediaReady(page);

    // ── Phase 3: Drive (trigger lazy loads / scroll-triggered animations) ──
    await driveScroll(page);
    await waitForNetworkIdle(page, 3000);
    await waitForMediaReady(page);

    // Return to scroll 0 for consistent coordinate frame.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // ── Phase 4: Collect non-screenshot data ────────────────────────────────
    const performanceMetrics = await collectPerformanceMetrics(page, cdp);
    const domSnapshot = await captureDomSnapshot(page, device);

    let pageHtml: string | undefined;
    let pageCss: string | undefined;
    if (options?.captureHtmlCss) {
      try {
        pageHtml = await page.content();
      } catch {
        // Ignore
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
              // Cross-origin stylesheet — skipped. A future enhancement could
              // fetch these via CDP Network events.
            }
          }
          return sheets.join("\n");
        });
      } catch {
        // Ignore
      }
    }

    // ── Phase 5: Capture screenshots (full-page + viewport thumbnail) ──────
    // Tag all currently sticky/fixed elements so the stabilization CSS can
    // revert them — CSS alone cannot query computed position.
    const stickyTagged = await tagStickyElements(page);
    if (stickyTagged > 0) {
      console.log(`Tagged ${stickyTagged} sticky/fixed element(s) for capture`);
    }

    // Measure the real content bottom BEFORE stabilization so we don't base
    // the crop on the post-stabilization layout (which may be taller).
    const contentBottom = await measureContentBottom(page);

    const { screenshotPath, screenshotWidth, screenshotHeight } =
      await takeFullPageScreenshot(page, scanId, device, contentBottom);

    const viewportScreenshotPath = await takeViewportThumbnail(
      page,
      scanId,
      device,
    );

    // ── Phase 6: axe-core (AFTER stabilization reverts, on live DOM) ───────
    let axeResults: unknown = null;
    try {
      const { AxeBuilder } = await import(
        /* webpackIgnore: true */ "@axe-core/playwright"
      );
      axeResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    } catch (e) {
      console.warn(
        "axe-core analysis failed:",
        e instanceof Error ? e.message : e,
      );
    }

    return {
      screenshotPath,
      viewportScreenshotPath,
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

// ─────────────────────────────────────────────────────────────────────────────
// Screenshot helpers
// ─────────────────────────────────────────────────────────────────────────────

const WEBP_MAX_DIM = 16383;

async function takeFullPageScreenshot(
  page: Page,
  scanId: string,
  device: DevicePreset,
  contentBottom: number,
): Promise<{
  screenshotPath: string;
  screenshotWidth: number;
  screenshotHeight: number;
}> {
  const dir = path.join(SCREENSHOTS_DIR, scanId);
  await fs.mkdir(dir, { recursive: true });

  const baseName = device.name.toLowerCase().replace(/\s+/g, "-");
  const filename = `${baseName}.webp`;
  const filepath = path.join(dir, filename);

  // Playwright's fullPage uses CDP Page.captureScreenshot with
  // captureBeyondViewport under the hood. Combined with `animations:"disabled"`
  // (fast-forwards finite animations, pauses infinite ones) and our
  // `style` override, this produces a single accurate rendering where sticky
  // and fixed elements appear once in their layout-natural position.
  const pngBuffer = await page.screenshot({
    fullPage: true,
    type: "png",
    animations: "disabled",
    caret: "hide",
    scale: "css",
    style: STABILIZATION_CSS,
    timeout: 60000,
  });

  const sharp = (await import(/* webpackIgnore: true */ "sharp")).default;
  const meta = await sharp(pngBuffer).metadata();
  const origWidth = meta.width ?? device.width;
  const origHeight = meta.height ?? device.height;

  // Crop to the measured real content height. Chromium's captureBeyondViewport
  // sometimes fills empty trailing space (common on pages that use
  // min-height:100vh or reveal-footer patterns) with duplicated content —
  // see measureContentBottom() for rationale.
  const deviceScale = origWidth && device.width ? origWidth / device.width : 1;
  const targetHeight = Math.min(
    origHeight,
    Math.max(device.height, Math.ceil(contentBottom * deviceScale)),
  );
  const canvasBuffer =
    targetHeight < origHeight
      ? await sharp(pngBuffer)
          .extract({ left: 0, top: 0, width: origWidth, height: targetHeight })
          .png()
          .toBuffer()
      : pngBuffer;
  const canvasMeta = await sharp(canvasBuffer).metadata();
  const canvasWidth = canvasMeta.width ?? origWidth;
  const canvasHeight = canvasMeta.height ?? targetHeight;

  const needsDownscale =
    canvasWidth > WEBP_MAX_DIM || canvasHeight > WEBP_MAX_DIM;

  let webpBuffer: Buffer;
  if (needsDownscale) {
    const scale = WEBP_MAX_DIM / Math.max(canvasWidth, canvasHeight);
    webpBuffer = await sharp(canvasBuffer)
      .resize(Math.round(canvasWidth * scale), Math.round(canvasHeight * scale))
      .webp({ quality: 82 })
      .toBuffer();
  } else {
    webpBuffer = await sharp(canvasBuffer).webp({ quality: 82 }).toBuffer();
  }

  await fs.writeFile(filepath, webpBuffer);

  const finalMeta = await sharp(webpBuffer).metadata();
  return {
    screenshotPath: `/api/screenshots/${scanId}/${filename}`,
    screenshotWidth: finalMeta.width ?? canvasWidth,
    screenshotHeight: finalMeta.height ?? canvasHeight,
  };
}

async function takeViewportThumbnail(
  page: Page,
  scanId: string,
  device: DevicePreset,
): Promise<string | undefined> {
  // AI vision models downsample large images. Claude downscales to 1568 px
  // long edge (2576 px on Opus 4.7); a 1920x8000 full-page capture ends up at
  // ~376x1568 and loses UI detail. Emit a viewport-sized JPEG captured at
  // scroll 0 so the AI can see small text, icons, and focus states.
  try {
    const dir = path.join(SCREENSHOTS_DIR, scanId);
    await fs.mkdir(dir, { recursive: true });

    const baseName = device.name.toLowerCase().replace(/\s+/g, "-");
    const filename = `${baseName}-viewport.jpg`;
    const filepath = path.join(dir, filename);

    const jpegBuffer = await page.screenshot({
      fullPage: false,
      type: "jpeg",
      quality: 90,
      animations: "disabled",
      caret: "hide",
      scale: "css",
      style: STABILIZATION_CSS,
      clip: { x: 0, y: 0, width: device.width, height: device.height },
      timeout: 30000,
    });

    await fs.writeFile(filepath, jpegBuffer);
    return `/api/screenshots/${scanId}/${filename}`;
  } catch (e) {
    console.warn(
      "Viewport thumbnail capture failed:",
      e instanceof Error ? e.message : e,
    );
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics and DOM snapshot (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

async function collectPerformanceMetrics(
  page: Page,
  cdp: import("playwright").CDPSession | null,
): Promise<PerformanceMetrics> {
  void cdp;

  const metrics = await page.evaluate(() => {
    return new Promise<Record<string, number>>((resolve) => {
      const result: Record<string, number> = {};

      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      if (nav) {
        result.ttfb = nav.responseStart - nav.requestStart;
        result.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;
        result.load = nav.loadEventEnd - nav.startTime;
      }

      const fcpEntry = performance.getEntriesByName(
        "first-contentful-paint",
      )[0];
      if (fcpEntry) result.fcp = fcpEntry.startTime;

      const lcpEntries = performance.getEntriesByType(
        "largest-contentful-paint",
      );
      if (lcpEntries.length > 0) {
        result.lcp = lcpEntries[lcpEntries.length - 1].startTime;
      }

      const layoutShiftEntries = performance.getEntriesByType("layout-shift");
      let cls = 0;
      for (const entry of layoutShiftEntries) {
        if (
          !(entry as unknown as { hadRecentInput: boolean }).hadRecentInput
        ) {
          cls += (entry as unknown as { value: number }).value;
        }
      }
      result.cls = cls;

      const resources = performance.getEntriesByType("resource");
      result.resourceCount = resources.length;
      result.totalResourceSize = resources.reduce(
        (sum, r) =>
          sum + ((r as PerformanceResourceTiming).transferSize || 0),
        0,
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
  device: DevicePreset,
): Promise<DomSnapshot> {
  void device;
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
        (c) => c.tagName === el.tagName,
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

    const selectors =
      "a, button, input, select, textarea, h1, h2, h3, h4, h5, h6, img, form, nav, [role], p, li";
    const nodeList = document.querySelectorAll(selectors);
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
          y: rect.y + window.scrollY,
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
