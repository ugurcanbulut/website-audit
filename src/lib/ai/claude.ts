import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysisResult } from "./provider";
import { UI_AUDIT_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";
import type { ViewportDimensions } from "./prompts";

export async function analyzeWithClaude(
  screenshots: { viewportName: string; imagePath: string }[],
  dimensions?: ViewportDimensions[]
): Promise<AiAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  const fs = await import("fs/promises");
  const path = await import("path");

  const imageContent: Anthropic.Messages.ContentBlockParam[] = [];
  const viewportNames: string[] = [];

  for (const screenshot of screenshots) {
    const screenshotDir = process.env.SCREENSHOTS_DIR || "./public/screenshots";
    const relativePath = screenshot.imagePath.replace(/^\/api\/screenshots\//, "");
    const fullPath = path.join(process.cwd(), screenshotDir, relativePath);
    const imageBuffer = await fs.readFile(fullPath);
    const base64 = imageBuffer.toString("base64");

    imageContent.push({
      type: "text",
      text: `Screenshot: ${screenshot.viewportName}`,
    });
    imageContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: base64,
      },
    });
    viewportNames.push(screenshot.viewportName);
  }

  imageContent.push({
    type: "text",
    text: buildAnalysisPrompt(viewportNames, dimensions),
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: UI_AUDIT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: imageContent,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return parseAiResponse(textBlock.text);
}

function parseAiResponse(text: string): AiAnalysisResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { issues: [], summary: "Failed to parse AI response" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      issues: (parsed.issues || []).map((issue: Record<string, unknown>) => ({
        severity: (issue.severity as string) || "info",
        title: (issue.title as string) || "Untitled issue",
        description: (issue.description as string) || "",
        recommendation: (issue.recommendation as string) || "",
        viewport: (issue.viewport as string) || "all",
        region: parseRegion(issue.region),
      })),
      summary: (parsed.summary as string) || "",
    };
  } catch {
    return { issues: [], summary: "Failed to parse AI response JSON" };
  }
}

function parseRegion(
  region: unknown
): { x: number; y: number; width: number; height: number } | null {
  if (!region || typeof region !== "object") return null;
  const r = region as Record<string, unknown>;
  const x = Number(r.x);
  const y = Number(r.y);
  const width = Number(r.width);
  const height = Number(r.height);
  if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}
