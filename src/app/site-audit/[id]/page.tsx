import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import { Network, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { siteAudits, crawls, crawlPages } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { Card, CardContent } from "@/components/ui/card";
import { buildSiteTree } from "@/lib/crawler/site-tree";
import { SiteTreeSelect } from "@/components/site-audit/site-tree-select";
import { DiscoveryProgress } from "@/components/site-audit/discovery-progress";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SiteAuditPage({ params }: PageProps) {
  const { id } = await params;
  const audit = await db.query.siteAudits.findFirst({
    where: eq(siteAudits.id, id),
  });
  if (!audit) notFound();

  const host = (() => {
    try {
      return new URL(audit.seedUrl).host;
    } catch {
      return audit.seedUrl;
    }
  })();

  // Lazy state transition: once the discovery crawl finishes, move into the
  // page-selection step (or surface a failure).
  let status = audit.status;
  if (status === "discovering" && audit.crawlId) {
    const crawl = await db.query.crawls.findFirst({
      where: eq(crawls.id, audit.crawlId),
    });
    if (crawl?.status === "completed") {
      await db.update(siteAudits).set({ status: "selecting" }).where(eq(siteAudits.id, id));
      status = "selecting";
    } else if (crawl?.status === "failed") {
      await db
        .update(siteAudits)
        .set({ status: "failed", error: crawl.error ?? "Discovery crawl failed" })
        .where(eq(siteAudits.id, id));
      status = "failed";
    }
  }

  const head = (
    <SiteHeader breadcrumbs={[
      { label: "Dashboard", href: "/" },
      { label: "Site Audit", href: "/site-audit/new" },
      { label: host },
    ]} />
  );

  const shell = (children: ReactNode, subtitle: string) => (
    <>
      {head}
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
          <PageHead icon={Network} title={`Site Audit · ${host}`} subtitle={subtitle} />
          {children}
        </div>
      </div>
    </>
  );

  if (status === "failed") {
    return shell(
      <Card>
        <CardContent className="flex flex-col items-center py-10 text-center">
          <XCircle className="mb-4 size-12 text-destructive" />
          <h2 className="mb-2 text-lg font-semibold">Discovery failed</h2>
          <p className="max-w-md text-muted-foreground">
            {audit.error ?? "The discovery crawl could not complete."}
          </p>
        </CardContent>
      </Card>,
      "Whole-site audit",
    );
  }

  if (status === "discovering" && audit.crawlId) {
    return shell(
      <DiscoveryProgress crawlId={audit.crawlId} seedUrl={audit.seedUrl} />,
      "Mapping the site before you pick pages to audit.",
    );
  }

  if (status === "selecting" && audit.crawlId) {
    // Real, auditable pages only: 2xx HTML responses.
    const pages = await db.query.crawlPages.findMany({
      where: and(
        eq(crawlPages.crawlId, audit.crawlId),
        inArray(crawlPages.statusCode, [200, 201, 203, 204, 206]),
      ),
    });
    const tree = buildSiteTree(
      pages.map((p) => ({
        url: p.url,
        statusCode: p.statusCode,
        title: p.title,
        wordCount: p.wordCount,
        responseTimeMs: p.responseTimeMs,
        inlinksCount: p.inlinksCount,
      })),
    );
    return shell(
      <SiteTreeSelect siteAuditId={id} tree={tree} />,
      "Choose the pages to audit. Tick a folder to take its whole branch.",
    );
  }

  // auditing / completed — per-page scans + aggregated report land in 3c/3d.
  const selected = (audit.selectedUrls as string[] | null) ?? [];
  return shell(
    <Card>
      <CardContent className="py-8">
        <p className="text-base font-semibold">
          {audit.totalPages} page{audit.totalPages === 1 ? "" : "s"} queued for audit
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-page scanning and the aggregated site report are wired up next.
        </p>
        {selected.length > 0 && (
          <ul className="mt-4 space-y-1">
            {selected.slice(0, 20).map((u) => (
              <li key={u} className="truncate font-mono text-xs text-muted-foreground">
                {u}
              </li>
            ))}
            {selected.length > 20 && (
              <li className="text-xs text-muted-foreground">…and {selected.length - 20} more</li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>,
    "Whole-site audit",
  );
}
