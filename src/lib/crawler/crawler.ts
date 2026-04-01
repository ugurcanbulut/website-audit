import type { Browser } from "playwright";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crawls, crawlPages } from "@/lib/db/schema";
import { parseRobotsTxt, isPathAllowed, type RobotsRules } from "./robots";
import { parseSitemapUrls } from "./sitemap";
import { extractPageData } from "./extractor";
import type { CrawlConfig, PageData } from "./types";

export async function runCrawl(crawlId: string): Promise<void> {
  const crawl = await db.query.crawls.findFirst({
    where: eq(crawls.id, crawlId),
  });
  if (!crawl) throw new Error("Crawl not found");

  const config = crawl.config as CrawlConfig;
  const seedUrl = new URL(crawl.seedUrl);
  const seedOrigin = seedUrl.origin;

  // Launch an ISOLATED browser (not shared with scan worker)
  let browser: Browser | null = null;

  try {
    await db.update(crawls).set({ status: "crawling" }).where(eq(crawls.id, crawlId));

    const pw = await import(/* webpackIgnore: true */ "playwright");
    browser = await pw.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    // 1. Fetch and parse robots.txt
    let robotsRules: RobotsRules = { allowedPaths: [], disallowedPaths: [], sitemaps: [] };
    if (config.respectRobotsTxt) {
      try {
        const robotsResponse = await fetch(`${seedOrigin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
        if (robotsResponse.ok) {
          const robotsTxt = await robotsResponse.text();
          robotsRules = parseRobotsTxt(robotsTxt);
        }
      } catch { /* robots.txt not available */ }
    }

    // 2. Collect seed URLs from sitemaps
    const urlQueue: Array<{ url: string; depth: number }> = [{ url: crawl.seedUrl, depth: 0 }];
    const visited = new Set<string>();

    if (config.followSitemaps) {
      const sitemapUrls = robotsRules.sitemaps.length > 0
        ? robotsRules.sitemaps
        : [`${seedOrigin}/sitemap.xml`];

      for (const sitemapUrl of sitemapUrls) {
        const urls = await parseSitemapUrls(sitemapUrl, config.maxPages);
        for (const u of urls) {
          if (!visited.has(u) && urlQueue.length < config.maxPages) {
            urlQueue.push({ url: u, depth: 1 });
          }
        }
      }
    }

    // Update total pages estimate
    await db.update(crawls).set({ totalPages: Math.min(urlQueue.length, config.maxPages) }).where(eq(crawls.id, crawlId));

    // 3. BFS crawl
    let pagesCrawled = 0;
    const crawlDelay = robotsRules.crawlDelay ?? config.crawlRate;

    while (urlQueue.length > 0 && pagesCrawled < config.maxPages) {
      const { url, depth } = urlQueue.shift()!;

      // Normalize URL
      let normalizedUrl: string;
      try {
        const parsed = new URL(url);
        parsed.hash = "";
        normalizedUrl = parsed.href;
      } catch {
        continue;
      }

      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Check origin matches
      try {
        const parsed = new URL(normalizedUrl);
        if (parsed.origin !== seedOrigin) continue;
      } catch {
        continue;
      }

      // Check robots.txt
      if (config.respectRobotsTxt) {
        const path = new URL(normalizedUrl).pathname;
        if (!isPathAllowed(path, robotsRules)) continue;
      }

      // Check include/exclude patterns
      if (config.excludePatterns?.some(p => normalizedUrl.includes(p))) continue;
      if (config.includePatterns && config.includePatterns.length > 0) {
        if (!config.includePatterns.some(p => normalizedUrl.includes(p))) continue;
      }

      // Crawl the page
      try {
        const pageData = await crawlPage(browser!, normalizedUrl, seedOrigin);

        // Save to DB
        await db.insert(crawlPages).values({
          crawlId,
          url: normalizedUrl,
          statusCode: pageData.statusCode,
          redirectUrl: pageData.redirectUrl ?? null,
          contentType: pageData.contentType ?? null,
          responseTimeMs: pageData.responseTimeMs,
          contentSize: pageData.contentSize,
          title: pageData.title ?? null,
          metaDescription: pageData.metaDescription ?? null,
          metaRobots: pageData.metaRobots ?? null,
          canonicalUrl: pageData.canonicalUrl ?? null,
          h1: pageData.h1,
          h2: pageData.h2,
          wordCount: pageData.wordCount,
          internalLinks: pageData.internalLinks,
          externalLinks: pageData.externalLinks,
          images: pageData.images,
          structuredData: pageData.structuredData,
          ogTags: pageData.ogTags,
          hreflang: pageData.hreflang,
          securityHeaders: pageData.securityHeaders,
          contentHash: pageData.contentHash ?? null,
          redirectChain: pageData.redirectChain ?? null,
          errors: pageData.errors,
          crawlDepth: depth,
        });

        pagesCrawled++;
        await db.update(crawls).set({ pagesCrawled }).where(eq(crawls.id, crawlId));

        // Discover new URLs from internal links
        if (depth < config.maxDepth) {
          for (const link of pageData.internalLinks) {
            try {
              const linkUrl = new URL(link.href);
              linkUrl.hash = "";
              const normalized = linkUrl.href;
              if (!visited.has(normalized) && linkUrl.origin === seedOrigin) {
                urlQueue.push({ url: normalized, depth: depth + 1 });
              }
            } catch { /* invalid URL */ }
          }
        }
      } catch (e) {
        // Save error page
        await db.insert(crawlPages).values({
          crawlId,
          url: normalizedUrl,
          statusCode: 0,
          errors: [e instanceof Error ? e.message : "Unknown error"],
        });
        pagesCrawled++;
        await db.update(crawls).set({ pagesCrawled }).where(eq(crawls.id, crawlId));
      }

      // Rate limiting
      if (crawlDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, crawlDelay));
      }
    }

    // Calculate inlinks count for each page
    const allPages = await db.query.crawlPages.findMany({ where: eq(crawlPages.crawlId, crawlId) });
    const inlinksMap = new Map<string, number>();
    for (const p of allPages) {
      const links = (p.internalLinks as Array<{href: string}>) ?? [];
      for (const link of links) {
        inlinksMap.set(link.href, (inlinksMap.get(link.href) ?? 0) + 1);
      }
    }
    for (const p of allPages) {
      const count = inlinksMap.get(p.url) ?? 0;
      if (count > 0) {
        await db.update(crawlPages).set({ inlinksCount: count }).where(eq(crawlPages.id, p.id));
      }
    }

    await db.update(crawls).set({
      status: "completed",
      totalPages: pagesCrawled,
      pagesCrawled,
      completedAt: new Date(),
    }).where(eq(crawls.id, crawlId));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db.update(crawls).set({
      status: "failed",
      error: errorMessage,
    }).where(eq(crawls.id, crawlId));
    throw error;
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* already closed */ }
    }
  }
}

async function crawlPage(
  browser: Browser,
  url: string,
  seedOrigin: string
): Promise<PageData> {
  const context = await browser.newContext({
    userAgent: "UIAuditBot/1.0 (+https://github.com/ugurcanbulut/website-audit)",
  });
  const page = await context.newPage();

  try {
    // Track full redirect chain
    const redirectChain: Array<{ url: string; statusCode: number }> = [];
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 300 && status < 400) {
        redirectChain.push({ url: response.url(), statusCode: status });
      }
    });

    const startTime = Date.now();
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const responseTimeMs = Date.now() - startTime;

    const statusCode = response?.status() ?? 0;
    const headers = response?.headers() ?? {};
    const redirectUrl = statusCode >= 300 && statusCode < 400 ? headers["location"] : undefined;
    const contentType = headers["content-type"];

    // Get content size from headers or page
    let contentSize = parseInt(headers["content-length"] || "0", 10);
    if (!contentSize) {
      const html = await page.content();
      contentSize = Buffer.byteLength(html, "utf-8");
    }

    // Wait briefly for JS rendering
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(500);

    const pageData = await extractPageData(
      page, url, seedOrigin, responseTimeMs,
      statusCode, redirectUrl, contentType, contentSize,
      Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
    );

    return {
      ...pageData,
      redirectChain: redirectChain.length > 0 ? redirectChain : undefined,
    };
  } finally {
    await context.close();
  }
}
