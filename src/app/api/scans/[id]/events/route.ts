import { NextRequest } from "next/server";
import { subscribeScanEvents } from "@/lib/queue/scan-events";

// GET /api/scans/[id]/events - SSE stream for scan progress
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: scanId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", data: { scanId, message: "Connected" } })}\n\n`)
      );

      const unsubscribe = subscribeScanEvents(scanId, (event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );

          // Close stream on completion or error
          if (event.type === "completed" || event.type === "error") {
            setTimeout(() => {
              try {
                controller.close();
              } catch {
                // Stream may already be closed
              }
            }, 100);
          }
        } catch {
          // Client disconnected
          unsubscribe();
        }
      });

      // Clean up when client disconnects (handled via AbortSignal in practice)
      // The stream will be garbage collected when the client disconnects
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
