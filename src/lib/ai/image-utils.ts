import path from "node:path";
import fs from "node:fs/promises";

export type ImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

export function detectMediaTypeFromPath(p: string): ImageMediaType {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

export async function readScreenshotAsBase64(
  imagePath: string,
): Promise<{ base64: string; mediaType: ImageMediaType; fullPath: string }> {
  const screenshotDir =
    process.env.SCREENSHOTS_DIR || "./public/screenshots";
  const relativePath = imagePath.replace(/^\/api\/screenshots\//, "");
  const fullPath = path.join(process.cwd(), screenshotDir, relativePath);
  const imageBuffer = await fs.readFile(fullPath);
  return {
    base64: imageBuffer.toString("base64"),
    mediaType: detectMediaTypeFromPath(fullPath),
    fullPath,
  };
}
