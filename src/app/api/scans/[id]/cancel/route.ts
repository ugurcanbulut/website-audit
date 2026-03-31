import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import { getScanQueue } from "@/lib/queue/scan-queue";

// POST /api/scans/[id]/cancel
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const scan = await db.query.scans.findFirst({
    where: eq(scans.id, id),
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  // Only cancel if in progress
  if (!["pending", "scanning", "auditing", "analyzing"].includes(scan.status)) {
    return NextResponse.json(
      { error: "Scan is not in progress" },
      { status: 400 }
    );
  }

  // Try to remove from queue
  try {
    const queue = await getScanQueue();
    const job = await queue.getJob(id);
    if (job) {
      await job.remove();
    }
  } catch {
    // Job may already be processing
  }

  // Update status to cancelled
  await db
    .update(scans)
    .set({ status: "cancelled", error: "Scan cancelled by user" })
    .where(eq(scans.id, id));

  return NextResponse.json({ status: "cancelled" });
}
