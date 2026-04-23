import OpenAI from "openai";
import type { AiAnalysisResult } from "./provider";
import { UI_AUDIT_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";
import type { ViewportDimensions, AuditContext } from "./prompts";
import { readScreenshotAsBase64 } from "./image-utils";

export async function analyzeWithOpenAI(
  screenshots: { viewportName: string; imagePath: string }[],
  dimensions?: ViewportDimensions[],
  context?: AuditContext
): Promise<AiAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const client = new OpenAI({ apiKey });

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  const viewportNames: string[] = [];

  for (const screenshot of screenshots) {
    const { base64, mediaType } = await readScreenshotAsBase64(
      screenshot.imagePath,
    );

    content.push({ type: "text", text: `Screenshot: ${screenshot.viewportName}` });
    content.push({
      type: "image_url",
      image_url: { url: `data:${mediaType};base64,${base64}`, detail: "high" },
    });
    viewportNames.push(screenshot.viewportName);
  }

  content.push({
    type: "text",
    text: buildAnalysisPrompt(viewportNames, dimensions, context),
  });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 8192,
    messages: [
      { role: "system", content: UI_AUDIT_SYSTEM_PROMPT },
      { role: "user", content },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No response from OpenAI");

  return parseAiResponse(text);
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
