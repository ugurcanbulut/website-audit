"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getLighthouseTextColor,
  getScoreBgColor,
  getLighthouseColor,
} from "@/lib/ui-constants";

// ── Types ──────────────────────────────────────────────────────────────

interface LighthouseReportProps {
  desktopLhr?: Record<string, unknown>;
  mobileLhr?: Record<string, unknown>;
}

interface AuditHeading {
  key: string;
  label: string;
  valueType?: string;
}

interface AuditDetails {
  type?: string;
  items?: Array<Record<string, unknown>>;
  headings?: AuditHeading[];
  overallSavingsMs?: number;
  overallSavingsBytes?: number;
}

interface Audit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  numericValue?: number;
  numericUnit?: string;
  displayValue?: string;
  scoreDisplayMode?: string;
  metricSavings?: Record<string, number>;
  details?: AuditDetails;
}

interface Category {
  score: number | null;
  title: string;
  auditRefs: Array<{ id: string; weight: number; group?: string }>;
}

// ── Helpers: typed value formatting ────────────────────────────────────

function formatValue(value: unknown, valueType?: string): string {
  if (value === null || value === undefined) return "--";
  switch (valueType) {
    case "bytes":
      return typeof value === "number"
        ? `${(value / 1024).toFixed(1)} KiB`
        : String(value);
    case "ms":
    case "timespanMs":
      return typeof value === "number"
        ? value >= 1000
          ? `${(value / 1000).toFixed(1)} s`
          : `${Math.round(value)} ms`
        : String(value);
    case "numeric":
      return typeof value === "number"
        ? value.toLocaleString()
        : String(value);
    case "url": {
      const str = String(value);
      try {
        const url = new URL(str);
        const file = url.pathname.split("/").pop() || url.pathname;
        return file.length > 40 ? file.slice(0, 37) + "..." : file;
      } catch {
        return str.length > 50 ? str.slice(0, 47) + "..." : str;
      }
    }
    default:
      return String(value).length > 80
        ? String(value).slice(0, 77) + "..."
        : String(value);
  }
}

// ── Helpers: markdown link parsing ─────────────────────────────────────

function renderDescription(text: string): ReactNode {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      return (
        <a
          key={i}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          {match[1]} <ExternalLink className="size-3" />
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Helpers: node / element rendering ──────────────────────────────────

function renderNodeValue(node: Record<string, unknown>) {
  const snippet = node.snippet as string | undefined;
  const nodeLabel = node.nodeLabel as string | undefined;
  const selector = node.selector as string | undefined;

  return (
    <div className="flex flex-col gap-0.5">
      {nodeLabel && <span className="font-medium">{nodeLabel}</span>}
      {snippet && (
        <code className="text-sm font-mono bg-muted px-1 rounded break-words">
          {snippet}
        </code>
      )}
      {selector && (
        <span className="text-sm text-muted-foreground truncate">
          {selector}
        </span>
      )}
    </div>
  );
}

// ── Helpers: generic cell renderer ─────────────────────────────────────

function renderCell(value: unknown, heading: AuditHeading): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">--</span>;
  }

  // Object values (node, source-location, link, code, etc.)
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    if (obj.type === "node") return renderNodeValue(obj);

    if (obj.type === "source-location") {
      return (
        <code className="text-sm font-mono">
          {String(obj.url)}:{String(obj.line)}:{String(obj.column)}
        </code>
      );
    }

    if (obj.type === "link") {
      return (
        <a
          href={obj.url as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
        >
          {(obj.text as string) || "Link"}
        </a>
      );
    }

    if (obj.type === "code") {
      return (
        <code className="text-sm font-mono bg-muted px-1 rounded">
          {obj.value as string}
        </code>
      );
    }

    // Fallback: objects with a url property (e.g. thumbnail)
    if (obj.url) {
      return (
        <span className="text-sm truncate">
          {formatValue(obj.url, "url")}
        </span>
      );
    }

    return (
      <span className="text-sm">{JSON.stringify(value).slice(0, 60)}</span>
    );
  }

  // For URL-typed cells, wrap with a tooltip showing the full URL
  if (heading.valueType === "url" && typeof value === "string") {
    return (
      <Tooltip>
        <TooltipTrigger className="text-sm tabular-nums truncate max-w-[260px] block text-left">
          {formatValue(value, heading.valueType)}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md break-all">
          {String(value)}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className="text-sm tabular-nums">
      {formatValue(value, heading.valueType)}
    </span>
  );
}

// ── LHR data accessor ──────────────────────────────────────────────────

function getLhrData(lhr: Record<string, unknown>) {
  const categories = lhr.categories as
    | Record<string, Category>
    | undefined;
  const audits = lhr.audits as Record<string, Audit> | undefined;
  return { categories, audits };
}

// ── ScoreGauge ─────────────────────────────────────────────────────────

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getLighthouseColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`${label}: ${score} out of 100`}
      >
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              getLighthouseTextColor(score)
            )}
          >
            {score}
          </span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

