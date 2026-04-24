import { and, eq, isNull, lt, sql } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs/promises";
import { createRedisConnection } from "./connection";
import type { RetentionJobData } from "./retention-queue";
import { db } from "@/lib/db";
import { scans, crawls, workspaces } from "@/lib/db/schema";

const DEFAULT_RETENTION_DAYS = Number(
  process.env.DEFAULT_RETENTION_DAYS || 90,
);
const SCREENSHOTS_DIR =
  process.env.SCREENSHOTS_DIR || "./public/screenshots";

/**
 * Delete scans and crawls older than their workspace's retention_days setting.
 * Single-tenant rows (workspace_id NULL) use DEFAULT_RETENTION_DAYS.
 * The orphan screenshot cleanup below removes on-disk files for scans that no
 * longer exist in the DB.
 */
async function runRetention(): Promise<void> {
  const started = Date.now();

  // Delete scans per-workspace using the workspace's retention_days.
  const workspaceRows = await db.query.workspaces.findMany();
  let deletedScans = 0;
  let deletedCrawls = 0;

  for (const ws of workspaceRows) {
    const cutoff = new Date(Date.now() - ws.retentionDays * 86400 * 1000);
    const scanResult = await db
      .delete(scans)
      .where(
        and(
          eq(scans.workspaceId, ws.id),
          lt(scans.createdAt, cutoff),
        ),
      );
    deletedScans += scanResult.count ?? 0;

    const crawlResult = await db
      .delete(crawls)
      .where(
        and(
          eq(crawls.workspaceId, ws.id),
          lt(crawls.createdAt, cutoff),
        ),
      );
    deletedCrawls += crawlResult.count ?? 0;
  }

  // Single-tenant legacy rows (no workspace_id): use the default window.
  {
    const cutoff = new Date(
      Date.now() - DEFAULT_RETENTION_DAYS * 86400 * 1000,
    );
    const scanResult = await db
      .delete(scans)
      .where(
        and(isNull(scans.workspaceId), lt(scans.createdAt, cutoff)),
      );
    deletedScans += scanResult.count ?? 0;

    const crawlResult = await db
      .delete(crawls)
      .where(
        and(isNull(crawls.workspaceId), lt(crawls.createdAt, cutoff)),
      );
    deletedCrawls += crawlResult.count ?? 0;
  }

  // Orphan screenshot directories — any directory under SCREENSHOTS_DIR whose
  // name is a UUID that no longer maps to a scan row.
  let deletedScreenshotDirs = 0;
  try {
    const entries = await fs.readdir(SCREENSHOTS_DIR, { withFileTypes: true });
    const scanDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    if (scanDirs.length > 0) {
      const rows = await db
        .select({ id: scans.id })
        .from(scans)
        .where(sql`${scans.id}::text = ANY(${scanDirs})`);
      const keepIds = new Set(rows.map((r) => r.id));
      for (const dir of scanDirs) {
        if (keepIds.has(dir)) continue;
        // Directories named non-UUID we leave alone; UUID-ish ones without a
        // matching scan are orphans.
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          .test(dir)) {
          continue;
        }
        await fs.rm(path.join(SCREENSHOTS_DIR, dir), {
          recursive: true,
          force: true,
        });
        deletedScreenshotDirs++;
      }
    }
  } catch (e) {
    console.warn(
      "[retention] screenshot cleanup failed:",
      e instanceof Error ? e.message : e,
    );
  }

  console.log(
    `[retention] done in ${Date.now() - started}ms: ` +
      `scans=${deletedScans}, crawls=${deletedCrawls}, ` +
      `orphanDirs=${deletedScreenshotDirs}`,
  );
}

let workerInstance: import("bullmq").Worker<RetentionJobData> | null = null;

export async function startRetentionWorker(): Promise<void> {
  if (workerInstance) return;

  const { Worker } = await import(/* webpackIgnore: true */ "bullmq");
  const connection = await createRedisConnection();

  workerInstance = new Worker<RetentionJobData>(
    "retention",
    async () => {
      console.log("[retention] starting cleanup");
      await runRetention();
    },
    { connection, concurrency: 1 },
  );

  workerInstance.on("failed", (_job, err) => {
    console.error("[retention] job failed:", err.message);
  });
}

