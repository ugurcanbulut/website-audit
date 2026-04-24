import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { crawls } from "@/lib/db/schema";
import { addCrawlJob } from "@/lib/queue/crawl-queue";
import { DEFAULT_CRAWL_CONFIG } from "@/lib/crawler/types";
import { assertScanTargetUrl, UrlGuardError } from "@/lib/security/url-guard";
import { rateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";

const createCrawlSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  maxPages: z.number().min(1).max(1000).default(100),
  maxDepth: z.number().min(1).max(20).default(5),
  crawlRate: z.number().min(100).max(10000).default(1000),
  respectRobotsTxt: z.boolean().default(true),
  followSitemaps: z.boolean().default(true),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

export async function GET() {
  const allCrawls = await db.query.crawls.findMany({
    orderBy: [desc(crawls.createdAt)],
    limit: 50,
  });
  return NextResponse.json(allCrawls);
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitOrResponse(request, RATE_LIMITS.crawl);
  if (limited) return limited;

  const body = await request.json();
  const parsed = createCrawlSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { url, ...configFields } = parsed.data;

  try {
    await assertScanTargetUrl(url);
  } catch (e) {
    if (e instanceof UrlGuardError) {
      return NextResponse.json(
        { error: { url: [e.message] } },
        { status: 400 },
      );
    }
    throw e;
  }

  const [crawl] = await db
    .insert(crawls)
    .values({
      seedUrl: url,
      config: { ...DEFAULT_CRAWL_CONFIG, ...configFields },
    })
    .returning();

  await addCrawlJob(crawl.id);
  return NextResponse.json(crawl, { status: 201 });
}
