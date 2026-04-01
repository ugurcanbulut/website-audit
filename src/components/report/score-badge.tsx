import { cn } from "@/lib/utils";
import type { Grade } from "@/lib/types";
import { GRADE_BG_COLORS } from "@/lib/ui-constants";

interface ScoreBadgeProps {
  score: number;
  grade: Grade;
  size?: "sm" | "lg";
}

export function ScoreBadge({ score, grade, size = "sm" }: ScoreBadgeProps) {
  const colors = GRADE_BG_COLORS[grade] ?? GRADE_BG_COLORS.C;

  if (size === "lg") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-full border-4",
          "h-36 w-36 shadow-md",
          colors,
        )}
      >
        <span className="text-4xl font-bold tabular-nums leading-none">
          {score}
        </span>
        <span className="text-sm font-medium mt-1 uppercase tracking-wide">
          out of 100
        </span>
        <span className="text-2xl font-bold mt-1 leading-none">{grade}</span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-base font-medium",
        colors,
      )}
    >
      <span className="tabular-nums">{score}</span>
      <span className="font-bold">{grade}</span>
    </span>
  );
}
