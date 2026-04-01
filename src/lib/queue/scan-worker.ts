import { eq } from "drizzle-orm";
import { createRedisConnection } from "./connection";
import type { ScanJobData } from "./scan-queue";
import { db } from "@/lib/db";
import { scans, viewportResults } from "@/lib/db/schema";
import { captureViewport } from "@/lib/scanner/capture";
import { launchBrowser, closeBrowser } from "@/lib/scanner/browser";
import { publishScanEvent } from "@/lib/queue/scan-events";
import { getDevicesByNames } from "@/lib/scanner/devices";
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

  try {
    // Update status to scanning
    await db.update(scans).set({ status: "scanning" }).where(eq(scans.id, scanId));
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

      // Save viewport result with expanded data
      await db.insert(viewportResults).values({
        scanId,
        viewportName: device.name,
        width: device.width,
        height: device.height,
        screenshotPath: result.screenshotPath,
        domSnapshot: result.domSnapshot,
        performanceMetrics: result.performanceMetrics,
        deviceName: device.name,
        axeResults: result.axeResults ?? null,
        responseHeaders: result.responseHeaders ?? null,
        pageHtml: result.pageHtml ?? null,
        pageCss: result.pageCss ?? null,
        screenshotWidth: result.screenshotWidth ?? null,
        screenshotHeight: result.screenshotHeight ?? null,
      });

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
    await runAuditEngine(scanId, url, session);

    publishScanEvent(scanId, {
      type: "audit_progress",
      data: { scanId, message: "Audit engine completed", progress: 65 },
    });

    // NOW close browser (Lighthouse is done)
    await closeBrowser(session);

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
    await calculateScores(scanId);

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
    await closeBrowser(session);
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
