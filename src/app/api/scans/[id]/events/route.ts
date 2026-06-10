import { NextRequest } from "next/server";
import { subscribeScanEvents } from "@/lib/queue/scan-events";

// GET /api/scans/[id]/events - SSE stream for scan progress
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", data: { scanId, message: "Connected" } })}\n\n`)
      );

      // Heartbeat: the audit phase can run for tens of seconds without emitting
      // any event. A periodic SSE comment keeps the connection warm so a proxy
      // or browser idle timeout doesn't trip onerror and flash "Connection
      // lost" mid-scan. Comment lines (": ...") are ignored by EventSource.
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // Stream already closed
        }
      }, 15000);

      unsubscribe = subscribeScanEvents(scanId, (event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );

          // Close stream on completion or error
          if (event.type === "completed" || event.type === "error") {
            setTimeout(() => {
              try {
                if (heartbeat) clearInterval(heartbeat);
                controller.close();
              } catch {
                // Stream may already be closed
              }
            }, 100);
          }
        } catch {
          // Client disconnected
          if (heartbeat) clearInterval(heartbeat);
          unsubscribe?.();
        }
      });
    },
    cancel() {
      // Client disconnected (tab close / navigation). Stop the heartbeat and
      // release the Redis subscription so it doesn't leak.
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
