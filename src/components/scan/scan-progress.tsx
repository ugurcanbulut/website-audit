"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  ScanSearch,
  XCircle,
  Zap,
} from "lucide-react";
import { useScanProgress } from "@/hooks/use-scan-progress";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanProgressProps {
  scanId: string;
  url?: string;
  viewportNames: string[];
}

// ---------------------------------------------------------------------------
// Status badge (Direction D)
// ---------------------------------------------------------------------------

function StatusBadge({ state }: { state: "scanning" | "completed" | "failed" }) {
  if (state === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 py-1 pl-2 pr-2.5 text-xs font-bold text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        Completed
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 py-1 pl-2 pr-2.5 text-xs font-bold text-destructive">
        <XCircle className="size-3.5" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-soft)] py-1 pl-2 pr-2.5 text-xs font-bold text-primary">
      <Clock className="size-3.5 animate-spin [animation-duration:1.4s]" />
      Scanning
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanProgress({ scanId, url, viewportNames }: ScanProgressProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const { events, latestEvent, isConnected, isComplete, progress, completedViewports } =
    useScanProgress(scanId);

  async function handleCancel() {
    setIsCancelling(true);
    try {
      await fetch(`/api/scans/${scanId}/cancel`, { method: "POST" });
      router.push("/");
    } finally {
      setIsCancelling(false);
    }
  }

  const failed = latestEvent?.type === "error";
  const done = isComplete && !failed;
  const pct = Math.round(progress);
  const state = failed ? "failed" : done ? "completed" : "scanning";

  // While running, the first not-yet-captured viewport is the active one.
  const activeViewport = !isComplete
    ? viewportNames.find((name) => !completedViewports.has(name))
    : undefined;

  return (
    <div className="space-y-4">
      {/* Main progress card */}
      <Card className="gap-0 rounded-2xl p-6 shadow-none">
        <div className="mb-[18px] flex items-center gap-3.5">
          <div
            className={cn(
              "flex size-[52px] shrink-0 items-center justify-center rounded-[14px]",
              failed
                ? "bg-red-50"
                : done
                  ? "bg-emerald-50"
                  : "bg-[var(--brand-soft)]",
            )}
          >
            {failed ? (
              <XCircle className="size-[26px] text-destructive" />
            ) : done ? (
              <CheckCircle2 className="size-[26px] text-emerald-600" />
            ) : (
              <ScanSearch className="size-[26px] animate-spin text-primary [animation-duration:2s]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] leading-none tracking-[-0.02em]">
                {failed ? "Scan failed" : done ? "Scan complete" : "Scanning…"}
              </h1>
              <StatusBadge state={state} />
            </div>
            {url && (
              <p className="mt-1.5 truncate font-mono text-[13.5px] text-muted-foreground">
                {url}
              </p>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 text-[38px] font-extrabold leading-none tabular-nums",
              failed
                ? "text-destructive"
                : done
                  ? "text-emerald-600"
                  : "text-primary",
            )}
          >
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              failed ? "bg-destructive" : done ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Current stage */}
        {latestEvent && (
          <div
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "mt-3 flex min-w-0 items-center gap-2 text-[13px]",
              failed ? "text-destructive" : "text-[var(--ink-2)]",
            )}
          >
            {!isComplete && <Zap className="size-3.5 shrink-0 text-primary" />}
            <span className="truncate">{latestEvent.data.message}</span>
          </div>
        )}

        {!isConnected && !isComplete && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-amber-600">
            <Loader2 className="size-3.5 animate-spin" />
            Connection lost. Attempting to reconnect...
          </p>
        )}
      </Card>

      {/* Viewports + activity log */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-0 rounded-2xl px-5 py-[18px] shadow-none">
          <h2 className="text-[15px]">Viewports</h2>
          <ul className="mt-3.5 space-y-2.5">
            {viewportNames.map((name) => {
              const captured = completedViewports.has(name) || done;
              const active = name === activeViewport;
              return (
                <li key={name} className="flex items-center gap-2.5">
                  {captured ? (
                    <CheckCircle2 className="size-[17px] shrink-0 text-emerald-500" />
                  ) : isComplete ? (
                    <XCircle className="size-[17px] shrink-0 text-destructive" />
                  ) : active ? (
                    <Clock className="size-[17px] shrink-0 animate-spin text-primary [animation-duration:2s]" />
                  ) : (
                    <span className="size-[17px] shrink-0 rounded-full border-2 border-border" />
                  )}
                  <span
                    className={cn(
                      "whitespace-nowrap text-[13.5px]",
                      captured || active
                        ? "font-semibold text-foreground"
                        : "font-medium text-[var(--faint)]",
                    )}
                  >
                    {name}
                  </span>
                  {captured && (
                    <span className="ml-auto text-[11.5px] font-bold text-emerald-600">
                      Captured
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="gap-0 rounded-2xl px-5 py-[18px] shadow-none">
          <h2 className="text-[15px]">Activity log</h2>
          {events.length === 0 ? (
            <p className="mt-3.5 flex gap-2 font-mono text-[12.5px] text-muted-foreground">
              <span className="text-[var(--faint)]">›</span>
              Waiting for events…
            </p>
          ) : (
            <ul className="mt-3.5 max-h-[196px] space-y-[7px] overflow-y-auto">
              {events
                .slice()
                .reverse()
                .map((event, i) => (
                  <li
                    key={events.length - 1 - i}
                    className={cn(
                      "flex gap-2 font-mono text-[12.5px]",
                      event.type === "error"
                        ? "text-destructive"
                        : i === 0
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    <span className="shrink-0 text-[var(--faint)]">›</span>
                    <span className="break-words">{event.data.message}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Cancel Button */}
      {!isComplete && (
        <Button
          variant="outline"
          size="lg"
          onClick={handleCancel}
          disabled={isCancelling}
          className="w-full font-bold"
        >
          <Ban className="size-4" />
          {isCancelling ? "Cancelling..." : "Cancel Scan"}
        </Button>
      )}

      {/* View Report Link */}
      {done && (
        <Link
          href={`/scan/${scanId}`}
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "w-full font-bold",
          )}
        >
          View Report
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
