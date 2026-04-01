"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanEvent } from "@/lib/types";

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

  return { events, latestEvent, isConnected, isComplete, progress, completedViewports };
}
