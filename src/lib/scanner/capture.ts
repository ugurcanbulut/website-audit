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

interface FixedOrStickyElement {
  captureId: string;
  position: "fixed" | "sticky";
  type: "header" | "footer" | "other";
  height: number;
  topOffset: number;
}

async function smartAutoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const viewportHeight = window.innerHeight;
      let currentScroll = 0;
      const maxScroll = document.documentElement.scrollHeight;
      const safetyTimeout = setTimeout(resolve, 30000);

      const scrollStep = () => {
        currentScroll += Math.floor(viewportHeight * 0.75);
        if (currentScroll >= maxScroll) {
          window.scrollTo(0, maxScroll);
          clearTimeout(safetyTimeout);
          resolve();
          return;
        }
        window.scrollTo({ top: currentScroll, behavior: "instant" });
        setTimeout(scrollStep, 150);
      };

      scrollStep();
    });
  });
}

async function waitForMediaToLoad(page: Page): Promise<void> {
  await page.evaluate(() => {
    const promises: Promise<void>[] = [];

    promises.push(
      document.fonts.ready.then(() => {}).catch(() => {}),
    );

    const images = Array.from(document.querySelectorAll("img"));
    for (const img of images) {
      if (img.complete && img.naturalWidth > 0) continue;
      promises.push(
        new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 10000);
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
      promises.push(
        new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 15000);

          const paintVideoFrame = () => {
            clearTimeout(timeout);
            try {
              if (video.videoWidth > 0) {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const dataUrl = canvas.toDataURL("image/png");
                  const rect = video.getBoundingClientRect();
                  const overlay = document.createElement("img");
                  overlay.src = dataUrl;
                  overlay.style.position = "absolute";
                  overlay.style.top = "0";
                  overlay.style.left = "0";
                  overlay.style.width = "100%";
                  overlay.style.height = "100%";
                  overlay.style.objectFit = video.style.objectFit || "cover";
                  overlay.style.zIndex = "1";
                  overlay.style.pointerEvents = "none";
                  overlay.setAttribute("data-video-overlay", "");
                  const container = document.createElement("div");
                  container.style.position = "relative";
                  container.style.width = rect.width + "px";
                  container.style.height = rect.height + "px";
                  container.style.overflow = "hidden";
                  container.setAttribute("data-video-wrapper", "");
                  video.parentNode!.insertBefore(container, video);
                  container.appendChild(video);
                  container.appendChild(overlay);
                }
              }
            } catch {}
            try { video.pause(); } catch {}
            resolve();
          };

          const tryPlayAndWait = () => {
            video.play().catch(() => {});
            if (typeof video.requestVideoFrameCallback === "function") {
              const frameTimeout = setTimeout(paintVideoFrame, 5000);
              video.requestVideoFrameCallback(() => {
                clearTimeout(frameTimeout);
                setTimeout(paintVideoFrame, 100);
              });
            } else {
              setTimeout(paintVideoFrame, 3000);
            }
          };

          if (video.readyState >= 3) {
            tryPlayAndWait();
          } else {
            video.addEventListener("canplay", tryPlayAndWait, { once: true });
            video.addEventListener("error", () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
            video.play().catch(() => {});
          }
        }),
      );
    }

    const allElements = Array.from(document.querySelectorAll("*"));
    for (const el of allElements) {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      if (!bgImage || bgImage === "none") continue;
      const match = bgImage.match(/url\(["']?(.*?)["']?\)/);
      if (!match) continue;
      promises.push(
        new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 8000);
          const img = new Image();
          img.addEventListener("load", () => {
            clearTimeout(timeout);
            resolve();
          });
          img.addEventListener("error", () => {
            clearTimeout(timeout);
            resolve();
          });
          img.src = match[1];
        }),
      );
    }

    return Promise.all(promises);
  });
}

