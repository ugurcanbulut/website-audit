import { createRedisConnection } from "./connection";
import type { CrawlJobData } from "./crawl-queue";

let workerInstance: import("bullmq").Worker<CrawlJobData> | null = null;

export async function startCrawlWorker(): Promise<void> {
  if (workerInstance) return;

  const { Worker } = await import(/* webpackIgnore: true */ "bullmq");
  const connection = await createRedisConnection();

  workerInstance = new Worker<CrawlJobData>(
    "crawl",
    async (job) => {
      console.log(`Processing crawl job: ${job.data.crawlId}`);
      const { runCrawl } = await import("@/lib/crawler/crawler");
      await runCrawl(job.data.crawlId);
      console.log(`Completed crawl job: ${job.data.crawlId}`);
    },
    {
      connection,
      concurrency: 1,
    }
  );

  workerInstance.on("failed", (job, err) => {
    console.error(`Crawl job ${job?.id} failed:`, err.message);
  });
}
