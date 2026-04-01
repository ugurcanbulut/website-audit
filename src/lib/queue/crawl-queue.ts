import { getRedisConnection } from "./connection";
import type { CrawlConfig } from "@/lib/crawler/types";

export interface CrawlJobData {
  crawlId: string;
}

let crawlQueue: import("bullmq").Queue<CrawlJobData> | null = null;

export async function getCrawlQueue(): Promise<import("bullmq").Queue<CrawlJobData>> {
  if (!crawlQueue) {
    const { Queue } = await import(/* webpackIgnore: true */ "bullmq");
    const connection = await getRedisConnection();
    crawlQueue = new Queue<CrawlJobData>("crawl", {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    });
  }
  return crawlQueue;
}

export async function addCrawlJob(crawlId: string): Promise<void> {
  const queue = await getCrawlQueue();
  await queue.add("crawl-site", { crawlId }, { jobId: crawlId });
}