async function waitForNetworkIdle(
  page: Page,
  timeout = 3000,
): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout });
  } catch {
    // Pages with persistent connections (SSE, WebSocket) will never reach idle
  }
}

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

    await page.waitForLoadState("load").catch(() => {});

    await waitForMediaToLoad(page);

    await smartAutoScroll(page);

    await waitForNetworkIdle(page, 3000);

    await waitForMediaToLoad(page);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const performanceMetrics = await collectPerformanceMetrics(page, cdp);

    const domSnapshot = await captureDomSnapshot(page, device);

    const { screenshotPath, screenshotWidth, screenshotHeight } =
      await takeScreenshot(page, scanId, device);

    let axeResults: unknown = null;
    try {
      const { AxeBuilder } = await import(
        /* webpackIgnore: true */ "@axe-core/playwright"
      );
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      axeResults = results;
    } catch (e) {
      console.warn(
        "axe-core analysis failed:",
        e instanceof Error ? e.message : e,
      );
    }

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
  device: DevicePreset,
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

  const viewportWidth = device.width;
  const viewportHeight = device.height;

  const fixedElements = await tagAndIdentifyElements(page, viewportHeight);

  const contentHeight = await detectContentHeight(page);

  if (contentHeight <= viewportHeight * 1.1) {
    const buffer = await page.screenshot({
      fullPage: false,
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: viewportWidth,
        height: Math.min(contentHeight, viewportHeight),
      },
    });

    const sharp = (await import(/* webpackIgnore: true */ "sharp")).default;
    const bufferMeta = await sharp(buffer).metadata();
    const WEBP_MAX_DIM = 16383;
    const needsDownscale =
      (bufferMeta.width ?? 0) > WEBP_MAX_DIM ||
      (bufferMeta.height ?? 0) > WEBP_MAX_DIM;

    let webpBuffer: Buffer;
    if (needsDownscale) {
      const scale = WEBP_MAX_DIM / Math.max(bufferMeta.width!, bufferMeta.height!);
      webpBuffer = await sharp(buffer)
        .resize(Math.round(bufferMeta.width! * scale), Math.round(bufferMeta.height! * scale))
        .webp({ quality: 80 })
        .toBuffer();
    } else {
      webpBuffer = await sharp(buffer)
        .webp({ quality: 80 })
        .toBuffer();
    }
    await fs.writeFile(filepath, webpBuffer);

    const metadata = await sharp(webpBuffer).metadata();
    return {
      screenshotPath: `/api/screenshots/${scanId}/${filename}`,
      screenshotWidth: metadata.width ?? viewportWidth,
      screenshotHeight: metadata.height ?? contentHeight,
    };
  }

  const tiles: Buffer[] = [];
  const totalTiles = Math.ceil(contentHeight / viewportHeight);
  const maxTiles = 15;
  const numTiles = Math.min(totalTiles, maxTiles);

  const headerElements = fixedElements.filter((e) => e.type === "header");
  const footerElements = fixedElements.filter((e) => e.type === "footer");
  const otherElements = fixedElements.filter((e) => e.type === "other");

  for (let i = 0; i < numTiles; i++) {
    const scrollY = i * viewportHeight;
    const isFirst = i === 0;
    const isLast = i === numTiles - 1;

    await page.evaluate(
      (y: number) => {
        window.scrollTo({ top: y, behavior: "instant" });
      },
      scrollY,
    );
    await page.waitForTimeout(400);

    const actualScroll = await page.evaluate(() => window.scrollY);
    if (Math.abs(actualScroll - scrollY) > 2) {
      await page.evaluate(
        (y: number) => window.scrollTo(0, y),
        scrollY,
      );
      await page.waitForTimeout(250);
    }

    await setVisibilityByCaptureId(page, headerElements, isFirst);
    await setVisibilityByCaptureId(page, footerElements, isLast);
    await setVisibilityByCaptureId(page, otherElements, false);

    await page.waitForTimeout(150);

    const remainingHeight = contentHeight - scrollY;
    const tileHeight = isLast
      ? Math.min(remainingHeight, viewportHeight)
      : viewportHeight;

    const tile = await page.screenshot({
      fullPage: false,
      type: "png",
      clip: { x: 0, y: 0, width: viewportWidth, height: tileHeight },
    });
    tiles.push(tile);
  }

  // Restore all elements
  await setVisibilityByCaptureId(page, fixedElements, true);
  await cleanupCaptureIds(page);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Stitch tiles with Sharp
  const sharp = (await import(/* webpackIgnore: true */ "sharp")).default;

  const firstTileMeta = await sharp(tiles[0]).metadata();
  const tilePixelWidth = firstTileMeta.width!;

  const tileMetas = [];
  let totalPixelHeight = 0;
  for (const tile of tiles) {
    const meta = await sharp(tile).metadata();
    tileMetas.push(meta);
    totalPixelHeight += meta.height!;
  }

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
    .png()
    .toBuffer();

  const trimmedBuffer = await trimBottomWhitespace(stitched);

  const WEBP_MAX_DIM = 16383;
  const trimmedMeta = await sharp(trimmedBuffer).metadata();
  const needsDownscale =
    (trimmedMeta.width ?? 0) > WEBP_MAX_DIM ||
    (trimmedMeta.height ?? 0) > WEBP_MAX_DIM;

  let finalBuffer: Buffer;
  if (needsDownscale) {
    const scale = WEBP_MAX_DIM / Math.max(trimmedMeta.width!, trimmedMeta.height!);
    const newWidth = Math.round(trimmedMeta.width! * scale);
    const newHeight = Math.round(trimmedMeta.height! * scale);
    finalBuffer = await sharp(trimmedBuffer)
      .resize(newWidth, newHeight)
      .webp({ quality: 80 })
      .toBuffer();
  } else {
    finalBuffer = await sharp(trimmedBuffer)
      .webp({ quality: 80 })
      .toBuffer();
  }
  await fs.writeFile(filepath, finalBuffer);

  const finalMetadata = await sharp(finalBuffer).metadata();
  return {
    screenshotPath: `/api/screenshots/${scanId}/${filename}`,
    screenshotWidth: finalMetadata.width ?? tilePixelWidth,
    screenshotHeight: finalMetadata.height ?? totalPixelHeight,
  };
}

