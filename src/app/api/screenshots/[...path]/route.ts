import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const SCREENSHOTS_DIR =
  process.env.SCREENSHOTS_DIR || "./public/screenshots";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filePath = join(process.cwd(), SCREENSHOTS_DIR, ...pathSegments);

  // Prevent directory traversal
  const resolved = join(process.cwd(), SCREENSHOTS_DIR);
  if (!filePath.startsWith(resolved)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const file = await readFile(filePath);
    const contentType = filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png";
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
