"use client";

import { useEffect, useRef, useState } from "react";
import type { ScanEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Progress creep
//
// The worker reports real progress at coarse milestones (0 → 35 scanning,
// 35 → 65 audit engine, 65/70 → 85 AI, 90 scoring, 100 done). The 35 → 65 jump
// covers the audit engine — Lighthouse desktop + mobile — which can stall for
// 20-40s with no intermediate signal, so the bar *looks* frozen ("is it
// hung?"). To keep it visibly alive we trickle the displayed value upward
// between real milestones: it eases toward a soft ceiling a little above the
// last real value, decelerating as it approaches, and never overtakes the next
// real milestone or fakes completion. Real events always win — a higher real
// value snaps the display straight up to it.
// ---------------------------------------------------------------------------

const CREEP_INTERVAL_MS = 600; // how often the display advances while waiting
const CREEP_GAP = 18; // most a creep may add above the last real milestone
const CREEP_CEILING = 92; // creep never implies "almost done"
const CREEP_EASE = 0.06; // fraction of the remaining gap closed per tick

interface UseScanProgressReturn {
  events: ScanEvent[];
  latestEvent: ScanEvent | null;
  isConnected: boolean;
  isComplete: boolean;
  progress: number;
  completedViewports: Set<string>;
}

export function useScanProgress(scanId: string): UseScanProgressReturn {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<ScanEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [completedViewports, setCompletedViewports] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate from API on mount to restore state after navigation
  useEffect(() => {
    if (!scanId || hydratedRef.current) return;
    hydratedRef.current = true;

    fetch(`/api/scans/${scanId}`)
      .then((res) => res.json())
      .then((scan) => {
        const status = scan.status;

        // If already completed or failed, mark as done
        if (status === "completed") {
          setIsComplete(true);
          setProgress(100);
          setLatestEvent({
            type: "completed",
            data: { scanId, message: "Scan completed!" },
          });
          // All viewports are done
          if (scan.viewportResults) {
            setCompletedViewports(
              new Set(scan.viewportResults.map((vr: { viewportName: string }) => vr.viewportName))
            );
          }
          return;
        }

        if (status === "failed" || status === "cancelled") {
          setIsComplete(true);
          setProgress(0);
          setLatestEvent({
            type: "error",
            data: { scanId, message: scan.error || `Scan ${status}` },
          });
          return;
        }

        // In progress: estimate progress from status + completed viewports
        if (scan.viewportResults && scan.viewportResults.length > 0) {
          const vpNames = new Set<string>(
            scan.viewportResults.map((vr: { viewportName: string }) => vr.viewportName)
          );
          setCompletedViewports(vpNames);

          // Reconstruct events for completed viewports
          const restoredEvents: ScanEvent[] = scan.viewportResults.map(
            (vr: { viewportName: string }) => ({
              type: "viewport_complete" as const,
              data: { scanId, message: `Completed ${vr.viewportName}`, viewport: vr.viewportName },
            })
          );
          setEvents(restoredEvents);
        }

        // Estimate progress based on status
        const statusProgress: Record<string, number> = {
          pending: 0,
          scanning: 20,
          auditing: 45,
          analyzing: 75,
        };
        const estimated = statusProgress[status] ?? 10;
        setProgress(estimated);
        setLatestEvent({
          type: "status",
          data: { scanId, message: `Status: ${status}`, progress: estimated },
        });
      })
      .catch(() => {
        // API fetch failed, SSE will handle it
      });
  }, [scanId]);

  // Connect SSE for live updates
  useEffect(() => {
    if (!scanId) return;
    if (isComplete) return; // Don't connect if already done

    const es = new EventSource(`/api/scans/${scanId}/events`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const parsed: ScanEvent = JSON.parse(event.data);

        setEvents((prev) => [...prev, parsed]);
        setLatestEvent(parsed);

        if (parsed.data.progress !== undefined) {
          setProgress(parsed.data.progress);
        }

        if (parsed.type === "viewport_complete" && parsed.data.viewport) {
          setCompletedViewports((prev) => {
            const next = new Set(prev);
            next.add(parsed.data.viewport!);
            return next;
          });
        }

        if (parsed.type === "completed") {
          setIsComplete(true);
          setProgress(100);
          es.close();
          eventSourceRef.current = null;
          setIsConnected(false);
        }

        if (parsed.type === "error") {
          setIsComplete(true);
          es.close();
          eventSourceRef.current = null;
          setIsConnected(false);
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      if (es.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [scanId, isComplete]);

  // Between milestones, trickle the creep value upward so a long phase (the
  // audit engine, mainly) doesn't read as frozen. It eases toward a soft
  // ceiling below the next real milestone and pauses once the scan is done.
  useEffect(() => {
    if (isComplete) return;
    const id = setInterval(() => {
      setDisplayProgress((d) => {
        const ceiling = Math.min(progress + CREEP_GAP, CREEP_CEILING);
        if (d >= ceiling) return d;
        const next = d + (ceiling - d) * CREEP_EASE;
        // Settle exactly on the ceiling once we're within a hair of it.
        return next >= ceiling - 0.5 ? ceiling : next;
      });
    }, CREEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [progress, isComplete]);

  // A real milestone always wins — the smoothed bar never lags behind true
  // progress and snaps straight to 100 the moment the scan completes. Both
  // inputs only ever increase, so the displayed value is monotonic.
  return {
    events,
    latestEvent,
    isConnected,
    isComplete,
    progress: Math.max(progress, displayProgress),
    completedViewports,
  };
}
