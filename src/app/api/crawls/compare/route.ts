import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crawls, crawlPages } from "@/lib/db/schema";

// GET /api/crawls/compare?a=crawlId1&b=crawlId2
export async function GET(request: NextRequest) {
  const a = request.nextUrl.searchParams.get("a");
  const b = request.nextUrl.searchParams.get("b");

  if (!a || !b) {
    return NextResponse.json(
      { error: "Both crawl IDs required (?a=...&b=...)" },
      { status: 400 },
    );
  }

  const [crawlA, crawlB] = await Promise.all([
    db.query.crawls.findFirst({ where: eq(crawls.id, a) }),
    db.query.crawls.findFirst({ where: eq(crawls.id, b) }),
  ]);

  if (!crawlA || !crawlB) {
    return NextResponse.json(
      { error: "One or both crawls not found" },
      { status: 404 },
    );
  }

  const [pagesA, pagesB] = await Promise.all([
    db.query.crawlPages.findMany({ where: eq(crawlPages.crawlId, a) }),
    db.query.crawlPages.findMany({ where: eq(crawlPages.crawlId, b) }),
  ]);

  // Build URL maps
  const mapA = new Map(pagesA.map((p) => [p.url, p]));
  const mapB = new Map(pagesB.map((p) => [p.url, p]));

  const allUrls = new Set([...mapA.keys(), ...mapB.keys()]);

  const added: string[] = []; // In B but not A
  const removed: string[] = []; // In A but not B
  const changed: Array<{
    url: string;
    changes: Array<{ field: string; before: string | null; after: string | null }>;
  }> = [];
  const unchanged: string[] = [];

  for (const url of allUrls) {
    const pageA = mapA.get(url);
    const pageB = mapB.get(url);

    if (!pageA && pageB) {
      added.push(url);
    } else if (pageA && !pageB) {
      removed.push(url);
    } else if (pageA && pageB) {
      // Compare key fields
      const fieldChanges: Array<{
        field: string;
        before: string | null;
        after: string | null;
      }> = [];

      if (pageA.statusCode !== pageB.statusCode) {
        fieldChanges.push({
          field: "Status Code",
          before: String(pageA.statusCode),
          after: String(pageB.statusCode),
        });
      }
      if (pageA.title !== pageB.title) {
        fieldChanges.push({
          field: "Title",
          before: pageA.title,
          after: pageB.title,
        });
      }
      if (pageA.metaDescription !== pageB.metaDescription) {
        fieldChanges.push({
          field: "Meta Description",
          before: pageA.metaDescription,
          after: pageB.metaDescription,
        });
      }
      if (pageA.canonicalUrl !== pageB.canonicalUrl) {
        fieldChanges.push({
          field: "Canonical URL",
          before: pageA.canonicalUrl,
          after: pageB.canonicalUrl,
        });
      }
      if (pageA.metaRobots !== pageB.metaRobots) {
        fieldChanges.push({
          field: "Meta Robots",
          before: pageA.metaRobots,
          after: pageB.metaRobots,
        });
      }
      const h1A = ((pageA.h1 as string[]) ?? []).join(", ");
      const h1B = ((pageB.h1 as string[]) ?? []).join(", ");
      if (h1A !== h1B) {
        fieldChanges.push({
          field: "H1",
          before: h1A || null,
          after: h1B || null,
        });
      }
      if (pageA.wordCount !== pageB.wordCount) {
        fieldChanges.push({
          field: "Word Count",
          before: String(pageA.wordCount),
          after: String(pageB.wordCount),
        });
      }

      if (fieldChanges.length > 0) {
        changed.push({ url, changes: fieldChanges });
      } else {
        unchanged.push(url);
      }
    }
  }

  return NextResponse.json({
    crawlA: {
      id: crawlA.id,
      seedUrl: crawlA.seedUrl,
      createdAt: crawlA.createdAt,
      pageCount: pagesA.length,
    },
    crawlB: {
      id: crawlB.id,
      seedUrl: crawlB.seedUrl,
      createdAt: crawlB.createdAt,
      pageCount: pagesB.length,
    },
    summary: {
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged: unchanged.length,
    },
    added,
    removed,
    changed,
  });
}
