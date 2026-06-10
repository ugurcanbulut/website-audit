import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getGradeFromScore } from "@/lib/ui-constants";

interface SectionCardsProps {
  totalScans: number;
  completedScans: number;
  scansThisWeek: number;
  avgScore: number | null;
  totalIssues: number;
  criticalIssues: number;
}

function DashStat({
  label,
  value,
  suffix,
  foot,
  footTone = "muted",
  trend,
}: {
  label: string;
  value: string;
  suffix?: string;
  foot: string;
  footTone?: "pass" | "crit" | "muted";
  trend?: "up" | "down";
}) {
  const footColor =
    footTone === "pass"
      ? "text-green-600"
      : footTone === "crit"
        ? "text-red-600"
        : "text-muted-foreground";
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;
  return (
    <Card className="min-w-0 flex-1 gap-0 rounded-2xl px-5 py-4 shadow-none">
      <div className="whitespace-nowrap text-[12.5px] font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[32px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-foreground">
          {value}
        </span>
        {suffix && (
          <span className="text-[15px] font-bold text-muted-foreground">{suffix}</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {trend && <TrendIcon className={cn("size-3.5", footColor)} />}
        <span className={cn("whitespace-nowrap text-[12.5px] font-medium", footColor)}>
          {foot}
        </span>
      </div>
    </Card>
  );
}

export function SectionCards({
  totalScans,
  completedScans,
  scansThisWeek,
  avgScore,
  totalIssues,
  criticalIssues,
}: SectionCardsProps) {
  const successRate =
    totalScans > 0 ? Math.round((completedScans / totalScans) * 100) : null;

  return (
    <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <DashStat
        label="Total Scans"
        value={totalScans.toLocaleString("en-US")}
        foot={scansThisWeek > 0 ? `+${scansThisWeek} this week` : "No scans this week"}
        footTone={scansThisWeek > 0 ? "pass" : "muted"}
        trend={scansThisWeek > 0 ? "up" : undefined}
      />
      <DashStat
        label="Average Score"
        value={avgScore !== null ? String(avgScore) : "—"}
        suffix={avgScore !== null ? "/ 100" : undefined}
        foot={avgScore !== null ? `Grade ${getGradeFromScore(avgScore)}` : "No completed scans yet"}
        footTone={avgScore !== null && avgScore >= 80 ? "pass" : "muted"}
        trend={avgScore !== null && avgScore >= 80 ? "up" : undefined}
      />
      <DashStat
        label="Open Issues"
        value={totalIssues.toLocaleString("en-US")}
        foot={criticalIssues > 0 ? `${criticalIssues} critical` : "No critical issues"}
        footTone={criticalIssues > 0 ? "crit" : "pass"}
        trend={criticalIssues > 0 ? "down" : undefined}
      />
      <DashStat
        label="Success Rate"
        value={successRate !== null ? String(successRate) : "—"}
        suffix={successRate !== null ? "%" : undefined}
        foot={
          successRate === null
            ? "No scans yet"
            : successRate === 100
              ? "All scans nominal"
              : `${totalScans - completedScans} in progress or failed`
        }
      />
    </div>
  );
}
