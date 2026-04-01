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

  // Build CSV
  const headers = [
    "URL",
    "Status Code",
    "Title",
    "Title Length",
    "Meta Description",
    "Meta Description Length",
    "H1",
    "H2",
    "Canonical URL",
    "Meta Robots",
    "Word Count",
    "Response Time (ms)",
    "Content Size",
    "Internal Links",
    "External Links",
    "Images",
    "Images Missing Alt",
    "Structured Data",
    "Hreflang",
    "Errors",
  ];

  const rows = pages.map((p) => {
    const h1Arr = (p.h1 as string[] | null) ?? [];
    const h2Arr = (p.h2 as string[] | null) ?? [];
    const internalLinks = (p.internalLinks as unknown[] | null) ?? [];
    const externalLinks = (p.externalLinks as unknown[] | null) ?? [];
    const images =
      (p.images as Array<{ src: string; alt: string }> | null) ?? [];
    const structuredData = (p.structuredData as unknown[] | null) ?? [];
    const hreflang = (p.hreflang as unknown[] | null) ?? [];
    const errors = (p.errors as string[] | null) ?? [];
    const imgMissingAlt = images.filter(
      (i) => !i.alt || i.alt.trim() === "",
    ).length;

    return [
      p.url,
      p.statusCode ?? "",
      p.title ?? "",
      p.title?.length ?? "",
      p.metaDescription ?? "",
      p.metaDescription?.length ?? "",
      h1Arr.join(" | "),
      h2Arr.join(" | "),
      p.canonicalUrl ?? "",
      p.metaRobots ?? "",
      p.wordCount ?? "",
      p.responseTimeMs ?? "",
      p.contentSize ?? "",
      internalLinks.length,
      externalLinks.length,
      images.length,
      imgMissingAlt,
      structuredData.length,
      hreflang.length,
      errors.join(" | "),
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="crawl-${id}.csv"`,
    },
  });
}
