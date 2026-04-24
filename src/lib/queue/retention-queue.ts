import { getRedisConnection } from "./connection";

export interface RetentionJobData {
  // No per-run params — the job reads workspace.retention_days dynamically.
  triggered: "scheduled" | "manual";
}

let retentionQueue: import("bullmq").Queue<RetentionJobData> | null = null;

export async function getRetentionQueue(): Promise<
  import("bullmq").Queue<RetentionJobData>
> {
  if (!retentionQueue) {
    const { Queue } = await import(/* webpackIgnore: true */ "bullmq");
    const connection = await getRedisConnection();
    retentionQueue = new Queue<RetentionJobData>("retention", {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 30 },
      },
    });
  }
  return retentionQueue;
}

/**
 * Schedule the daily retention cleanup if it is not already scheduled.
 * Idempotent — BullMQ rejects repeat registrations with the same jobId.
 */
export async function scheduleRetentionJob(): Promise<void> {
  const queue = await getRetentionQueue();
  try {
    await queue.add(
      "retention-daily",
      { triggered: "scheduled" },
      {
        jobId: "retention-daily",
        repeat: { pattern: "0 3 * * *" }, // 03:00 UTC daily
      },
    );
  } catch {
    // Already scheduled or Redis hiccup — silent; next call will retry.
  }
}

export async function addRetentionJob(): Promise<void> {
  const queue = await getRetentionQueue();
  await queue.add("retention-manual", { triggered: "manual" });
}
