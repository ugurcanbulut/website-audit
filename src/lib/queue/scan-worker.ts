import { eq } from "drizzle-orm";
import { createRedisConnection } from "./connection";
import type { ScanJobData } from "./scan-queue";
import { db } from "@/lib/db";
import {
  scans,
  viewportResults,
  viewportResultBlobs,
  auditIssues,
  categoryScores,
} from "@/lib/db/schema";
import { captureViewport } from "@/lib/scanner/capture";
import { launchBrowser, closeBrowser } from "@/lib/scanner/browser";
import { publishScanEvent } from "@/lib/queue/scan-events";
import type { DevicePreset, BrowserEngine } from "@/lib/types";

async function processScanJob(data: ScanJobData): Promise<void> {
  const { scanId, url, aiEnabled, aiProvider } = data;
  const browserEngine: BrowserEngine = data.browserEngine ?? "chromium";

  // Resolve devices: use new device presets if available, fall back to legacy viewports
  let devices: DevicePreset[];
  if (data.devices && data.devices.length > 0) {
    devices = data.devices;
  } else {
    // Legacy: convert ViewportConfig to DevicePreset
    devices = data.viewports.map((v) => ({
      name: v.name,
      width: v.width,
      height: v.height,
      type: v.type,
    }));
  }

  const session = await launchBrowser(browserEngine);
  let browserClosed = false;
  const closeSessionOnce = async () => {
    if (browserClosed) return;
    browserClosed = true;
    await closeBrowser(session);
  };

  try {
    // Idempotency: on retry, clear any prior per-scan rows so this run starts
    // clean. Cascading deletes on viewport_results -> audit_issues are implicit
    // via FK, but we also drop audit_issues bound only by scan_id (e.g. AI
    // issues with null viewport_result_id) and category_scores explicitly.
    await db.delete(auditIssues).where(eq(auditIssues.scanId, scanId));
    await db.delete(categoryScores).where(eq(categoryScores.scanId, scanId));
    await db.delete(viewportResults).where(eq(viewportResults.scanId, scanId));

    // Reset scan row for a clean retry.
    await db
      .update(scans)
      .set({
        status: "scanning",
        overallScore: null,
        overallGrade: null,
        error: null,
        completedAt: null,
      })
      .where(eq(scans.id, scanId));
    publishScanEvent(scanId, {
      type: "status",
      data: { scanId, message: "Starting scan...", progress: 0 },
    });

    // Capture each device viewport
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      const isFirst = i === 0;

      publishScanEvent(scanId, {
        type: "status",
        data: {
          scanId,
          message: `Scanning ${device.name} (${device.width}x${device.height})...`,
          progress: Math.round((i / devices.length) * 35),
          viewport: device.name,
        },
      });

      const result = await captureViewport(url, device, scanId, session, {
        captureHtmlCss: isFirst,  // Only capture HTML/CSS for first viewport
      });

      // Save viewport result — hot row first, then the heavy blobs in the
      // sibling table. Split keeps viewport_results <1KB for fast list queries.
      const [insertedViewport] = await db
        .insert(viewportResults)
        .values({
          scanId,
          viewportName: device.name,
          width: device.width,
          height: device.height,
          screenshotPath: result.screenshotPath,
          viewportScreenshotPath: result.viewportScreenshotPath ?? null,
          performanceMetrics: result.performanceMetrics,
          deviceName: device.name,
          responseHeaders: result.responseHeaders ?? null,
          screenshotWidth: result.screenshotWidth ?? null,
          screenshotHeight: result.screenshotHeight ?? null,
        })
        .returning({ id: viewportResults.id });

      const hasBlobs =
        !!result.domSnapshot ||
        !!result.axeResults ||
        !!result.pageHtml ||
        !!result.pageCss;
      if (hasBlobs) {
        await db.insert(viewportResultBlobs).values({
          viewportResultId: insertedViewport.id,
          domSnapshot: result.domSnapshot ?? null,
          axeResults: result.axeResults ?? null,
          pageHtml: result.pageHtml ?? null,
          pageCss: result.pageCss ?? null,
        });
      }

      publishScanEvent(scanId, {
        type: "viewport_complete",
        data: {
          scanId,
          message: `Completed ${device.name}`,
          progress: Math.round(((i + 1) / devices.length) * 35),
          viewport: device.name,
        },
      });
    }

    // Run audit engine WITH browser session (Lighthouse needs live browser)
    await db.update(scans).set({ status: "auditing" }).where(eq(scans.id, scanId));
    publishScanEvent(scanId, {
      type: "status",
      data: { scanId, message: "Running audit engine...", progress: 35 },
    });

    const { runAuditEngine } = await import("@/lib/audit/engine");
    const auditResult = await runAuditEngine(scanId, url, session);

    publishScanEvent(scanId, {
      type: "audit_progress",
      data: { scanId, message: "Audit engine completed", progress: 65 },
    });

    // NOW close browser (Lighthouse is done)
    await closeSessionOnce();

    // Run AI analysis if enabled (no browser needed) -- non-fatal
    if (aiEnabled && aiProvider) {
      await db.update(scans).set({ status: "analyzing" }).where(eq(scans.id, scanId));
      publishScanEvent(scanId, {
        type: "ai_progress",
        data: { scanId, message: `Running AI analysis with ${aiProvider}...`, progress: 70 },
      });

      try {
        const { runAiAnalysis } = await import("@/lib/ai/provider");
        await runAiAnalysis(scanId, aiProvider);
        publishScanEvent(scanId, {
          type: "ai_progress",
          data: { scanId, message: "AI analysis completed", progress: 85 },
        });
      } catch (aiError) {
        const aiMsg = aiError instanceof Error ? aiError.message : "Unknown AI error";
        console.warn(`AI analysis failed (non-fatal): ${aiMsg}`);
        publishScanEvent(scanId, {
          type: "ai_progress",
          data: { scanId, message: `AI analysis skipped: ${aiMsg}`, progress: 85 },
        });
      }
    }

    // Calculate scores
    publishScanEvent(scanId, {
      type: "score_calculated",
      data: { scanId, message: "Calculating scores...", progress: 90 },
    });

    const { calculateScores } = await import("@/lib/audit/scoring");
    await calculateScores(scanId, auditResult.lighthouseScores);

    // Mark as completed
    await db.update(scans).set({ status: "completed", completedAt: new Date() }).where(eq(scans.id, scanId));
    publishScanEvent(scanId, {
      type: "completed",
      data: { scanId, message: "Scan completed!", progress: 100 },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    await db.update(scans).set({ status: "failed", error: errorMessage }).where(eq(scans.id, scanId));
    publishScanEvent(scanId, {
      type: "error",
      data: { scanId, message: `Scan failed: ${errorMessage}`, progress: 0 },
    });
    throw error;
  } finally {
    await closeSessionOnce();
  }
}

// Hard ceiling on a single scan. If captures or Lighthouse runs hang for more
// than this, kill the job so the worker frees up for the next one.
const SCAN_JOB_TIMEOUT_MS = Number(
  process.env.SCAN_JOB_TIMEOUT_MS || 10 * 60 * 1000,
);

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`${label} exceeded ${timeoutMs}ms timeout`),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
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
      await withTimeout(
        () => processScanJob(job.data),
        SCAN_JOB_TIMEOUT_MS,
        `scan job ${job.id}`,
      );
      console.log(`Completed scan job: ${job.id}`);
    },
    {
      connection,
      concurrency: Number(process.env.SCAN_WORKER_CONCURRENCY || 1),
    }
  );

  workerInstance.on("failed", (job, err) => {
    console.error(`Scan job ${job?.id} failed:`, err.message);
  });
}
