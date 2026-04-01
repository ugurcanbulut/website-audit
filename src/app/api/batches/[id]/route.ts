import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scanBatches, scans } from "@/lib/db/schema";

// GET /api/batches/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const batch = await db.query.scanBatches.findFirst({
    where: eq(scanBatches.id, id),
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const batchScans = await db.query.scans.findMany({
    where: eq(scans.batchId, id),
  });

  // Calculate batch progress
  const completed = batchScans.filter(s => s.status === "completed").length;
  const failed = batchScans.filter(s => s.status === "failed" || s.status === "cancelled").length;
  const inProgress = batchScans.length - completed - failed;

  // Calculate average score from completed scans
  const completedScores = batchScans
    .filter(s => s.status === "completed" && s.overallScore != null)
    .map(s => s.overallScore!);
  const avgScore = completedScores.length > 0
    ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length)
    : null;

  // Update batch status
  let batchStatus = batch.status;
  if (completed + failed === batchScans.length && batchScans.length > 0) {
    batchStatus = failed === batchScans.length ? "failed" : "completed";
    if (batch.status !== batchStatus) {
      const grade = avgScore != null
        ? avgScore >= 90 ? "A" : avgScore >= 80 ? "B" : avgScore >= 70 ? "C" : avgScore >= 60 ? "D" : "F"
        : null;
      await db.update(scanBatches).set({
        status: batchStatus,
        completedScans: completed,
        overallScore: avgScore,
        overallGrade: grade,
        completedAt: new Date(),
      }).where(eq(scanBatches.id, id));
    }
  } else if (inProgress > 0 && batch.status === "pending") {
    batchStatus = "scanning";
    await db.update(scanBatches).set({
      status: "scanning",
      completedScans: completed,
    }).where(eq(scanBatches.id, id));
  } else {
    // Update progress
    await db.update(scanBatches).set({ completedScans: completed }).where(eq(scanBatches.id, id));
  }

  return NextResponse.json({
    ...batch,
    status: batchStatus,
    completedScans: completed,
    overallScore: avgScore,
    scans: batchScans,
  });
}

// DELETE /api/batches/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const batch = await db.query.scanBatches.findFirst({ where: eq(scanBatches.id, id) });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade deletes scans -> viewport_results -> audit_issues
  await db.delete(scanBatches).where(eq(scanBatches.id, id));
  return new NextResponse(null, { status: 204 });
}
