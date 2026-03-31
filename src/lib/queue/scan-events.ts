import type { ScanEvent } from "@/lib/types";

type EventListener = (event: ScanEvent) => void;

// In-memory pub/sub for SSE events within the same process
const listeners = new Map<string, Set<EventListener>>();

export function subscribeScanEvents(
  scanId: string,
  listener: EventListener
): () => void {
  if (!listeners.has(scanId)) {
    listeners.set(scanId, new Set());
  }
  listeners.get(scanId)!.add(listener);

  // Return unsubscribe function
  return () => {
    const set = listeners.get(scanId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        listeners.delete(scanId);
      }
    }
  };
}

export function publishScanEvent(scanId: string, event: ScanEvent): void {
  const set = listeners.get(scanId);
  if (set) {
    for (const listener of set) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}
