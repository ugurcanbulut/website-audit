import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crawls, crawlPages } from "@/lib/db/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const crawl = await db.query.crawls.findFirst({ where: eq(crawls.id, id) });
  if (!crawl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pages = await db.query.crawlPages.findMany({
    where: eq(crawlPages.crawlId, id),
  });

  return NextResponse.json({ ...crawl, pages });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const crawl = await db.query.crawls.findFirst({ where: eq(crawls.id, id) });
  if (!crawl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(crawls).where(eq(crawls.id, id));
  return new NextResponse(null, { status: 204 });
}
