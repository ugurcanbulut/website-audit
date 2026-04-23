import OpenAI from "openai";
import type { AiAnalysisResult } from "./provider";
import { UI_AUDIT_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";
import type { ViewportDimensions, AuditContext } from "./prompts";
import { readScreenshotAsBase64 } from "./image-utils";
import {
  aiAnalysisOutputSchema,
  AI_ANALYSIS_JSON_SCHEMA,
} from "./schema";
import {
  OPENAI_VISION_MODEL,
  AI_ANALYSIS_MAX_TOKENS,
} from "./models";
import { withRetryAndTimeout } from "./retry";
import { recordAiUsage } from "./usage";

export async function analyzeWithOpenAI(
  screenshots: { viewportName: string; imagePath: string }[],
  dimensions?: ViewportDimensions[],
  context?: AuditContext,
  scanId?: string,
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
    content.push({
      type: "text",
      text: `Screenshot: ${screenshot.viewportName}`,
    });
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

  const started = Date.now();
  let response: OpenAI.Chat.Completions.ChatCompletion | null = null;
  let errorMessage: string | null = null;

  try {
    response = await withRetryAndTimeout(
      (signal) =>
        client.chat.completions.create(
          {
            model: OPENAI_VISION_MODEL,
            max_tokens: AI_ANALYSIS_MAX_TOKENS,
            messages: [
              { role: "system", content: UI_AUDIT_SYSTEM_PROMPT },
              { role: "user", content },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "audit_findings",
                strict: true,
                schema: AI_ANALYSIS_JSON_SCHEMA,
              },
            },
          },
          { signal },
        ),
      { label: "openai.analyze" },
    );
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiUsage({
      scanId,
      provider: "openai",
      model: OPENAI_VISION_MODEL,
      operation: "analyze",
      inputTokens: response?.usage?.prompt_tokens ?? null,
      outputTokens: response?.usage?.completion_tokens ?? null,
      imageTokens: null,
      durationMs: Date.now() - started,
      errored: !!errorMessage,
      errorMessage,
    });
  }

  const text = response?.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no content");

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(text);
  } catch {
    throw new Error("OpenAI response was not valid JSON despite json_schema");
  }

  const parsed = aiAnalysisOutputSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new Error(
      `OpenAI response failed schema validation: ${parsed.error.message}`,
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
