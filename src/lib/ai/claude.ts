import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysisResult } from "./provider";
import { UI_AUDIT_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";
import type { ViewportDimensions, AuditContext } from "./prompts";
import { readScreenshotAsBase64 } from "./image-utils";
import {
  aiAnalysisOutputSchema,
  AI_ANALYSIS_JSON_SCHEMA,
} from "./schema";
import {
  ANTHROPIC_VISION_MODEL,
  AI_ANALYSIS_MAX_TOKENS,
} from "./models";
import { withRetryAndTimeout } from "./retry";
import { recordAiUsage } from "./usage";

// Name of the tool we force Claude to call — tool_use guarantees structured
// JSON matching AI_ANALYSIS_JSON_SCHEMA.
const TOOL_NAME = "report_audit_findings";

export async function analyzeWithClaude(
  screenshots: { viewportName: string; imagePath: string }[],
  dimensions?: ViewportDimensions[],
  context?: AuditContext,
  scanId?: string,
): Promise<AiAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });

  const imageContent: Anthropic.Messages.ContentBlockParam[] = [];
  const viewportNames: string[] = [];

  for (const screenshot of screenshots) {
    const { base64, mediaType } = await readScreenshotAsBase64(
      screenshot.imagePath,
    );
    imageContent.push({
      type: "text",
      text: `Screenshot: ${screenshot.viewportName}`,
    });
    imageContent.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    });
    viewportNames.push(screenshot.viewportName);
  }

  imageContent.push({
    type: "text",
    text: buildAnalysisPrompt(viewportNames, dimensions, context),
  });

  const started = Date.now();
  let response: Anthropic.Messages.Message | null = null;
  let errorMessage: string | null = null;

  try {
    response = await withRetryAndTimeout(
      (signal) =>
        client.messages.create(
          {
            model: ANTHROPIC_VISION_MODEL,
            max_tokens: AI_ANALYSIS_MAX_TOKENS,
            system: UI_AUDIT_SYSTEM_PROMPT,
            messages: [{ role: "user", content: imageContent }],
            tools: [
              {
                name: TOOL_NAME,
                description:
                  "Report audit findings as structured JSON. Issues, alt-text suggestions, and a short textual summary.",
                input_schema: AI_ANALYSIS_JSON_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
              },
            ],
            tool_choice: { type: "tool", name: TOOL_NAME },
          },
          { signal },
        ),
      { label: "claude.analyze" },
    );
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiUsage({
      scanId,
      provider: "claude",
      model: ANTHROPIC_VISION_MODEL,
      operation: "analyze",
      inputTokens: response?.usage?.input_tokens ?? null,
      outputTokens: response?.usage?.output_tokens ?? null,
      imageTokens: null,
      durationMs: Date.now() - started,
      errored: !!errorMessage,
      errorMessage,
    });
  }

  const toolUse = response?.content.find(
    (block) => block.type === "tool_use" && block.name === TOOL_NAME,
  );
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured tool_use response");
  }

  const parsed = aiAnalysisOutputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `Claude tool_use response failed schema validation: ${parsed.error.message}`,
    );
  }

  return {
    issues: parsed.data.issues.map((i) => ({
      severity: i.severity,
      title: i.title,
      description: i.description,
      recommendation: i.recommendation,
      viewport: i.viewport,
      region: i.region ?? null,
      codeFix: i.codeFix
        ? {
            before: i.codeFix.before,
            after: i.codeFix.after,
            // AiCodeFix in provider.ts still expects html|css; map javascript to html.
            language:
              i.codeFix.language === "javascript" ? "html" : i.codeFix.language,
          }
        : null,
    })),
    altTextSuggestions: parsed.data.altTextSuggestions.map((a) => ({
      selector: a.selector,
      currentAlt: a.currentAlt,
      suggestedAlt: a.suggestedAlt,
      viewport: a.viewport,
    })),
    summary: parsed.data.summary,
  };
}
