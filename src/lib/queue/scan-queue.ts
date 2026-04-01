import { getRedisConnection } from "./connection";
import type { ViewportConfig, AiProvider, DevicePreset, BrowserEngine } from "@/lib/types";

export interface ScanJobData {
  scanId: string;
  url: string;
  viewports: ViewportConfig[];  // Legacy compat
  devices?: DevicePreset[];     // New device presets
  browserEngine?: BrowserEngine;
  aiEnabled: boolean;
  aiProvider?: AiProvider;
}

let scanQueue: import("bullmq").Queue<ScanJobData> | null = null;

export async function getScanQueue(): Promise<import("bullmq").Queue<ScanJobData>> {
  if (!scanQueue) {
    const { Queue } = await import(/* webpackIgnore: true */ "bullmq");
    const connection = await getRedisConnection();
    scanQueue = new Queue<ScanJobData>("scan", {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return scanQueue;
}

export async function addScanJob(data: ScanJobData): Promise<string> {
  const queue = await getScanQueue();
  const job = await queue.add("scan-website", data, {
    jobId: data.scanId,
  });
  return job.id!;
}
