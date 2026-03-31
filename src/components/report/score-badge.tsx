import { cn } from "@/lib/utils";
import type { Grade } from "@/lib/types";

const gradeColors: Record<string, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  D: "bg-orange-100 text-orange-800 border-orange-200",
  F: "bg-red-100 text-red-800 border-red-200",
};

interface ScoreBadgeProps {
  score: number;
  grade: Grade;
  size?: "sm" | "lg";
}

export function ScoreBadge({ score, grade, size = "sm" }: ScoreBadgeProps) {
  const colors = gradeColors[grade] ?? gradeColors.C;

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
        <span className="text-xs font-medium mt-1 uppercase tracking-wide">
          out of 100
        </span>
        <span className="text-2xl font-bold mt-1 leading-none">{grade}</span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium",
        colors,
      )}
    >
      <span className="tabular-nums">{score}</span>
      <span className="font-bold">{grade}</span>
    </span>
  );
}
