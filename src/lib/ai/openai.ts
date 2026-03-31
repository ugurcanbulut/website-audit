import OpenAI from "openai";
import type { AiAnalysisResult } from "./provider";
import { UI_AUDIT_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";

export async function analyzeWithOpenAI(
  screenshots: { viewportName: string; imagePath: string }[]
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
    text: buildAnalysisPrompt(viewportNames),
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
