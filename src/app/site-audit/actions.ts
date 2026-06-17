"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteAudits, crawls } from "@/lib/db/schema";
import { addCrawlJob } from "@/lib/queue/crawl-queue";
import { DEFAULT_CRAWL_CONFIG } from "@/lib/crawler/types";
import { assertScanTargetUrl, UrlGuardError } from "@/lib/security/url-guard";

/**
 * Start a site audit: kick off a discovery crawl and create the site_audit
 * record that the page tree-selection step reads. The actual per-page scans are
 * fanned out later, once the user picks pages (see submitSelection / Phase 3c).
 */
export async function createSiteAudit(
  seedUrl: string,
  maxPages = 150,
  maxDepth = 5,
): Promise<{ error?: string }> {
  let url = seedUrl.trim();
  if (!url) return { error: "Enter a URL to audit." };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    new URL(url);
  } catch {
    return { error: "Please enter a valid URL." };
  }
  try {
    await assertScanTargetUrl(url);
  } catch (e) {
    if (e instanceof UrlGuardError) return { error: e.message };
    throw e;
  }

  const [crawl] = await db
    .insert(crawls)
    .values({
      seedUrl: url,
      config: { ...DEFAULT_CRAWL_CONFIG, maxPages, maxDepth },
    })
    .returning();

  const [audit] = await db
    .insert(siteAudits)
    .values({ seedUrl: url, crawlId: crawl.id, status: "discovering" })
    .returning();

  await addCrawlJob(crawl.id);
  redirect(`/site-audit/${audit.id}`);
}

/**
 * Record the pages the user selected from the site tree and move the audit into
 * the auditing phase. The scan fan-out is wired in Phase 3c.
 */
export async function submitSelection(
  siteAuditId: string,
  selectedUrls: string[],
): Promise<{ error?: string }> {
  if (selectedUrls.length === 0) return { error: "Select at least one page." };
  await db
    .update(siteAudits)
    .set({
      selectedUrls,
      totalPages: selectedUrls.length,
      status: "auditing",
    })
    .where(eq(siteAudits.id, siteAuditId));
  revalidatePath(`/site-audit/${siteAuditId}`);
  return {};
}
