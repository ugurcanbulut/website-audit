import OpenAI from "openai";
import type { AiAnalysisResult } from "./provider";
import { UI_AUDIT_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";
import type { ViewportDimensions } from "./prompts";

export async function analyzeWithOpenAI(
  screenshots: { viewportName: string; imagePath: string }[],
  dimensions?: ViewportDimensions[]
): Promise<AiAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey });

  const fs = await import("fs/promises");
  const path = await import("path");

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  const viewportNames: string[] = [];

  for (const screenshot of screenshots) {
    const screenshotDir = process.env.SCREENSHOTS_DIR || "./public/screenshots";
    const relativePath = screenshot.imagePath.replace(/^\/api\/screenshots\//, "");
    const fullPath = path.join(process.cwd(), screenshotDir, relativePath);
    const imageBuffer = await fs.readFile(fullPath);
    const base64 = imageBuffer.toString("base64");

    content.push({
      type: "text",
      text: `Screenshot: ${screenshot.viewportName}`,
    });
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${base64}`,
        detail: "high",
      },
    });
    viewportNames.push(screenshot.viewportName);
  }

  content.push({
    type: "text",
    text: buildAnalysisPrompt(viewportNames, dimensions),
  });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4096,
    messages: [
      { role: "system", content: UI_AUDIT_SYSTEM_PROMPT },
      { role: "user", content },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("No response from OpenAI");
  }

  return parseAiResponse(text);
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