// ── MetricCard ─────────────────────────────────────────────────────────

function MetricCard({
  name,
  value,
  unit,
  score,
}: {
  name: string;
  value: string;
  unit?: string;
  score: number | null;
}) {
  const s = score !== null ? Math.round(score * 100) : null;
  return (
    <div className={cn("rounded-lg border p-3", s !== null ? getScoreBgColor(s) : "")}>
      <p className="text-sm text-muted-foreground">{name}</p>
      <p className="text-xl font-bold tabular-nums">
        {value}
        {unit && (
          <span className="text-sm font-normal text-muted-foreground ml-1">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

// ── AuditItem ──────────────────────────────────────────────────────────

function AuditItem({
  audit,
  savings,
}: {
  audit: Audit;
  savings?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = audit.score !== null ? Math.round(audit.score * 100) : null;
  const items = audit.details?.items ?? [];
  const headings = (audit.details?.headings ?? []).filter(
    (h) => h.key && h.label
  );
  const hasExpandable = items.length > 0;

  // Metric savings badges
  const metricSavingsEntries = audit.metricSavings
    ? Object.entries(audit.metricSavings).filter(([, v]) => v > 0)
    : [];

  return (
    <div className="border rounded-lg">
      {/* Header row */}
      <button
        onClick={() => hasExpandable && setExpanded(!expanded)}
        aria-expanded={hasExpandable ? expanded : undefined}
        aria-label={
          hasExpandable ? "Expand audit details" : audit.title
        }
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left transition-colors",
          hasExpandable && "hover:bg-muted/50 cursor-pointer"
        )}
      >
        {/* Score icon */}
        {s !== null && s === 0 ? (
          <AlertTriangle className="size-4 text-red-500 shrink-0" />
        ) : s !== null && s < 50 ? (
          <AlertTriangle className="size-4 text-orange-500 shrink-0" />
        ) : (
          <Info className="size-4 text-blue-500 shrink-0" />
        )}

        {/* Title, display value, savings, and metric badges */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium">{audit.title}</p>
          {(audit.displayValue || savings) && (
            <p className="text-sm text-muted-foreground">
              {audit.displayValue}
              {savings && (
                <span className="ml-2 text-orange-600 dark:text-orange-400 font-medium">
                  {savings}
                </span>
              )}
            </p>
          )}
          {metricSavingsEntries.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {metricSavingsEntries.map(([metric, value]) => (
                <Badge key={metric} variant="outline" className="text-xs">
                  {metric}{" "}
                  -{formatValue(value, metric === "CLS" ? "numeric" : "ms")}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        {hasExpandable &&
          (expanded ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          ))}
      </button>

      {/* Expanded detail area */}
      {expanded && (
        <div className="border-t">
          {/* Description */}
          {audit.description && (
            <div className="px-3 pt-2 pb-1 text-sm text-muted-foreground leading-relaxed">
              {renderDescription(audit.description)}
            </div>
          )}

          {/* Data table */}
          {items.length > 0 && headings.length > 0 && (
            <TooltipProvider>
              <div className="px-3 py-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {headings.map((h) => (
                        <th
                          key={h.key}
                          className="py-1.5 pr-4 text-left font-medium text-muted-foreground whitespace-nowrap"
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 20).map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {headings.map((h) => (
                          <td
                            key={h.key}
                            className="py-1.5 pr-4 max-w-[320px] align-top"
                          >
                            {renderCell(item[h.key], h)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length > 20 && (
                  <p className="text-sm text-muted-foreground py-2">
                    ...and {items.length - 20} more items
                  </p>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
}

// ── PassedAuditItem ────────────────────────────────────────────────────

function PassedAuditItem({ audit }: { audit: Audit }) {
  const [showDescription, setShowDescription] = useState(false);

  return (
    <div>
      <button
        onClick={() => setShowDescription(!showDescription)}
        className="flex items-center gap-2 py-1.5 text-base text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
        <span className="flex-1">{audit.title}</span>
        {showDescription ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
      </button>
      {showDescription && audit.description && (
        <div className="ml-6 pb-1 text-sm text-muted-foreground leading-relaxed">
          {renderDescription(audit.description)}
        </div>
      )}
    </div>
  );
}

// ── LhrView: main view for a single LHR ───────────────────────────────

function LhrView({ lhr }: { lhr: Record<string, unknown> }) {
  const { categories, audits } = getLhrData(lhr);
  const [showPassed, setShowPassed] = useState(false);
  const [showAllDiagnostics, setShowAllDiagnostics] = useState(false);

  if (!categories || !audits) {
    return (
      <p className="text-muted-foreground">Lighthouse data not available.</p>
    );
  }

  // ---- Extract category scores ----
  const scores: Array<{ label: string; score: number }> = [];
  for (const [key, cat] of Object.entries(categories)) {
    if (cat.score != null) {
      const label =
        key === "best-practices"
          ? "Best Practices"
          : key.charAt(0).toUpperCase() + key.slice(1);
      scores.push({ label, score: Math.round(cat.score * 100) });
    }
  }

  // ---- Classify audits ----
  const opportunities: Audit[] = [];
  const diagnostics: Audit[] = [];
  const passed: Audit[] = [];

  const allAuditIds = new Set<string>();
  for (const cat of Object.values(categories)) {
    for (const ref of cat.auditRefs) allAuditIds.add(ref.id);
  }

  for (const id of allAuditIds) {
    const audit = audits[id];
    if (
      !audit ||
      audit.scoreDisplayMode === "manual" ||
      audit.scoreDisplayMode === "notApplicable"
    )
      continue;
    if (audit.score === null || audit.score === undefined) continue;

    if (audit.score >= 0.9) {
      passed.push(audit);
    } else if (
      audit.details?.overallSavingsMs ||
      audit.details?.overallSavingsBytes
    ) {
      opportunities.push(audit);
    } else {
      diagnostics.push(audit);
    }
  }

  // Sort opportunities by savings (highest first)
  opportunities.sort((a, b) => {
    const savA =
      (a.details?.overallSavingsMs ?? 0) +
      (a.details?.overallSavingsBytes ?? 0) / 1000;
    const savB =
      (b.details?.overallSavingsMs ?? 0) +
      (b.details?.overallSavingsBytes ?? 0) / 1000;
    return savB - savA;
  });

  // ---- Performance metric IDs ----
  const metricIds = [
    "largest-contentful-paint",
    "total-blocking-time",
    "cumulative-layout-shift",
    "first-contentful-paint",
    "speed-index",
  ];
  const metricLabels: Record<string, string> = {
    "largest-contentful-paint": "LCP",
    "total-blocking-time": "TBT",
    "cumulative-layout-shift": "CLS",
    "first-contentful-paint": "FCP",
    "speed-index": "Speed Index",
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* ── Category scores ── */}
      <div className="flex items-center justify-center gap-8 flex-wrap py-4">
        {scores.map((s) => (
          <ScoreGauge key={s.label} score={s.score} label={s.label} />
        ))}
      </div>

      {/* ── Performance metrics ── */}
      {categories.performance && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {metricIds.map((id) => {
              const audit = audits[id];
              if (!audit) return null;
              return (
                <MetricCard
                  key={id}
                  name={metricLabels[id] ?? id}
                  value={audit.displayValue ?? "--"}
                  score={audit.score}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Opportunities ── */}
      {opportunities.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Opportunities{" "}
            <span className="text-muted-foreground font-normal text-base">
              ({opportunities.length})
            </span>
          </h3>
          <div className="space-y-2">
            {opportunities.map((audit) => {
              const parts: string[] = [];
              if (audit.details?.overallSavingsMs) {
                parts.push(
                  `${(audit.details.overallSavingsMs / 1000).toFixed(1)} s savings`
                );
              }
              if (audit.details?.overallSavingsBytes) {
                parts.push(
                  `${(audit.details.overallSavingsBytes / 1024).toFixed(0)} KiB savings`
                );
              }
              const savings = parts.join(" / ");
              return (
                <AuditItem key={audit.id} audit={audit} savings={savings} />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Diagnostics ── */}
      {diagnostics.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Diagnostics{" "}
            <span className="text-muted-foreground font-normal text-base">
              ({diagnostics.length})
            </span>
          </h3>
          <div className="space-y-2">
            {(showAllDiagnostics
              ? diagnostics
              : diagnostics.slice(0, 5)
            ).map((audit) => (
              <AuditItem key={audit.id} audit={audit} />
            ))}
          </div>
          {diagnostics.length > 5 && !showAllDiagnostics && (
            <button
              onClick={() => setShowAllDiagnostics(true)}
              className="text-base text-primary hover:underline mt-2"
            >
              Show {diagnostics.length - 5} more diagnostics...
            </button>
          )}
        </div>
      )}

      {/* ── Passed audits ── */}
      {passed.length > 0 && (
        <div>
          <button
            onClick={() => setShowPassed(!showPassed)}
            aria-expanded={showPassed}
            aria-label="Toggle passed audits"
            className="flex items-center gap-2 text-base font-semibold hover:underline"
          >
            {showPassed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            Passed Audits ({passed.length})
          </button>
          {showPassed && (
            <div className="mt-2 space-y-1">
              {passed.map((audit) => (
                <PassedAuditItem key={audit.id} audit={audit} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── LighthouseReport (exported) ────────────────────────────────────────

export function LighthouseReport({
  desktopLhr,
  mobileLhr,
}: LighthouseReportProps) {
  const hasDesktop = !!desktopLhr;
  const hasMobile = !!mobileLhr;

  if (!hasDesktop && !hasMobile) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <p className="text-base text-muted-foreground mb-2">
          No Lighthouse data available.
        </p>
        <p className="text-sm text-muted-foreground">
          Lighthouse requires the Chromium browser engine. Change the browser
          setting in your next scan to enable Performance, SEO, and Best
          Practices audits.
        </p>
      </div>
    );
  }

  if (hasDesktop && hasMobile) {
    return (
      <Tabs defaultValue="desktop">
        <TabsList>
          <TabsTrigger value="desktop">Desktop</TabsTrigger>
          <TabsTrigger value="mobile">Mobile</TabsTrigger>
        </TabsList>
        <TabsContent value="desktop">
          <LhrView lhr={desktopLhr!} />
        </TabsContent>
        <TabsContent value="mobile">
          <LhrView lhr={mobileLhr!} />
        </TabsContent>
      </Tabs>
    );
  }

  return <LhrView lhr={(desktopLhr ?? mobileLhr)!} />;
}
