import type { ScanEvent } from "@/lib/types";
import { createRedisConnection } from "./connection";

// ─────────────────────────────────────────────────────────────────────────────
// Cross-process scan progress stream backed by Redis pub/sub.
//
// Workers publish events on channel `scan:<scanId>`; the Next.js SSE route
// subscribes per-connection. Redis decouples publisher (any worker process
// in any container) from subscriber (any Next.js instance). Replaces the
// prior in-memory Map<scanId, listeners>, which only worked when worker and
// API lived in the same Node.js process.
//
// Each subscriber uses a dedicated Redis connection because ioredis puts the
// client into pub/sub mode, blocking normal commands on that client.
// ─────────────────────────────────────────────────────────────────────────────

type EventListener = (event: ScanEvent) => void;

const CHANNEL_PREFIX = "scan:";

let publisherPromise:
  | Promise<import("ioredis").Redis>
  | null = null;

async function getPublisher(): Promise<import("ioredis").Redis> {
  if (!publisherPromise) publisherPromise = createRedisConnection();
  return publisherPromise;
}

/**
 * Publish a scan event. Called by workers and API routes after state transitions.
 * Silent on publish failure — never let telemetry break the scan.
 */
export async function publishScanEvent(
  scanId: string,
  event: ScanEvent,
): Promise<void> {
  try {
    const redis = await getPublisher();
    await redis.publish(CHANNEL_PREFIX + scanId, JSON.stringify(event));
  } catch (e) {
    console.warn(
      "Failed to publish scan event:",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Subscribe to a scan's event stream. Returns an unsubscribe function that
 * closes the dedicated Redis client.
 */
export function subscribeScanEvents(
  scanId: string,
  listener: EventListener,
): () => void {
  const channel = CHANNEL_PREFIX + scanId;
  let subscriber: import("ioredis").Redis | null = null;
  let unsubscribed = false;

  (async () => {
    try {
      subscriber = await createRedisConnection();
      if (unsubscribed) {
        await subscriber.quit();
        return;
      }
      await subscriber.subscribe(channel);
      subscriber.on("message", (incomingChannel, message) => {
        if (incomingChannel !== channel) return;
        try {
          const event = JSON.parse(message) as ScanEvent;
          listener(event);
        } catch {
          // Malformed event — drop silently.
        }
      });
    } catch (e) {
      console.warn(
        "Failed to subscribe to scan events:",
        e instanceof Error ? e.message : e,
      );
    }
  })();

  return () => {
    unsubscribed = true;
    if (subscriber) {
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
    }
  };
}