async function tagAndIdentifyElements(
  page: Page,
  viewportHeight: number,
): Promise<FixedOrStickyElement[]> {
  return page.evaluate((vpHeight: number) => {
    const elements: Array<{
      captureId: string;
      position: "fixed" | "sticky";
      type: "header" | "footer" | "other";
      height: number;
      topOffset: number;
    }> = [];

    const seen = new Set<Element>();
    const allEls = document.querySelectorAll("*");

    for (const el of Array.from(allEls)) {
      if (seen.has(el)) continue;
      const style = window.getComputedStyle(el);
      const pos = style.position;
      if (pos !== "fixed" && pos !== "sticky") continue;

      seen.add(el);

      const rect = el.getBoundingClientRect();
      const elHeight = rect.height;

      if (elHeight === 0 && rect.width === 0) continue;

      let type: "header" | "footer" | "other";
      if (rect.top < vpHeight * 0.35 && rect.top >= 0) {
        type = "header";
      } else if (rect.bottom > vpHeight * 0.65) {
        type = "footer";
      } else {
        type = "other";
      }

      const captureId = `__ui_cap_${Math.random().toString(36).slice(2, 10)}`;
      (el as HTMLElement).setAttribute("data-capture-id", captureId);

      let topOffset = 0;
      const cssTop = style.top;
      if (cssTop && cssTop !== "auto") {
        topOffset = parseFloat(cssTop) || 0;
      }

      elements.push({
        captureId,
        position: pos as "fixed" | "sticky",
        type,
        height: elHeight,
        topOffset,
      });
    }

    return elements;
  }, viewportHeight);
}

async function setVisibilityByCaptureId(
  page: Page,
  elements: FixedOrStickyElement[],
  visible: boolean,
): Promise<void> {
  if (elements.length === 0) return;

  const items = elements.map((e) => ({
    id: e.captureId,
    pos: e.position,
  }));
  await page.evaluate(
    ({ items, vis }: { items: Array<{ id: string; pos: "fixed" | "sticky" }>; vis: boolean }) => {
      for (const { id, pos } of items) {
        const el = document.querySelector(`[data-capture-id="${id}"]`) as HTMLElement | null;
        if (!el) continue;
        if (vis) {
          el.style.removeProperty("display");
          el.style.removeProperty("visibility");
          el.style.removeProperty("opacity");
          el.style.removeProperty("pointer-events");
        } else if (pos === "fixed") {
          el.style.setProperty("display", "none", "important");
        } else {
          el.style.setProperty("visibility", "hidden", "important");
          el.style.setProperty("pointer-events", "none", "important");
        }
      }
    },
    { items, vis: visible },
  );
}

