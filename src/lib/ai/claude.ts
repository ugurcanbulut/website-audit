import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysisResult } from "./provider";
import { UI_AUDIT_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";
import type { ViewportDimensions, AuditContext } from "./prompts";

export async function analyzeWithClaude(
  screenshots: { viewportName: string; imagePath: string }[],
  dimensions?: ViewportDimensions[],
  context?: AuditContext
): Promise<AiAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

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

    imageContent.push({ type: "text", text: `Screenshot: ${screenshot.viewportName}` });
    imageContent.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: base64 },
    });
    viewportNames.push(screenshot.viewportName);
  }

  imageContent.push({
    type: "text",
    text: buildAnalysisPrompt(viewportNames, dimensions, context),
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: UI_AUDIT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: imageContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

  return parseAiResponse(textBlock.text);
}

function parseAiResponse(text: string): AiAnalysisResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { issues: [], summary: "Failed to parse AI response" };

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
        codeFix: parseCodeFix(issue.codeFix),
      })),
      altTextSuggestions: (parsed.altTextSuggestions || []).map((alt: Record<string, unknown>) => ({
        selector: (alt.selector as string) || "",
        currentAlt: (alt.currentAlt as string) || null,
        suggestedAlt: (alt.suggestedAlt as string) || "",
        viewport: (alt.viewport as string) || "all",
      })),
      summary: (parsed.summary as string) || "",
    };
  } catch {
    return { issues: [], summary: "Failed to parse AI response JSON" };
  }
}

function parseRegion(region: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!region || typeof region !== "object") return null;
  const r = region as Record<string, unknown>;
  const x = Number(r.x), y = Number(r.y), width = Number(r.width), height = Number(r.height);
  if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function parseCodeFix(fix: unknown): { before: string; after: string; language: "html" | "css" } | null {
  if (!fix || typeof fix !== "object") return null;
  const f = fix as Record<string, unknown>;
  const before = f.before as string;
  const after = f.after as string;
  if (!before || !after) return null;
  const lang = (f.language as string) === "css" ? "css" : "html";
  return { before, after, language: lang };
}
