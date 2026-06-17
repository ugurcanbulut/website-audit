"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, RotateCcw, EyeOff } from "lucide-react";
import type { Finding } from "@/lib/audit/findings";
import { CATEGORY_LABELS } from "@/lib/ui-constants";
import { unsuppressFinding } from "@/app/scan/[id]/actions";
import { cn } from "@/lib/utils";

/**
 * Collapsible list of findings suppressed on this scan, with a Restore action.
 * Internal-view only (clients never see suppressed items). Suppressed findings
 * are excluded from the score, so this is also where you undo that.
 */
export function SuppressedFindings({
  scanId,
  findings,
}: {
  scanId: string;
  findings: Finding[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (findings.length === 0) return null;
  const totalElements = findings.reduce((n, f) => n + f.count, 0);

  return (
    <div className="rounded-lg border border-dashed">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <EyeOff className="size-4 shrink-0" />
        Suppressed findings ({findings.length}) · {totalElements} element
        {totalElements === 1 ? "" : "s"} excluded from the score
      </button>

      {open && (
        <ul className="divide-y border-t">
          {findings.map((f) => (
            <li
              key={f.ruleId}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{f.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[f.category] ?? f.category} · {f.count} element
                  {f.count === 1 ? "" : "s"}
                </span>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(() => unsuppressFinding(scanId, f.ruleId, null))
                }
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 text-sm text-primary hover:underline disabled:opacity-50",
                )}
              >
                <RotateCcw className="size-3.5" />
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
