import { eq } from "drizzle-orm";
import { createRedisConnection } from "./connection";
import type { ScanJobData } from "./scan-queue";
import { db } from "@/lib/db";
import { scans, viewportResults } from "@/lib/db/schema";
import { captureViewport } from "@/lib/scanner/capture";
import { closeBrowser } from "@/lib/scanner/browser";
import { publishScanEvent } from "@/lib/queue/scan-events";

async function processScanJob(data: ScanJobData): Promise<void> {
  const { scanId, url, viewports, aiEnabled, aiProvider } = data;

  try {
    await db
      .update(scans)
      .set({ status: "scanning" })
      .where(eq(scans.id, scanId));

    publishScanEvent(scanId, {
      type: "status",
      data: { scanId, message: "Starting scan...", progress: 0 },
    });

    for (let i = 0; i < viewports.length; i++) {
      const viewport = viewports[i];

      publishScanEvent(scanId, {
        type: "status",
        data: {
          scanId,
          message: `Scanning ${viewport.name} (${viewport.width}x${viewport.height})...`,
          progress: Math.round((i / viewports.length) * 40),
          viewport: viewport.name,
        },
      });

      const result = await captureViewport(url, viewport, scanId);

      await db.insert(viewportResults).values({
        scanId,
        viewportName: viewport.name,
        width: viewport.width,
        height: viewport.height,
        screenshotPath: result.screenshotPath,
        domSnapshot: result.domSnapshot,
        performanceMetrics: result.performanceMetrics,
      });

      publishScanEvent(scanId, {
        type: "viewport_complete",
        data: {
          scanId,
          message: `Completed ${viewport.name}`,
          progress: Math.round(((i + 1) / viewports.length) * 40),
          viewport: viewport.name,
        },
      });
    }

    await db
      .update(scans)
      .set({ status: "auditing" })
      .where(eq(scans.id, scanId));

    publishScanEvent(scanId, {
      type: "status",
      data: { scanId, message: "Running audit rules...", progress: 40 },
    });

    const { runAuditEngine } = await import("@/lib/audit/engine");
    await runAuditEngine(scanId);

    publishScanEvent(scanId, {
      type: "audit_progress",
      data: { scanId, message: "Audit rules completed", progress: 70 },
    });

    if (aiEnabled && aiProvider) {
      await db
        .update(scans)
        .set({ status: "analyzing" })
        .where(eq(scans.id, scanId));

      publishScanEvent(scanId, {
        type: "ai_progress",
        data: {
          scanId,
          message: `Running AI analysis with ${aiProvider}...`,
          progress: 75,
        },
      });

      const { runAiAnalysis } = await import("@/lib/ai/provider");
      await runAiAnalysis(scanId, aiProvider);

      publishScanEvent(scanId, {
        type: "ai_progress",
        data: { scanId, message: "AI analysis completed", progress: 90 },
      });
    }

    publishScanEvent(scanId, {
      type: "score_calculated",
      data: { scanId, message: "Calculating scores...", progress: 95 },
    });

    const { calculateScores } = await import("@/lib/audit/scoring");
    await calculateScores(scanId);

    await db
      .update(scans)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(scans.id, scanId));

    publishScanEvent(scanId, {
      type: "completed",
      data: { scanId, message: "Scan completed!", progress: 100 },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    await db
      .update(scans)
      .set({ status: "failed", error: errorMessage })
      .where(eq(scans.id, scanId));

    publishScanEvent(scanId, {
      type: "error",
      data: { scanId, message: `Scan failed: ${errorMessage}`, progress: 0 },
    });

    throw error;
  } finally {
    await closeBrowser();
  }
}

let workerInstance: import("bullmq").Worker<ScanJobData> | null = null;

export async function startScanWorker(): Promise<void> {
  if (workerInstance) return;

  const { Worker } = await import(/* webpackIgnore: true */ "bullmq");
  const connection = await createRedisConnection();

  workerInstance = new Worker<ScanJobData>(
    "scan",
    async (job) => {
      console.log(`Processing scan job: ${job.id}`);
      await processScanJob(job.data);
      console.log(`Completed scan job: ${job.id}`);
    },
    {
      connection,
      concurrency: 1,
    }
  );

  workerInstance.on("failed", (job, err) => {
    console.error(`Scan job ${job?.id} failed:`, err.message);
  });
}
