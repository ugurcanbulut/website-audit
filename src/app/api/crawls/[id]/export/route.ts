import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crawls, crawlPages } from "@/lib/db/schema";

type TabName =
  | "all"
  | "response-codes"
  | "titles"
  | "meta"
  | "headings"
  | "images"
  | "links";

const VALID_TABS: TabName[] = [
  "all",
  "response-codes",
  "titles",
  "meta",
  "headings",
  "images",
  "links",
];

function esc(val: unknown): string {
  return `"${String(val ?? "").replace(/"/g, '""')}"`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const crawl = await db.query.crawls.findFirst({ where: eq(crawls.id, id) });
  if (!crawl)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pages = await db.query.crawlPages.findMany({
    where: eq(crawlPages.crawlId, id),
  });

  const tab = (request.nextUrl.searchParams.get("tab") ?? "all") as TabName;
  if (!VALID_TABS.includes(tab)) {
    return NextResponse.json(
      { error: `Invalid tab: ${tab}. Valid values: ${VALID_TABS.join(", ")}` },
      { status: 400 },
    );
  }

  let headers: string[];
  let rows: string[][];
  let filenameSuffix = tab === "all" ? "" : `-${tab}`;

  switch (tab) {
    case "response-codes": {
      headers = [
        "URL",
        "Status Code",
        "Status",
        "Redirect URL",
        "Content Type",
      ];
      rows = pages.map((p) => {
        const code = p.statusCode ?? 0;
        let status = "Unknown";
        if (code >= 200 && code < 300) status = "OK";
        else if (code >= 300 && code < 400) status = "Redirect";
        else if (code >= 400 && code < 500) status = "Client Error";
        else if (code >= 500) status = "Server Error";
        return [
          p.url,
          String(p.statusCode ?? ""),
          status,
          p.redirectUrl ?? "",
          p.contentType ?? "",
        ];
      });
      break;
    }

    case "titles": {
      // Pre-compute duplicates
      const titleCounts = new Map<string, number>();
      for (const p of pages) {
        if (p.title) {
          titleCounts.set(p.title, (titleCounts.get(p.title) ?? 0) + 1);
        }
      }

      headers = ["URL", "Title", "Title Length", "Issues"];
      rows = pages.map((p) => {
        const issues: string[] = [];
        if (!p.title) {
          issues.push("Missing");
        } else {
          if (p.title.length < 30) issues.push("Too short");
          if (p.title.length > 60) issues.push("Too long");
          if ((titleCounts.get(p.title) ?? 0) > 1) issues.push("Duplicate");
        }
        return [
          p.url,
          p.title ?? "",
          String(p.title?.length ?? 0),
          issues.join("; "),
        ];
      });
      break;
    }

    case "meta": {
      const metaCounts = new Map<string, number>();
      for (const p of pages) {
        if (p.metaDescription) {
          metaCounts.set(
            p.metaDescription,
            (metaCounts.get(p.metaDescription) ?? 0) + 1,
          );
        }
      }

      headers = ["URL", "Meta Description", "Length", "Issues"];
      rows = pages.map((p) => {
        const issues: string[] = [];
        if (!p.metaDescription) {
          issues.push("Missing");
        } else {
          if (p.metaDescription.length < 70) issues.push("Too short");
          if (p.metaDescription.length > 160) issues.push("Too long");
          if ((metaCounts.get(p.metaDescription) ?? 0) > 1)
            issues.push("Duplicate");
        }
        return [
          p.url,
          p.metaDescription ?? "",
          String(p.metaDescription?.length ?? 0),
          issues.join("; "),
        ];
      });
      break;
    }

    case "headings": {
      headers = ["URL", "H1", "H1 Count", "H2 Count", "Issues"];
      rows = pages.map((p) => {
        const h1Arr = (p.h1 as string[] | null) ?? [];
        const h2Arr = (p.h2 as string[] | null) ?? [];
        const issues: string[] = [];
        if (h1Arr.length === 0) issues.push("Missing H1");
        if (h1Arr.length > 1) issues.push("Multiple H1");
        if (h1Arr.some((h) => !h || h.trim() === "")) issues.push("Empty H1");
        return [
          p.url,
          h1Arr.join(" | "),
          String(h1Arr.length),
          String(h2Arr.length),
          issues.join("; "),
        ];
      });
      break;
    }

    case "images": {
      headers = ["URL", "Total Images", "Missing Alt", "Image URLs"];
      rows = pages.map((p) => {
        const images =
          (p.images as Array<{ src: string; alt: string }> | null) ?? [];
        const missingAlt = images.filter(
          (i) => !i.alt || i.alt.trim() === "",
        ).length;
        return [
          p.url,
          String(images.length),
          String(missingAlt),
          images.map((i) => i.src).join(" | "),
        ];
      });
      break;
    }

    case "links": {
      headers = [
        "URL",
        "Internal Links",
        "External Links",
        "Total Links",
        "Inlinks",
      ];
      rows = pages.map((p) => {
        const internalLinks = (p.internalLinks as unknown[] | null) ?? [];
        const externalLinks = (p.externalLinks as unknown[] | null) ?? [];
        return [
          p.url,
          String(internalLinks.length),
          String(externalLinks.length),
          String(internalLinks.length + externalLinks.length),
          String(p.inlinksCount ?? 0),
        ];
      });
      break;
    }

    default: {
      // "all" -- full export (existing behavior, plus new fields)
      headers = [
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
        "Crawl Depth",
        "Inlinks",
        "Errors",
      ];

      rows = pages.map((p) => {
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
          String(p.statusCode ?? ""),
          p.title ?? "",
          String(p.title?.length ?? ""),
          p.metaDescription ?? "",
          String(p.metaDescription?.length ?? ""),
          h1Arr.join(" | "),
          h2Arr.join(" | "),
          p.canonicalUrl ?? "",
          p.metaRobots ?? "",
          String(p.wordCount ?? ""),
          String(p.responseTimeMs ?? ""),
          String(p.contentSize ?? ""),
          String(internalLinks.length),
          String(externalLinks.length),
          String(images.length),
          String(imgMissingAlt),
          String(structuredData.length),
          String(hreflang.length),
          String(p.crawlDepth ?? ""),
          String(p.inlinksCount ?? 0),
          errors.join(" | "),
        ];
      });
      break;
    }
  }

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => esc(cell)).join(",")),
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="crawl-${id}${filenameSuffix}.csv"`,
    },
  });
}
