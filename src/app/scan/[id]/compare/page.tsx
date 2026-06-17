import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, lt, desc } from "drizzle-orm";
import { ArrowDownRight, ArrowUpRight, Minus, ArrowLeft, GitCompare } from "lucide-react";
import { db } from "@/lib/db";
import { scans, auditIssues, categoryScores } from "@/lib/db/schema";
import { SiteHeader } from "@/components/layout/site-header";
import { PageHead } from "@/components/layout/page-head";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeChip } from "@/components/dashboard/grade-chip";
import {
  getGradeFromScore,
  getScoreHexColor,
  SEVERITY_COLORS,
  CATEGORY_LABELS,
} from "@/lib/ui-constants";
import { groupFindings, type Finding } from "@/lib/audit/findings";
import { diffFindings, type FindingDelta } from "@/lib/audit/scan-compare";
import { loadSuppressions, makeSuppressionFilter } from "@/lib/audit/suppressions";
import type { AuditIssue, AuditCategory, IssueSeverity, Grade } from "@/lib/types";
import { cn } from "@/lib/utils";

async function loadScanFindings(scanId: string): Promise<Finding[]> {
  const [issuesRaw, supp] = await Promise.all([
    db.query.auditIssues.findMany({ where: eq(auditIssues.scanId, scanId) }),
    loadSuppressions(scanId),
  ]);
  const isSuppressed = makeSuppressionFilter(supp);
  const issues: AuditIssue[] = issuesRaw
    .map((i) => ({
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
    }))
    .filter((i) => !isSuppressed(i));
  return groupFindings(issues);
}

function fmtDate(d: Date) {
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function DeltaBadge({ delta, invert = false }: { delta: number; invert?: boolean }) {
  // invert=true → fewer is better (issue counts); default → higher is better (scores)
  const good = invert ? delta < 0 : delta > 0;
  const bad = invert ? delta > 0 : delta < 0;
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground tabular-nums">
        <Minus className="size-3.5" />0
      </span>
    );
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-semibold tabular-nums",
        good && "text-emerald-600 dark:text-emerald-400",
        bad && "text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="size-3.5" />
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

function SeverityPill({ severity }: { severity: IssueSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        (SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info).badge,
      )}
    >
      {severity}
    </span>
  );
}

function FindingRow({
  finding,
  note,
}: {
  finding: Finding;
  note?: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <SeverityPill severity={finding.severity} />
      <span className="text-sm font-semibold">{finding.title}</span>
      <Badge variant="secondary" className="text-xs">
        {CATEGORY_LABELS[finding.category] ?? finding.category}
      </Badge>
      <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
        {note ?? `${finding.count} element${finding.count === 1 ? "" : "s"}`}
      </span>
    </li>
  );
}

interface CompareProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vs?: string }>;
}

