"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Info, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getLighthouseTextColor, getScoreBgColor, getLighthouseColor } from "@/lib/ui-constants";

interface LighthouseReportProps {
  desktopLhr?: Record<string, unknown>;
  mobileLhr?: Record<string, unknown>;
}

// Helper to safely access nested LHR data
function getLhrData(lhr: Record<string, unknown>) {
  const categories = lhr.categories as Record<string, { score: number | null; title: string; auditRefs: Array<{ id: string; weight: number; group?: string }> }> | undefined;
  const audits = lhr.audits as Record<string, {
    id: string;
    title: string;
    description: string;
    score: number | null;
    numericValue?: number;
    numericUnit?: string;
    displayValue?: string;
    scoreDisplayMode?: string;
    details?: {
      type?: string;
      items?: Array<Record<string, unknown>>;
      headings?: Array<{ key: string; label: string; valueType?: string }>;
      overallSavingsMs?: number;
      overallSavingsBytes?: number;
    };
  }> | undefined;
  return { categories, audits };
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const size = 72;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getLighthouseColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100`}>
        <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/20" />
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-bold tabular-nums", getLighthouseTextColor(score))}>{score}</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function MetricCard({ name, value, unit, score }: { name: string; value: string; unit?: string; score: number | null }) {
  const s = score !== null ? Math.round(score * 100) : null;
  return (
    <div className={cn("rounded-lg border p-3", s !== null ? getScoreBgColor(s) : "")}>
      <p className="text-sm text-muted-foreground">{name}</p>
      <p className="text-xl font-bold tabular-nums">
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
    </div>
  );
}

// AuditItem: an expandable row for an individual Lighthouse audit
function AuditItem({ audit, savings }: {
  audit: {
    id: string; title: string; description: string; score: number | null;
    displayValue?: string; details?: { type?: string; items?: Array<Record<string, unknown>>; headings?: Array<{ key: string; label: string; valueType?: string }>; overallSavingsMs?: number; overallSavingsBytes?: number };
  };
  savings?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = audit.score !== null ? Math.round(audit.score * 100) : null;
  const items = audit.details?.items ?? [];
  const headings = audit.details?.headings ?? [];

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label="Expand audit details"
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        {s !== null && s === 0 ? (
          <AlertTriangle className="size-4 text-red-500 shrink-0" />
        ) : s !== null && s < 50 ? (
          <AlertTriangle className="size-4 text-orange-500 shrink-0" />
        ) : (
          <Info className="size-4 text-blue-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium">{audit.title}</p>
          {(audit.displayValue || savings) && (
            <p className="text-sm text-muted-foreground">
              {audit.displayValue}
              {savings && <span className="ml-2 text-orange-600 dark:text-orange-400 font-medium">{savings}</span>}
            </p>
          )}
        </div>
        {items.length > 0 && (
          expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />
        )}
      </button>

      {expanded && items.length > 0 && (
        <div className="border-t px-3 py-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {headings.filter(h => h.key && h.label).map((h) => (
                  <th key={h.key} className="py-1.5 pr-4 text-left font-medium text-muted-foreground">{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 20).map((item, i) => (
                <tr key={i} className="border-b last:border-0">
                  {headings.filter(h => h.key && h.label).map((h) => {
                    let val = item[h.key];
                    // Format values
                    if (h.valueType === "bytes" && typeof val === "number") val = `${(val / 1024).toFixed(1)} KB`;
                    else if (h.valueType === "ms" && typeof val === "number") val = `${(val / 1000).toFixed(2)} s`;
                    else if (h.valueType === "url" && typeof val === "string") val = val.split("/").pop() || val;
                    else if (typeof val === "object" && val !== null) {
                      const v = val as Record<string, unknown>;
                      val = (v.url as string) || (v.value as string) || JSON.stringify(val).slice(0, 60);
                    }
                    return (
                      <td key={h.key} className="py-1.5 pr-4 max-w-[300px] truncate">
                        {String(val ?? "--")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 20 && (
            <p className="text-sm text-muted-foreground py-2">...and {items.length - 20} more items</p>
          )}
        </div>
      )}
    </div>
  );
}

function LhrView({ lhr }: { lhr: Record<string, unknown> }) {
  const { categories, audits } = getLhrData(lhr);
  const [showPassed, setShowPassed] = useState(false);

  if (!categories || !audits) {
    return <p className="text-muted-foreground">Lighthouse data not available.</p>;
  }

  // Extract scores
  const scores: Array<{ label: string; score: number }> = [];
  for (const [key, cat] of Object.entries(categories)) {
    if (cat.score != null) {
      const label = key === "best-practices" ? "Best Practices" : key.charAt(0).toUpperCase() + key.slice(1);
      scores.push({ label, score: Math.round(cat.score * 100) });
    }
  }

  // Separate audits into opportunities, diagnostics, passed
  const opportunities: typeof audits[string][] = [];
  const diagnostics: typeof audits[string][] = [];
  const passed: typeof audits[string][] = [];

  // Get all audit IDs from categories
  const allAuditIds = new Set<string>();
  for (const cat of Object.values(categories)) {
    for (const ref of cat.auditRefs) allAuditIds.add(ref.id);
  }

  for (const id of allAuditIds) {
    const audit = audits[id];
    if (!audit || audit.scoreDisplayMode === "manual" || audit.scoreDisplayMode === "notApplicable") continue;
    if (audit.score === null || audit.score === undefined) continue;

    if (audit.score >= 0.9) {
      passed.push(audit);
    } else if (audit.details?.overallSavingsMs || audit.details?.overallSavingsBytes) {
      opportunities.push(audit);
    } else {
      diagnostics.push(audit);
    }
  }

  // Sort opportunities by savings (highest first)
  opportunities.sort((a, b) => {
    const savA = (a.details?.overallSavingsMs ?? 0) + (a.details?.overallSavingsBytes ?? 0) / 1000;
    const savB = (b.details?.overallSavingsMs ?? 0) + (b.details?.overallSavingsBytes ?? 0) / 1000;
    return savB - savA;
  });

  // Performance metrics
  const metricIds = ["largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "first-contentful-paint", "speed-index"];
  const metricLabels: Record<string, string> = {
    "largest-contentful-paint": "LCP",
    "total-blocking-time": "TBT",
    "cumulative-layout-shift": "CLS",
    "first-contentful-paint": "FCP",
    "speed-index": "Speed Index",
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Scores */}
      <div className="flex items-center justify-center gap-8 flex-wrap py-4">
        {scores.map((s) => (
          <ScoreGauge key={s.label} score={s.score} label={s.label} />
        ))}
      </div>

      {/* Metrics */}
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

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Opportunities <span className="text-muted-foreground font-normal text-base">({opportunities.length})</span>
          </h3>
          <div className="space-y-2">
            {opportunities.map((audit) => {
              let savings = "";
              if (audit.details?.overallSavingsMs) savings = `${(audit.details.overallSavingsMs / 1000).toFixed(1)}s savings`;
              else if (audit.details?.overallSavingsBytes) savings = `${(audit.details.overallSavingsBytes / 1024).toFixed(0)} KB savings`;
              return <AuditItem key={audit.id} audit={audit} savings={savings} />;
            })}
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {diagnostics.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Diagnostics <span className="text-muted-foreground font-normal text-base">({diagnostics.length})</span>
          </h3>
          <div className="space-y-2">
            {diagnostics.map((audit) => (
              <AuditItem key={audit.id} audit={audit} />
            ))}
          </div>
        </div>
      )}

      {/* Passed Audits */}
      {passed.length > 0 && (
        <div>
          <button onClick={() => setShowPassed(!showPassed)} aria-expanded={showPassed} aria-label="Toggle passed audits" className="flex items-center gap-2 text-base font-semibold hover:underline">
            {showPassed ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            Passed Audits ({passed.length})
          </button>
          {showPassed && (
            <div className="mt-2 space-y-1">
              {passed.map((audit) => (
                <div key={audit.id} className="flex items-center gap-2 py-1.5 text-base text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                  {audit.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LighthouseReport({ desktopLhr, mobileLhr }: LighthouseReportProps) {
  const hasDesktop = !!desktopLhr;
  const hasMobile = !!mobileLhr;

  if (!hasDesktop && !hasMobile) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <p className="text-base text-muted-foreground mb-2">No Lighthouse data available.</p>
        <p className="text-sm text-muted-foreground">Lighthouse requires the Chromium browser engine. Change the browser setting in your next scan to enable Performance, SEO, and Best Practices audits.</p>
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
        <TabsContent value="desktop"><LhrView lhr={desktopLhr!} /></TabsContent>
        <TabsContent value="mobile"><LhrView lhr={mobileLhr!} /></TabsContent>
      </Tabs>
    );
  }

  return <LhrView lhr={(desktopLhr ?? mobileLhr)!} />;
}
