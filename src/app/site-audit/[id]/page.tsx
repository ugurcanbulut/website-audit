import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import { Network, XCircle, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { siteAudits, crawls, crawlPages, scans } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { Card, CardContent } from "@/components/ui/card";
import { buildSiteTree } from "@/lib/crawler/site-tree";
import { SiteTreeSelect } from "@/components/site-audit/site-tree-select";
import { DiscoveryProgress } from "@/components/site-audit/discovery-progress";
import { SiteAuditProgress } from "@/components/site-audit/site-audit-progress";
import { GradeChip } from "@/components/dashboard/grade-chip";
import { getGradeFromScore, getScoreHexColor } from "@/lib/ui-constants";
import type { Grade } from "@/lib/types";

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

  // ── auditing / completed: per-page scans ────────────────────────────────
  const pageScans = await db.query.scans.findMany({
    where: eq(scans.siteAuditId, id),
  });
  const finished = pageScans.filter(
    (s) => s.status === "completed" || s.status === "failed",
  );
  const completed = pageScans.filter((s) => s.status === "completed");
  const failedCount = pageScans.filter((s) => s.status === "failed").length;

  // Roll up the site score from the completed page scans (computed here so the
  // render uses fresh values, not the row read before the update below).
  const scored = completed.filter((s) => s.overallScore != null);
  const score = scored.length
    ? Math.round(scored.reduce((n, s) => n + (s.overallScore ?? 0), 0) / scored.length)
    : 0;
  const grade: Grade = getGradeFromScore(score);

  // Lazy completion: once every page scan has finished, persist the rollup and
  // mark the audit complete.
  if (
    status === "auditing" &&
    pageScans.length > 0 &&
    finished.length === pageScans.length
  ) {
    await db
      .update(siteAudits)
      .set({
        status: "completed",
        overallScore: score,
        overallGrade: grade,
        pagesCompleted: completed.length,
        completedAt: new Date(),
      })
      .where(eq(siteAudits.id, id));
    status = "completed";
  }

  if (status === "auditing") {
    return shell(
      <SiteAuditProgress done={finished.length} total={pageScans.length} failed={failedCount} />,
      "Auditing the selected pages.",
    );
  }

  // ── completed: aggregated rollup (3c baseline; 3d adds site-wide findings) ─
  const ranked = [...completed].sort(
    (a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0),
  );

  return shell(
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-5 py-6">
          <div className="flex items-center gap-3">
            <span
              className="text-[44px] font-extrabold leading-none tabular-nums"
              style={{ color: getScoreHexColor(score) }}
            >
              {score}
            </span>
            <GradeChip grade={grade} size={32} />
          </div>
          <div>
            <p className="text-base font-semibold">Site score (avg of {completed.length} pages)</p>
            <p className="text-sm text-muted-foreground">
              {completed.length} audited{failedCount > 0 ? ` · ${failedCount} failed` : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          Pages — worst first
        </div>
        <ul className="divide-y">
          {ranked.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <span
                  className="mr-2 inline-block w-9 text-right font-bold tabular-nums"
                  style={{ color: getScoreHexColor(s.overallScore ?? 0) }}
                >
                  {s.overallScore ?? "—"}
                </span>
                <span className="truncate font-mono text-sm text-muted-foreground">
                  {(() => {
                    try { return new URL(s.url).pathname || "/"; } catch { return s.url; }
                  })()}
                </span>
              </div>
              <Link
                href={`/scan/${s.id}`}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Report <ExternalLink className="size-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>,
    "Whole-site audit",
  );
}
