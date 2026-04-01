import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { scanBatches, scans } from "@/lib/db/schema";
import { addScanJob } from "@/lib/queue/scan-queue";
import { getDevicesByNames, DEFAULT_DEVICES } from "@/lib/scanner/devices";
import { startScanWorker } from "@/lib/queue/scan-worker";

let workerStarted = false;
async function ensureWorker() {
  if (!workerStarted) {
    await startScanWorker();
    workerStarted = true;
  }
}

const createBatchSchema = z.object({
  urls: z.array(z.string().url()).min(1, "At least one URL required").max(50, "Maximum 50 URLs"),
  name: z.string().optional(),
  devices: z.array(z.string()).optional(),
  browserEngine: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
  aiEnabled: z.boolean().default(false),
  aiProvider: z.enum(["claude", "openai"]).optional(),
});

// GET /api/batches
export async function GET() {
  const batches = await db.query.scanBatches.findMany({
    orderBy: [desc(scanBatches.createdAt)],
    limit: 50,
  });
  return NextResponse.json(batches);
}

// POST /api/batches
export async function POST(request: NextRequest) {
  await ensureWorker();

  const body = await request.json();
  const parsed = createBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { urls, name, devices: deviceNames, browserEngine, aiEnabled, aiProvider } = parsed.data;
  const resolvedDevices = deviceNames ? getDevicesByNames(deviceNames) : getDevicesByNames(DEFAULT_DEVICES);
  const viewportConfigs = resolvedDevices.map(d => ({ name: d.name, width: d.width, height: d.height, type: d.type }));

  // Create batch record
  const [batch] = await db.insert(scanBatches).values({
    name: name || `Batch scan (${urls.length} URLs)`,
    urls,
    totalScans: urls.length,
    browserEngine,
    viewports: viewportConfigs,
    aiEnabled,
    aiProvider: aiEnabled ? aiProvider : null,
  }).returning();

  // Create individual scan records and queue jobs
  for (const url of urls) {
    const [scan] = await db.insert(scans).values({
      url,
      batchId: batch.id,
      viewports: viewportConfigs,
      browserEngine,
      aiEnabled,
      aiProvider: aiEnabled ? aiProvider : null,
    }).returning();

    await addScanJob({
      scanId: scan.id,
      url,
      viewports: viewportConfigs,
      devices: resolvedDevices,
      browserEngine,
      aiEnabled,
      aiProvider,
    });
  }

  return NextResponse.json(batch, { status: 201 });
}
