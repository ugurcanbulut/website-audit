import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import { Network, XCircle, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { siteAudits, crawls, crawlPages, scans, auditIssues, suppressions } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildSiteTree } from "@/lib/crawler/site-tree";
import { SiteTreeSelect } from "@/components/site-audit/site-tree-select";
import { DiscoveryProgress } from "@/components/site-audit/discovery-progress";
import { SiteAuditProgress } from "@/components/site-audit/site-audit-progress";
import { GradeChip } from "@/components/dashboard/grade-chip";
import { getGradeFromScore, getScoreHexColor, SEVERITY_COLORS, CATEGORY_LABELS } from "@/lib/ui-constants";
import { groupFindings, mergeSiteFindings } from "@/lib/audit/findings";
import { makeSuppressionFilter, type SuppressionRule } from "@/lib/audit/suppressions";
import { cn } from "@/lib/utils";
import type { Grade, AuditIssue, AuditCategory, IssueSeverity } from "@/lib/types";

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

  // ── completed: aggregated rollup ────────────────────────────────────────
  const ranked = [...completed].sort(
    (a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0),
  );

  // Site-wide finding rollup: group findings within each page, then merge by
  // rule across pages (suppressed issues excluded, as everywhere).
  const completedIds = completed.map((s) => s.id);
  const [issuesRaw, suppRaw] = completedIds.length
    ? await Promise.all([
        db.query.auditIssues.findMany({ where: inArray(auditIssues.scanId, completedIds) }),
        db.query.suppressions.findMany({ where: inArray(suppressions.scanId, completedIds) }),
      ])
    : [[], []];

  const issuesByScan = new Map<string, AuditIssue[]>();
  for (const i of issuesRaw) {
    const list = issuesByScan.get(i.scanId) ?? [];
    list.push({
      id: i.id,
      category: i.category as AuditCategory,
      severity: i.severity as IssueSeverity,
      ruleId: i.ruleId,
      title: i.title,
      description: i.description,
      elementSelector: i.elementSelector ?? undefined,
      elementHtml: i.elementHtml ?? undefined,
      recommendation: i.recommendation ?? undefined,
      details: (i.details as Record<string, unknown> | null) ?? undefined,
    });
    issuesByScan.set(i.scanId, list);
  }
  const suppByScan = new Map<string, SuppressionRule[]>();
  for (const s of suppRaw) {
    const list = suppByScan.get(s.scanId) ?? [];
    list.push({ ruleId: s.ruleId, elementSelector: s.elementSelector ?? null });
    suppByScan.set(s.scanId, list);
  }
  const perPageFindings = completedIds.map((sid) => {
    const isSup = makeSuppressionFilter(suppByScan.get(sid) ?? []);
    return groupFindings((issuesByScan.get(sid) ?? []).filter((i) => !isSup(i)));
  });
  const siteFindings = mergeSiteFindings(perPageFindings);

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
          Site-wide findings{siteFindings.length > 0 ? ` · ${siteFindings.length}` : ""}
        </div>
        {siteFindings.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No issues found across the audited pages.
          </p>
        ) : (
          <ul className="divide-y">
            {siteFindings.slice(0, 40).map((f) => (
              <li key={f.ruleId} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      (SEVERITY_COLORS[f.severity] ?? SEVERITY_COLORS.info).badge,
                    )}
                  >
                    {f.severity}
                  </span>
                  <span className="text-sm font-semibold">{f.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[f.category] ?? f.category}
                  </Badge>
                  <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
                    {f.pageCount} page{f.pageCount === 1 ? "" : "s"} · {f.elementCount} element
                    {f.elementCount === 1 ? "" : "s"}
                  </span>
                </div>
                {f.recommendation && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                    {f.recommendation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
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
