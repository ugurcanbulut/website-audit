import Link from "next/link";
import {
  Accessibility,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Eye,
  Globe,
  Layers,
  MonitorSmartphone,
  Shield,
  Smartphone,
  Sparkles,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  GRADE_COLORS,
  getGradeFromScore,
  getScoreHexColor,
} from "@/lib/ui-constants";
import { formatRelativeTime } from "@/lib/relative-time";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  accessibility: Accessibility,
  performance: Zap,
  seo: Globe,
  security: Shield,
  typography: Type,
  "touch-targets": Smartphone,
  "css-quality": Layers,
  "html-quality": Code2,
  forms: ClipboardCheck,
  visual: Eye,
  "best-practices": CheckCircle2,
  responsive: MonitorSmartphone,
  "ai-analysis": Sparkles,
};

function ScoreRing({
  score,
  size = 116,
  stroke = 9,
}: {
  score: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={getScoreHexColor(score)}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-extrabold leading-[.9] tracking-[-0.02em] text-foreground tabular-nums"
          style={{ fontSize: size * 0.3 }}
        >
          {score}
        </span>
        <span className="mt-1 text-[10px] font-bold tracking-[.1em] text-muted-foreground">
          SCORE
        </span>
      </div>
    </div>
  );
}

const GRADE_SUMMARY: Record<string, string> = {
  A: "Excellent",
  B: "Good shape",
  C: "Needs work",
  D: "Poor",
  F: "Failing",
};

export interface LatestReportData {
  id: string;
  host: string;
  score: number;
  grade: string;
  createdAt: Date;
  issueCounts: { critical: number; warning: number; info: number };
  categories: { category: string; score: number }[];
}

export function LatestReport({ report }: { report: LatestReportData | null }) {
  if (!report) {
    return (
      <Card className="gap-0 rounded-2xl px-5 py-4 shadow-none">
        <h2 className="text-lg">Latest Report</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          Once your first scan completes, its score, severity breakdown and
          per-category results will appear here.
        </p>
      </Card>
    );
  }

  const grade = report.grade || getGradeFromScore(report.score);
  const severities = [
    { label: "Critical", n: report.issueCounts.critical, dot: "bg-red-500" },
    { label: "Warnings", n: report.issueCounts.warning, dot: "bg-amber-500" },
    { label: "Info", n: report.issueCounts.info, dot: "bg-blue-500" },
  ];

  return (
    <Card className="flex h-full flex-col gap-0 rounded-2xl px-5 py-4 shadow-none">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Latest Report</h2>
        <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
          {formatRelativeTime(report.createdAt)}
        </span>
      </div>
      <div className="mb-4 mt-1 text-[13px] text-muted-foreground">{report.host}</div>

      <div className="mb-4 flex items-center gap-[18px]">
        <ScoreRing score={report.score} />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-1.5 whitespace-nowrap">
            <span className={cn("text-[13.5px] font-bold", GRADE_COLORS[grade])}>
              Grade {grade}
            </span>
            <span className="text-xs text-muted-foreground">
              · {GRADE_SUMMARY[grade] ?? ""}
            </span>
          </div>
          {severities.map((s) => (
            <div key={s.label} className="mb-1.5 flex items-center gap-2">
              <span className={cn("size-2 rounded-full", s.dot)} />
              <span className="flex-1 text-[12.5px] text-[var(--ink-2)]">{s.label}</span>
              <span className="text-[12.5px] font-bold tabular-nums text-foreground">
                {s.n}
              </span>
            </div>
          ))}
        </div>
      </div>

      {report.categories.length > 0 && (
        <>
          <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
            By category
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            {report.categories.map((c) => {
              const Icon = CATEGORY_ICONS[c.category] ?? CheckCircle2;
              return (
                <div key={c.category} className="flex items-center gap-2.5">
                  <Icon className="size-[15px] shrink-0 text-muted-foreground" />
                  <span className="w-24 truncate whitespace-nowrap text-[12.5px] text-[var(--ink-2)]">
                    {CATEGORY_LABELS[c.category] ?? c.category}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.score}%`, background: getScoreHexColor(c.score) }}
                    />
                  </div>
                  <span className="w-6 text-right text-[12.5px] font-bold tabular-nums text-foreground">
                    {c.score}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Link
        href={`/scan/${report.id}`}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "mt-4 w-full gap-1.5 font-bold"
        )}
      >
        Open full report
        <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
