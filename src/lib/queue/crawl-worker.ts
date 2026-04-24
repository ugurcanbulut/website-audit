import { createRedisConnection } from "./connection";
import type { CrawlJobData } from "./crawl-queue";

const CRAWL_JOB_TIMEOUT_MS = Number(
  process.env.CRAWL_JOB_TIMEOUT_MS || 30 * 60 * 1000,
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
          () => reject(new Error(`${label} exceeded ${timeoutMs}ms timeout`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let workerInstance: import("bullmq").Worker<CrawlJobData> | null = null;

export async function startCrawlWorker(): Promise<void> {
  if (workerInstance) return;

  const { Worker } = await import(/* webpackIgnore: true */ "bullmq");
  const connection = await createRedisConnection();

  workerInstance = new Worker<CrawlJobData>(
    "crawl",
    async (job) => {
      console.log(`Processing crawl job: ${job.data.crawlId}`);
      await withTimeout(
        async () => {
          const { runCrawl } = await import("@/lib/crawler/crawler");
          await runCrawl(job.data.crawlId);
        },
        CRAWL_JOB_TIMEOUT_MS,
        `crawl job ${job.id}`,
      );
      console.log(`Completed crawl job: ${job.data.crawlId}`);
    },
    {
      connection,
      concurrency: Number(process.env.CRAWL_WORKER_CONCURRENCY || 1),
    },
  );

  workerInstance.on("failed", (job, err) => {
    console.error(`Crawl job ${job?.id} failed:`, err.message);
  });
}
