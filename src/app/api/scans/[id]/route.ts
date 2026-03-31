import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { scans, viewportResults, auditIssues, categoryScores } from "@/lib/db/schema";

const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || "./public/screenshots";

// GET /api/scans/[id] - Get scan details with all results
export async function GET(
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

  const [viewports, issues, scores] = await Promise.all([
    db.query.viewportResults.findMany({
      where: eq(viewportResults.scanId, id),
    }),
    db.query.auditIssues.findMany({
      where: eq(auditIssues.scanId, id),
    }),
    db.query.categoryScores.findMany({
      where: eq(categoryScores.scanId, id),
    }),
  ]);

  return NextResponse.json({
    ...scan,
    viewportResults: viewports,
    issues,
    categoryScores: scores,
  });
}

// DELETE /api/scans/[id] - Delete a scan and its screenshots
export async function DELETE(
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

  // Delete scan from DB (cascade handles viewport_results, audit_issues, category_scores)
  await db.delete(scans).where(eq(scans.id, id));

  // Clean up screenshot directory
  const screenshotDir = path.join(SCREENSHOTS_DIR, id);
  await fs.rm(screenshotDir, { recursive: true, force: true });

  return new NextResponse(null, { status: 204 });
}
