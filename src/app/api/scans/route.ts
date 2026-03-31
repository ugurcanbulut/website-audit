import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import { addScanJob } from "@/lib/queue/scan-queue";
import { getViewportsByNames, DEFAULT_VIEWPORTS } from "@/lib/scanner/viewports";
import { startScanWorker } from "@/lib/queue/scan-worker";

// Ensure worker is started when API is used
let workerStarted = false;
async function ensureWorker() {
  if (!workerStarted) {
    await startScanWorker();
    workerStarted = true;
  }
}

const createScanSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  viewports: z.array(z.string()).min(1, "Select at least one viewport").default(DEFAULT_VIEWPORTS),
  aiEnabled: z.boolean().default(false),
  aiProvider: z.enum(["claude", "openai"]).optional(),
});

// GET /api/scans - List all scans
export async function GET() {
  const allScans = await db.query.scans.findMany({
    orderBy: [desc(scans.createdAt)],
    limit: 50,
  });

  return NextResponse.json(allScans);
}

// POST /api/scans - Create a new scan
export async function POST(request: NextRequest) {
  await ensureWorker();

  const body = await request.json();
  const parsed = createScanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { url, viewports: viewportNames, aiEnabled, aiProvider } = parsed.data;
  const viewports = getViewportsByNames(viewportNames);

  if (viewports.length === 0) {
    return NextResponse.json(
      { error: { viewports: ["No valid viewports selected"] } },
      { status: 400 }
    );
  }

  // Create scan record
  const [scan] = await db
    .insert(scans)
    .values({
      url,
      viewports: viewports,
      aiEnabled,
      aiProvider: aiEnabled ? aiProvider : null,
    })
    .returning();

  // Enqueue scan job
  await addScanJob({
    scanId: scan.id,
    url,
    viewports,
    aiEnabled,
    aiProvider,
  });

  return NextResponse.json(scan, { status: 201 });
}
