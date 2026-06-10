import { cn } from "@/lib/utils";
import { GRADE_BG_COLORS, getGradeFromScore } from "@/lib/ui-constants";

// Compact rounded-square grade chip (Direction D). Pass a grade directly or
// derive it from a 0-100 score.
export function GradeChip({
  score,
  grade,
  size = 24,
  className,
}: {
  score?: number;
  grade?: string;
  size?: number;
  className?: string;
}) {
  const g = grade ?? (score !== null && score !== undefined ? getGradeFromScore(score) : null);
  if (!g) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border-0 font-extrabold",
        GRADE_BG_COLORS[g] ?? GRADE_BG_COLORS.C,
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.29),
        fontSize: Math.round(size * 0.54),
      }}
    >
      {g}
    </span>
  );
}
