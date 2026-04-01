import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crawls, crawlPages } from "@/lib/db/schema";
import { launchBrowser, closeBrowser } from "@/lib/scanner/browser";
import type { BrowserSession } from "@/lib/scanner/browser";
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

  let session: BrowserSession | null = null;

  try {
    await db.update(crawls).set({ status: "crawling" }).where(eq(crawls.id, crawlId));

    session = await launchBrowser("chromium");

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
        const pageData = await crawlPage(session, normalizedUrl, seedOrigin);

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
          errors: pageData.errors,
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
    if (session) await closeBrowser(session);
  }
}

async function crawlPage(
  session: BrowserSession,
  url: string,
  seedOrigin: string
): Promise<PageData> {
  const context = await session.browser.newContext({
    userAgent: "UIAuditBot/1.0 (+https://github.com/ugurcanbulut/website-audit)",
  });
  const page = await context.newPage();

  try {
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

    return pageData;
  } finally {
    await context.close();
  }
}
