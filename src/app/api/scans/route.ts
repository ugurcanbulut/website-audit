import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import { addScanJob } from "@/lib/queue/scan-queue";
import { getDevicesByNames, DEFAULT_DEVICES } from "@/lib/scanner/devices";
import { assertScanTargetUrl, UrlGuardError } from "@/lib/security/url-guard";
import { rateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";

const createScanSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  // Legacy support
  viewports: z.array(z.string()).optional(),
  // New device-based
  devices: z.array(z.string()).optional(),
  browserEngine: z.enum(["chromium", "firefox", "webkit"]).default("chromium"),
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
  const limited = await rateLimitOrResponse(request, RATE_LIMITS.scan);
  if (limited) return limited;

  const body = await request.json();
  const parsed = createScanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { url, aiEnabled, aiProvider } = parsed.data;

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

  // Resolve device names: new device-based > legacy viewports > defaults
  const deviceNames = parsed.data.devices
    ?? parsed.data.viewports
    ?? DEFAULT_DEVICES;

  // Full device presets (includes userAgent, scale factor, etc.)
  const resolvedDevices = getDevicesByNames(deviceNames);

  if (resolvedDevices.length === 0) {
    return NextResponse.json(
      { error: { devices: ["No valid devices selected"] } },
      { status: 400 }
    );
  }

  // Store as ViewportConfig for DB backward compat
  const viewportConfigs = resolvedDevices.map((d) => ({
    name: d.name,
    width: d.width,
    height: d.height,
    type: d.type,
  }));

  // Create scan record
  const [scan] = await db
    .insert(scans)
    .values({
      url,
      viewports: viewportConfigs,
      browserEngine: parsed.data.browserEngine,
      aiEnabled,
      aiProvider: aiEnabled ? aiProvider : null,
    })
    .returning();

  // Enqueue scan job
  await addScanJob({
    scanId: scan.id,
    url,
    viewports: viewportConfigs,
    devices: resolvedDevices,
    browserEngine: parsed.data.browserEngine,
    aiEnabled,
    aiProvider,
  });

  return NextResponse.json(scan, { status: 201 });
}
