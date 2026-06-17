"use client";

import { useTransition } from "react";
import { EyeOff } from "lucide-react";
import { suppressFinding } from "@/app/scan/[id]/actions";
import { cn } from "@/lib/utils";

/**
 * "Suppress" control on an internal-view finding. Calls the server action,
 * which records the suppression, recomputes the score, and revalidates the
 * report — so the finding disappears and the grade updates on the next render.
 */
export function SuppressButton({
  scanId,
  ruleId,
  elementSelector = null,
  className,
}: {
  scanId: string;
  ruleId: string;
  elementSelector?: string | null;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        startTransition(() => suppressFinding(scanId, ruleId, elementSelector));
      }}
      title="Hide this finding and exclude it from the score"
      className={cn(
        "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      <EyeOff className="size-3.5" />
      {pending ? "Suppressing…" : "Suppress"}
    </button>
  );
}
