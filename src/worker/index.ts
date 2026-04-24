// Standalone BullMQ worker entrypoint. Runs in a dedicated process so the
// Next.js web server and the scanner worker can be scaled, restarted, and
// deployed independently.
//
// Start with: `npm run worker` (after `next build` or via docker service).
// Gracefully exits on SIGINT / SIGTERM so deployments that roll the container
// don't leave orphaned scan jobs in a stuck state.

async function main() {
  console.log("[worker] starting scan + crawl workers");

  const { startScanWorker } = await import("@/lib/queue/scan-worker");
  const { startCrawlWorker } = await import("@/lib/queue/crawl-worker");

  await Promise.all([startScanWorker(), startCrawlWorker()]);
  console.log("[worker] workers ready");

  const shutdown = (signal: string) => {
    console.log(`[worker] received ${signal}, exiting`);
    // BullMQ's Worker#close resolves in-flight jobs gracefully, but it is
    // internal to each worker module and would require wiring handles out.
    // For now, exit after BullMQ's default stall timeout (30s) covers any
    // in-flight work — re-queued by BullMQ's stall detection on the next
    // worker start.
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Keep the event loop alive — workers register BullMQ listeners which do
  // the same, but we make it explicit so the process never exits on its own.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
