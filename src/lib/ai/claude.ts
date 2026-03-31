import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysisResult } from "./provider";
import { UI_AUDIT_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";

export async function analyzeWithClaude(
  screenshots: { viewportName: string; imagePath: string }[]
): Promise<AiAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const client = new Anthropic({ apiKey });

  // Read screenshot files and convert to base64
  const fs = await import("fs/promises");
  const path = await import("path");

  const imageContent: Anthropic.Messages.ContentBlockParam[] = [];
  const viewportNames: string[] = [];

  for (const screenshot of screenshots) {
    // imagePath is /api/screenshots/scanId/file.png, map to actual file
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
    text: buildAnalysisPrompt(viewportNames),
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

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return parseAiResponse(textBlock.text);
}

function parseAiResponse(text: string): AiAnalysisResult {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { issues: [], summary: "Failed to parse AI response" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      issues: (parsed.issues || []).map((issue: Record<string, string>) => ({
        severity: issue.severity || "info",
        title: issue.title || "Untitled issue",
        description: issue.description || "",
        recommendation: issue.recommendation || "",
        viewport: issue.viewport || "all",
      })),
      summary: parsed.summary || "",
    };
  } catch {
    return { issues: [], summary: "Failed to parse AI response JSON" };
  }
}