async function cleanupCaptureIds(page: Page): Promise<void> {
  await page.evaluate(() => {
    const els = document.querySelectorAll("[data-capture-id]");
    for (const el of Array.from(els)) {
      (el as HTMLElement).removeAttribute("data-capture-id");
      (el as HTMLElement).style.removeProperty("display");
      (el as HTMLElement).style.removeProperty("visibility");
      (el as HTMLElement).style.removeProperty("opacity");
      (el as HTMLElement).style.removeProperty("pointer-events");
    }
  });
}

async function detectContentHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;

    const negativeZContainers = new Set<Element>();
    const allForZCheck = body.querySelectorAll("*");
    for (const el of Array.from(allForZCheck)) {
      const style = window.getComputedStyle(el);
      const z = parseInt(style.zIndex, 10);
      if (!isNaN(z) && z < 0) {
        negativeZContainers.add(el);
        const descendants = el.querySelectorAll("*");
        for (const d of Array.from(descendants)) {
          negativeZContainers.add(d);
        }
      }
    }

    const saved: Array<{ el: HTMLElement; prop: string; val: string }> = [];
    const propsToReset = ["minHeight", "height"] as const;
    const elementsToReset = [html, body] as HTMLElement[];

    for (const el of elementsToReset) {
      for (const prop of propsToReset) {
        const val = el.style[prop];
        if (val && val !== "auto") {
          saved.push({ el, prop, val });
          (el.style as unknown as Record<string, string>)[prop] = "auto";
        }
      }
    }

    void html.offsetHeight;

    const blockTags = new Set([
      "DIV", "SECTION", "ARTICLE", "MAIN", "HEADER", "FOOTER", "NAV",
      "ASIDE", "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL",
      "TABLE", "FORM", "BLOCKQUOTE", "FIGURE", "FIGCAPTION", "DETAILS",
      "IMG", "VIDEO", "SVG", "CANVAS", "IFRAME",
    ]);

    let maxBottom = 0;
    const allEls = body.querySelectorAll("*");

    for (const el of Array.from(allEls)) {
      if (negativeZContainers.has(el)) continue;

      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      )
        continue;
      if (style.position === "fixed") continue;
      if (!blockTags.has(el.tagName)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      const bottom = rect.bottom + window.scrollY;
      if (bottom > maxBottom && bottom < 200000) {
        maxBottom = bottom;
      }
    }

    const fallbackHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight,
    );

    const height = maxBottom > 0 ? maxBottom : fallbackHeight;

    for (const { el, prop, val } of saved) {
      (el.style as unknown as Record<string, string>)[prop] = val;
    }

    return Math.ceil(height);
  });
}

async function trimBottomWhitespace(
  buffer: Buffer,
): Promise<Buffer> {
  const sharp = (await import(/* webpackIgnore: true */ "sharp")).default;
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowSize = info.width * info.channels;
  let trimRows = 0;
  const sampleStep = Math.max(1, Math.floor(info.width / 200));

  for (let y = info.height - 1; y >= 0; y--) {
    const rowStart = y * rowSize;
    let isBlank = true;

    for (let x = 0; x < info.width; x += sampleStep) {
      const px = rowStart + x * info.channels;
      if (info.channels >= 3) {
        const r = data[px];
        const g = data[px + 1];
        const b = data[px + 2];
        const a = info.channels >= 4 ? data[px + 3] : 255;
        if (a > 10 && (r < 252 || g < 252 || b < 252)) {
          isBlank = false;
          break;
        }
      }
    }

    if (!isBlank) break;
    trimRows++;
  }

  if (trimRows <= 0) return buffer;

  const trimmedHeight = Math.max(1, info.height - trimRows);
  return sharp(buffer)
    .extract({ left: 0, top: 0, width: info.width, height: trimmedHeight })
    .toBuffer();
}

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
        result.domContentLoaded =
          nav.domContentLoadedEventEnd - nav.startTime;
        result.load = nav.loadEventEnd - nav.startTime;
      }

      const fcpEntry = performance.getEntriesByName(
        "first-contentful-paint",
      )[0];
      if (fcpEntry) {
        result.fcp = fcpEntry.startTime;
      }

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
