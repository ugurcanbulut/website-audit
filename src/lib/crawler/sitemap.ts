import { assertScanTargetUrl } from "@/lib/security/url-guard";

export async function parseSitemapUrls(
  sitemapUrl: string,
  maxUrls = 500,
): Promise<string[]> {
  const urls: string[] = [];

  try {
    // Every sitemap URL goes through the SSRF guard before we fetch it.
    // Sitemap index files can point to other domains; we must re-check each
    // one rather than trusting the seed URL alone.
    await assertScanTargetUrl(sitemapUrl);

    const response = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return urls;

    const text = await response.text();

    // Check if it's a sitemap index
    if (text.includes("<sitemapindex")) {
      const sitemapUrls = extractXmlValues(text, "loc");
      for (const subSitemapUrl of sitemapUrls.slice(0, 10)) {
        if (urls.length >= maxUrls) break;
        const subUrls = await parseSitemapUrls(
          subSitemapUrl,
          maxUrls - urls.length,
        );
        urls.push(...subUrls);
      }
    } else {
      // Regular sitemap
      const pageUrls = extractXmlValues(text, "loc");
      urls.push(...pageUrls.slice(0, maxUrls));
    }
  } catch {
    // Sitemap fetch / guard / parse failures are all non-fatal.
  }

  return urls;
}

function extractXmlValues(xml: string, tagName: string): string[] {
  const values: string[] = [];
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, "gi");
  let match;
  while ((match = regex.exec(xml)) !== null) {
    values.push(match[1].trim());
  }
  return values;
}
