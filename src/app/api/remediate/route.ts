import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditIssues } from "@/lib/db/schema";
import {
  aiRemediationSchema,
  AI_REMEDIATION_JSON_SCHEMA,
} from "@/lib/ai/schema";
import {
  ANTHROPIC_REMEDIATION_MODEL,
  OPENAI_REMEDIATION_MODEL,
  AI_REMEDIATION_MAX_TOKENS,
} from "@/lib/ai/models";
import { withRetryAndTimeout } from "@/lib/ai/retry";
import { recordAiUsage } from "@/lib/ai/usage";
import { rateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";

const REMEDIATION_SYSTEM_PROMPT = `You are an accessibility remediation expert. You will be given an HTML snippet that has a specific accessibility violation. Generate the corrected HTML that fixes the violation.

Rules:
- Only modify what's necessary to fix the specific violation
- Keep all existing classes, IDs, and other attributes
- Do not add unnecessary elements or attributes
- For missing alt text, write descriptive alt text based on context clues (src filename, surrounding elements)
- For missing labels, add appropriate aria-label or <label> elements
- For contrast issues, suggest a color that meets WCAG AA (4.5:1 ratio)
- For missing ARIA attributes, add the minimum required attributes`;

const TOOL_NAME = "apply_accessibility_fix";

type AnthropicToolInputSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

const requestSchema = z.object({
  issueId: z.string().uuid().optional(),
  issueIds: z.array(z.string().uuid()).optional(),
  provider: z.enum(["claude", "openai"]).optional(),
});

type Fix = { fixedHtml: string; explanation: string };

async function remediateOne(
  issue: typeof auditIssues.$inferSelect,
  provider: "claude" | "openai",
): Promise<Fix> {
  const userPrompt = `Accessibility Violation: ${issue.title}
Description: ${issue.description}
Rule: ${issue.ruleId}
${issue.recommendation ? `Recommendation: ${issue.recommendation}` : ""}

HTML snippet with the violation:
\`\`\`html
${issue.elementHtml}
\`\`\`

${issue.elementSelector ? `Element selector: ${issue.elementSelector}` : ""}

Generate the fixed HTML.`;

  const started = Date.now();
  let errorMessage: string | null = null;

  if (provider === "claude") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    let response: Awaited<ReturnType<typeof client.messages.create>> | null =
      null;
    try {
      response = await withRetryAndTimeout(
        (signal) =>
          client.messages.create(
            {
              model: ANTHROPIC_REMEDIATION_MODEL,
              max_tokens: AI_REMEDIATION_MAX_TOKENS,
              system: REMEDIATION_SYSTEM_PROMPT,
              messages: [{ role: "user", content: userPrompt }],
              tools: [
                {
                  name: TOOL_NAME,
                  description: "Return the corrected HTML and an explanation.",
                  input_schema:
                    AI_REMEDIATION_JSON_SCHEMA as unknown as AnthropicToolInputSchema,
                },
              ],
              tool_choice: { type: "tool", name: TOOL_NAME },
            },
            { signal },
          ),
        { label: "claude.remediate" },
      );
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      await recordAiUsage({
        scanId: issue.scanId,
        provider: "claude",
        model: ANTHROPIC_REMEDIATION_MODEL,
        operation: "remediate",
        inputTokens: response?.usage?.input_tokens ?? null,
        outputTokens: response?.usage?.output_tokens ?? null,
        durationMs: Date.now() - started,
        errored: !!errorMessage,
        errorMessage,
      });
    }

    const toolUse = response.content.find(
      (b) => b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a structured fix");
    }
    const parsed = aiRemediationSchema.safeParse(toolUse.input);
    if (!parsed.success)
      throw new Error(
        `Claude fix failed schema validation: ${parsed.error.message}`,
      );
    return parsed.data;
  }

  // OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });

  let completion: Awaited<
    ReturnType<typeof client.chat.completions.create>
  > | null = null;
  try {
    completion = await withRetryAndTimeout(
      (signal) =>
        client.chat.completions.create(
          {
            model: OPENAI_REMEDIATION_MODEL,
            max_tokens: AI_REMEDIATION_MAX_TOKENS,
            messages: [
              { role: "system", content: REMEDIATION_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "accessibility_fix",
                strict: true,
                schema: AI_REMEDIATION_JSON_SCHEMA,
              },
            },
          },
          { signal },
        ),
      { label: "openai.remediate" },
    );
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await recordAiUsage({
      scanId: issue.scanId,
      provider: "openai",
      model: OPENAI_REMEDIATION_MODEL,
      operation: "remediate",
      inputTokens: completion?.usage?.prompt_tokens ?? null,
      outputTokens: completion?.usage?.completion_tokens ?? null,
      durationMs: Date.now() - started,
      errored: !!errorMessage,
      errorMessage,
    });
  }

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no content");

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(text);
  } catch {
    throw new Error("OpenAI fix was not valid JSON despite json_schema");
  }
  const parsed = aiRemediationSchema.safeParse(rawJson);
  if (!parsed.success)
    throw new Error(
      `OpenAI fix failed schema validation: ${parsed.error.message}`,
    );
  return parsed.data;
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitOrResponse(request, RATE_LIMITS.remediate);
  if (limited) return limited;

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { issueId, issueIds: batchIds, provider: rawProvider } = parsed.data;
  const ids = batchIds ?? (issueId ? [issueId] : []);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Provide issueId or issueIds" },
      { status: 400 },
    );
  }

  const issues = await db.query.auditIssues.findMany({
    where: inArray(auditIssues.id, ids),
  });
  if (issues.length === 0) {
    return NextResponse.json({ error: "No issues found" }, { status: 404 });
  }

  const provider = rawProvider ?? "openai";
  const results: Array<{
    issueId: string;
    fixedHtml?: string;
    explanation?: string;
    error?: string;
  }> = [];

  for (const issue of issues) {
    if (!issue.elementHtml) {
      results.push({
        issueId: issue.id,
        error: "No HTML available for this issue",
      });
      continue;
    }

    try {
      const fix = await remediateOne(issue, provider);
      const existingDetails =
        (issue.details as Record<string, unknown>) ?? {};
      await db
        .update(auditIssues)
        .set({
          details: {
            ...existingDetails,
            codeFix: {
              before: issue.elementHtml,
              after: fix.fixedHtml,
              language: "html",
            },
            fixExplanation: fix.explanation,
          },
        })
        .where(eq(auditIssues.id, issue.id));
      results.push({
        issueId: issue.id,
        fixedHtml: fix.fixedHtml,
        explanation: fix.explanation,
      });
    } catch (e) {
      results.push({
        issueId: issue.id,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  // Preserve the original single-issue response shape when caller sent issueId.
  if (issueId && !batchIds) {
    const r = results[0];
    if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json({
      fixedHtml: r.fixedHtml,
      explanation: r.explanation,
    });
  }

  return NextResponse.json({ results });
}
