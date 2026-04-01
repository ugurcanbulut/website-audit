import { cn } from "@/lib/utils";
import { getLighthouseTextColor, getLighthouseColor } from "@/lib/ui-constants";

interface LighthouseGaugesProps {
  scores: {
    performance?: number;
    accessibility?: number;
    bestPractices?: number;
    seo?: number;
  };
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const size = 88;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Score arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getLighthouseColor(score)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-xl font-bold tabular-nums", getLighthouseTextColor(score))}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function LighthouseGauges({ scores }: LighthouseGaugesProps) {
  const hasScores = Object.values(scores).some((s) => s !== undefined);
  if (!hasScores) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="size-5 rounded bg-orange-500/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="size-3.5 text-orange-500" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
        <span className="text-base font-semibold">Lighthouse Scores</span>
      </div>
      <div className="flex items-center justify-around flex-wrap gap-4">
        {scores.performance !== undefined && (
          <ScoreGauge score={scores.performance} label="Performance" />
        )}
        {scores.accessibility !== undefined && (
          <ScoreGauge score={scores.accessibility} label="Accessibility" />
        )}
        {scores.bestPractices !== undefined && (
          <ScoreGauge score={scores.bestPractices} label="Best Practices" />
        )}
        {scores.seo !== undefined && (
          <ScoreGauge score={scores.seo} label="SEO" />
        )}
      </div>
    </div>
  );
}
