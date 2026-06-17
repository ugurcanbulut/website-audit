"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteAudits, crawls, scans } from "@/lib/db/schema";
import { addCrawlJob } from "@/lib/queue/crawl-queue";
import { addScanJob } from "@/lib/queue/scan-queue";
import { DEFAULT_CRAWL_CONFIG } from "@/lib/crawler/types";
import { getDevicesByNames, DEFAULT_DEVICES } from "@/lib/scanner/devices";
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
 * Record the selected pages and fan out one full scan per URL, each tagged with
 * siteAuditId. Concurrency is handled by the scan queue/worker — we just enqueue
 * the batch. Scans run rule-based (AI off) to keep a many-page audit affordable.
 */
export async function submitSelection(
  siteAuditId: string,
  selectedUrls: string[],
): Promise<{ error?: string }> {
  if (selectedUrls.length === 0) return { error: "Select at least one page." };

  // De-dupe; the tree can surface the same URL twice in odd cases.
  const urls = Array.from(new Set(selectedUrls));

  // Same device set as a normal scan.
  const resolvedDevices = getDevicesByNames(DEFAULT_DEVICES);
  const viewportConfigs = resolvedDevices.map((d) => ({
    name: d.name,
    width: d.width,
    height: d.height,
    type: d.type,
  }));

  const rows = await db
    .insert(scans)
    .values(
      urls.map((url) => ({
        url,
        viewports: viewportConfigs,
        browserEngine: "chromium" as const,
        aiEnabled: false,
        siteAuditId,
      })),
    )
    .returning();

  await db
    .update(siteAudits)
    .set({ selectedUrls: urls, totalPages: rows.length, pagesCompleted: 0, status: "auditing" })
    .where(eq(siteAudits.id, siteAuditId));

  for (const row of rows) {
    await addScanJob({
      scanId: row.id,
      url: row.url,
      viewports: viewportConfigs,
      devices: resolvedDevices,
      browserEngine: "chromium",
      aiEnabled: false,
    });
  }

  revalidatePath(`/site-audit/${siteAuditId}`);
  return {};
}