export default async function CompareScanPage({ params, searchParams }: CompareProps) {
  const { id } = await params;
  const { vs } = await searchParams;

  const current = await db.query.scans.findFirst({ where: eq(scans.id, id) });
  if (!current || current.status !== "completed") notFound();

  const baseline = vs
    ? await db.query.scans.findFirst({ where: eq(scans.id, vs) })
    : await db.query.scans.findFirst({
        where: and(
          eq(scans.url, current.url),
          eq(scans.status, "completed"),
          lt(scans.createdAt, current.createdAt),
        ),
        orderBy: [desc(scans.createdAt)],
      });

  const hostname = (() => {
    try {
      return new URL(current.url).hostname;
    } catch {
      return current.url;
    }
  })();

  const head = (children: ReactNode) => (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Dashboard", href: "/" },
        { label: hostname, href: `/scan/${id}` },
        { label: "Compare" },
      ]} />
      <div className="flex flex-1 flex-col gap-5 p-4 lg:p-6">
        <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
          <PageHead icon={GitCompare} title={`Compare · ${hostname}`} subtitle="Before / after against a previous scan of this URL." />
          <Link href={`/scan/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="size-3.5" /> Back to report
          </Link>
          {children}
        </div>
      </div>
    </>
  );

  if (!baseline || baseline.status !== "completed") {
    return head(
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No earlier completed scan of this URL to compare against yet. Re-scan{" "}
          {hostname} later to see the before/after.
        </CardContent>
      </Card>,
    );
  }

  const [currFindings, baseFindings, currCatsRaw, baseCatsRaw] = await Promise.all([
    loadScanFindings(id),
    loadScanFindings(baseline.id),
    db.query.categoryScores.findMany({ where: eq(categoryScores.scanId, id) }),
    db.query.categoryScores.findMany({ where: eq(categoryScores.scanId, baseline.id) }),
  ]);

  const diff = diffFindings(baseFindings, currFindings);

  const currScore = current.overallScore ?? 0;
  const baseScore = baseline.overallScore ?? 0;
  const overallDelta = currScore - baseScore;

  // Per-category before/after.
  const baseCat = new Map(baseCatsRaw.map((c) => [c.category, c.score]));
  const currCat = new Map(currCatsRaw.map((c) => [c.category, c.score]));
  const categories = Array.from(new Set([...baseCat.keys(), ...currCat.keys()])).filter(
    (c) => c !== "ai-analysis",
  );

  return head(
    <div className="flex flex-col gap-5">
      {/* Overall before → after */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 py-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Baseline</p>
              <span className="text-[34px] font-extrabold tabular-nums" style={{ color: getScoreHexColor(baseScore) }}>{baseScore}</span>
              <p className="text-xs text-muted-foreground">{fmtDate(baseline.createdAt)}</p>
            </div>
            <ArrowLeft className="size-5 rotate-180 text-muted-foreground" />
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current</p>
              <span className="text-[34px] font-extrabold tabular-nums" style={{ color: getScoreHexColor(currScore) }}>{currScore}</span>
              <p className="text-xs text-muted-foreground">{fmtDate(current.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <GradeChip grade={(current.overallGrade as Grade | null) ?? getGradeFromScore(currScore)} size={30} />
            <div className="text-sm">
              <p className="font-semibold">Overall score</p>
              <DeltaBadge delta={overallDelta} />
            </div>
          </div>
          <div className="ml-auto flex gap-3 text-sm">
            <span className="rounded-lg bg-red-50 px-2.5 py-1 font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">{diff.added.length} new</span>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">{diff.fixed.length} fixed</span>
            <span className="rounded-lg bg-secondary px-2.5 py-1 font-semibold text-muted-foreground">{diff.changed.length} changed</span>
          </div>
        </CardContent>
      </Card>

      {/* Per-category */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Category scores</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Category</th>
              <th className="px-4 py-2 text-right font-semibold">Baseline</th>
              <th className="px-4 py-2 text-right font-semibold">Current</th>
              <th className="px-4 py-2 text-right font-semibold">Δ</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const b = baseCat.get(c);
              const cur = currCat.get(c);
              const delta = (cur ?? 0) - (b ?? 0);
              return (
                <tr key={c} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{CATEGORY_LABELS[c] ?? c}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{b ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums" style={{ color: cur != null ? getScoreHexColor(cur) : undefined }}>{cur ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{b != null && cur != null ? <DeltaBadge delta={delta} /> : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Newly introduced */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400">
          Newly introduced{diff.added.length > 0 ? ` · ${diff.added.length}` : ""}
        </div>
        {diff.added.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No new findings since the baseline. 🎉</p>
        ) : (
          <ul className="divide-y">{diff.added.map((f) => <FindingRow key={f.ruleId} finding={f} />)}</ul>
        )}
      </Card>

      {/* Resolved */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Resolved{diff.fixed.length > 0 ? ` · ${diff.fixed.length}` : ""}
        </div>
        {diff.fixed.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">No findings resolved since the baseline.</p>
        ) : (
          <ul className="divide-y">{diff.fixed.map((f) => <FindingRow key={f.ruleId} finding={f} />)}</ul>
        )}
      </Card>

      {/* Changed counts */}
      {diff.changed.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">Changed · {diff.changed.length}</div>
          <ul className="divide-y">
            {diff.changed.map((d: FindingDelta) => (
              <FindingRow
                key={d.finding.ruleId}
                finding={d.finding}
                note={`${d.prevCount} → ${d.currCount} elements`}
              />
            ))}
          </ul>
        </Card>
      )}
    </div>,
  );
}
