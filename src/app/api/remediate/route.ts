import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditIssues } from "@/lib/db/schema";

const REMEDIATION_PROMPT = `You are an accessibility remediation expert. You will be given an HTML snippet that has a specific accessibility violation. Generate the corrected HTML that fixes the violation.

Rules:
- Only modify what's necessary to fix the specific violation
- Keep all existing classes, IDs, and other attributes
- Do not add unnecessary elements or attributes
- For missing alt text, write descriptive alt text based on context clues (src filename, surrounding elements)
- For missing labels, add appropriate aria-label or <label> elements
- For contrast issues, suggest a color that meets WCAG AA (4.5:1 ratio)
- For missing ARIA attributes, add the minimum required attributes

Respond ONLY with valid JSON:
{
  "fixedHtml": "the corrected HTML snippet",
  "explanation": "brief explanation of what was changed and why"
}`;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { issueId, provider } = body;

  if (!issueId) {
    return NextResponse.json({ error: "issueId required" }, { status: 400 });
  }

  // Fetch the issue
  const issue = await db.query.auditIssues.findFirst({
    where: eq(auditIssues.id, issueId),
  });

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  if (!issue.elementHtml) {
    return NextResponse.json(
      { error: "No HTML available for this issue" },
      { status: 400 },
    );
  }

  // Build the prompt
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

  try {
    let fixedHtml: string;
    let explanation: string;

    const aiProvider = provider || "openai";

    if (aiProvider === "claude") {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey)
        return NextResponse.json(
          { error: "ANTHROPIC_API_KEY not configured" },
          { status: 500 },
        );

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: REMEDIATION_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error("No response");
      const parsed = parseResponse(text.text);
      fixedHtml = parsed.fixedHtml;
      explanation = parsed.explanation;
    } else {
      const OpenAI = (await import("openai")).default;
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey)
        return NextResponse.json(
          { error: "OPENAI_API_KEY not configured" },
          { status: 500 },
        );

      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 2048,
        messages: [
          { role: "system", content: REMEDIATION_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error("No response");
      const parsed = parseResponse(text);
      fixedHtml = parsed.fixedHtml;
      explanation = parsed.explanation;
    }

    // Save the fix back to the issue details
    const existingDetails =
      (issue.details as Record<string, unknown>) ?? {};
    await db
      .update(auditIssues)
      .set({
        details: {
          ...existingDetails,
          codeFix: {
            before: issue.elementHtml,
            after: fixedHtml,
            language: "html",
          },
          fixExplanation: explanation,
        },
      })
      .where(eq(auditIssues.id, issueId));

    return NextResponse.json({ fixedHtml, explanation });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function parseResponse(text: string): {
  fixedHtml: string;
  explanation: string;
} {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch)
    return { fixedHtml: "", explanation: "Failed to parse AI response" };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      fixedHtml: parsed.fixedHtml || "",
      explanation: parsed.explanation || "",
    };
  } catch {
    return { fixedHtml: "", explanation: "Failed to parse AI response" };
  }
}
