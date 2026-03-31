"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { useScanProgress } from "@/hooks/use-scan-progress";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanProgressProps {
  scanId: string;
  viewportNames: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanProgress({ scanId, viewportNames }: ScanProgressProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const { events, latestEvent, isConnected, isComplete, progress } =
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

  // Derive completed viewports from events
  const completedViewports = new Set(
    events
      .filter((e) => e.type === "viewport_complete" && e.data.viewport)
      .map((e) => e.data.viewport!),
  );

  const failed = latestEvent?.type === "error";

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isComplete ? (
              failed ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              )
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {isComplete
              ? failed
                ? "Scan Failed"
                : "Scan Complete"
              : "Scanning..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress}>
            <span className="text-sm font-medium tabular-nums">
              {Math.round(progress)}%
            </span>
          </Progress>

          {latestEvent && (
            <p className="text-sm text-muted-foreground">
              {latestEvent.data.message}
            </p>
          )}

          {!isConnected && !isComplete && (
            <p className="text-sm text-amber-600">
              Connection lost. Attempting to reconnect...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Viewport Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Viewports</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {viewportNames.map((name) => {
              const done = completedViewports.has(name);
              return (
                <li key={name} className="flex items-center gap-2 text-sm">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : isComplete ? (
                    failed ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={
                      done || (isComplete && !failed)
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {name}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Status Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Waiting for events...
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {events.map((event, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-sm",
                    event.type === "error"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {event.data.message}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Cancel Button */}
      {!isComplete && (
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isCancelling}
          className="w-full"
        >
          <Ban className="h-4 w-4 mr-1" />
          {isCancelling ? "Cancelling..." : "Cancel Scan"}
        </Button>
      )}

      {/* View Report Link */}
      {isComplete && !failed && (
        <Link
          href={`/scan/${scanId}`}
          className={cn(buttonVariants({ variant: "default", size: "lg" }), "w-full")}
        >
          View Report
          <ArrowRight className="h-4 w-4 ml-2" />
        </Link>
      )}
    </div>
  );
}
