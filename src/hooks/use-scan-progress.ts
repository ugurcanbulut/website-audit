"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanEvent } from "@/lib/types";

interface UseScanProgressReturn {
  events: ScanEvent[];
  latestEvent: ScanEvent | null;
  isConnected: boolean;
  isComplete: boolean;
  progress: number;
}

export function useScanProgress(scanId: string): UseScanProgressReturn {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<ScanEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!scanId) return;

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
      // EventSource will attempt to reconnect automatically.
      // If the server closed the stream, the readyState will be CLOSED.
      if (es.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [scanId]);

  return { events, latestEvent, isConnected, isComplete, progress };
}
