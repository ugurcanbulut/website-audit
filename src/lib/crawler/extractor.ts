import type { Page } from "playwright";
import type { PageData, LinkData, ImageData, HreflangData } from "./types";

export async function extractPageData(
  page: Page,
  url: string,
  seedOrigin: string,
  responseTimeMs: number,
  statusCode: number,
  redirectUrl?: string,
  contentType?: string,
  contentSize?: number,
  responseHeaders?: Record<string, string>
): Promise<PageData> {
  const data = await page.evaluate((seedOrigin: string) => {
    // Title
    const title = document.title || undefined;

    // Meta tags
    const getMeta = (name: string) =>
      (document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement)?.content ||
      (document.querySelector(`meta[property="${name}"]`) as HTMLMetaElement)?.content ||
      undefined;

    const metaDescription = getMeta("description");
    const metaRobots = getMeta("robots");

    // Canonical
    const canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    const canonicalUrl = canonicalEl?.href || undefined;

    // Headings
    const h1 = Array.from(document.querySelectorAll("h1")).map(el => el.textContent?.trim() || "").filter(Boolean);
    const h2 = Array.from(document.querySelectorAll("h2")).map(el => el.textContent?.trim() || "").filter(Boolean);

    // Word count
    const bodyText = document.body?.innerText || "";
    const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

    // Links
    const allLinks = Array.from(document.querySelectorAll("a[href]"));
    const internalLinks: Array<{href: string; anchor: string; nofollow: boolean}> = [];
    const externalLinks: Array<{href: string; anchor: string; nofollow: boolean}> = [];

    for (const a of allLinks) {
      const anchor = a as HTMLAnchorElement;
      const href = anchor.href;
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      const nofollow = anchor.rel.includes("nofollow");
      const linkData = { href, anchor: anchor.textContent?.trim().slice(0, 100) || "", nofollow };

      try {
        const linkUrl = new URL(href);
        const seedUrl = new URL(seedOrigin);
        if (linkUrl.hostname === seedUrl.hostname) {
          internalLinks.push(linkData);
        } else {
          externalLinks.push(linkData);
        }
      } catch {
        externalLinks.push(linkData);
      }
    }

    // Images
    const images = Array.from(document.querySelectorAll("img")).map(img => ({
      src: img.src || "",
      alt: img.alt || "",
      width: img.naturalWidth || undefined,
      height: img.naturalHeight || undefined,
    })).filter(i => i.src);

    // Structured data (JSON-LD)
    const structuredData: unknown[] = [];
    for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        structuredData.push(JSON.parse(script.textContent || ""));
      } catch { /* skip invalid */ }
    }

    // Open Graph tags
    const ogTags: Record<string, string> = {};
    for (const meta of Array.from(document.querySelectorAll('meta[property^="og:"]'))) {
      const prop = (meta as HTMLMetaElement).getAttribute("property");
      const content = (meta as HTMLMetaElement).content;
      if (prop && content) ogTags[prop] = content;
    }

    // Hreflang
    const hreflang: Array<{lang: string; href: string}> = [];
    for (const link of Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'))) {
      const lang = link.getAttribute("hreflang");
      const href = (link as HTMLLinkElement).href;
      if (lang && href) hreflang.push({ lang, href });
    }

    return {
      title, metaDescription, metaRobots, canonicalUrl,
      h1, h2, wordCount,
      internalLinks: internalLinks.slice(0, 200),
      externalLinks: externalLinks.slice(0, 200),
      images: images.slice(0, 100),
      structuredData,
      ogTags,
      hreflang,
    };
  }, seedOrigin);

  return {
    url,
    statusCode,
    redirectUrl,
    contentType,
    responseTimeMs,
    contentSize: contentSize ?? 0,
    title: data.title,
    metaDescription: data.metaDescription,
    metaRobots: data.metaRobots,
    canonicalUrl: data.canonicalUrl,
    h1: data.h1,
    h2: data.h2,
    wordCount: data.wordCount,
    internalLinks: data.internalLinks as LinkData[],
    externalLinks: data.externalLinks as LinkData[],
    images: data.images as ImageData[],
    structuredData: data.structuredData,
    ogTags: data.ogTags,
    hreflang: data.hreflang as HreflangData[],
    securityHeaders: responseHeaders ?? {},
    errors: [],
  };
}
