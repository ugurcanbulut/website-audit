export interface ViewportDimensions {
  name: string;
  width: number;
  height: number;
}

export interface AuditContext {
  /** Top axe-core violations (already detected by tools) */
  accessibilityViolations?: string[];
  /** Top Lighthouse failures (already detected) */
  lighthouseFailures?: string[];
  /** Key page elements from DOM snapshot */
  pageStructure?: string;
}

// ─────────────────────────────────────────────────────────────────────
// System prompt: defines the AI's role and output format
// ─────────────────────────────────────────────────────────────────────

export const UI_AUDIT_SYSTEM_PROMPT = `You are a senior UI/UX auditor and frontend engineer. You analyze website screenshots alongside tool-generated audit data to provide actionable, specific findings that go BEYOND what automated tools can detect.

## Your Focus Areas (what automated tools CANNOT do well):
1. **Visual Design Quality** - Layout balance, whitespace usage, visual hierarchy, design consistency
2. **UX Flow & Usability** - Navigation clarity, CTA effectiveness, information architecture, user journey friction
3. **Content & Readability** - Text density, cognitive load, content prioritization, reading flow
4. **Cross-Viewport Adaptation** - How well the design ACTUALLY adapts (not just whether it fits), content parity, mobile UX quality
5. **Contextual Alt Text** - Generate specific, meaningful alt text for images that lack it
6. **Specific Code Fixes** - When you identify an issue, provide the exact HTML/CSS change needed

## Rules:
- Do NOT repeat issues that automated tools already found (they are provided below as context)
- Focus on VISUAL and UX insights that require human judgment
- Every recommendation MUST include a concrete code fix (BEFORE → AFTER) when applicable
- Be specific: "The hero CTA button has low contrast against the background image" not "Some elements have contrast issues"
- Reference specific elements by their visible text or position

## Output Format:
Respond ONLY with valid JSON:
{
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "title": "Short specific title",
      "description": "Detailed explanation with specific element references",
      "recommendation": "What to change and why",
      "codeFix": {
        "before": "Current HTML/CSS (if applicable)",
        "after": "Fixed HTML/CSS",
        "language": "html" | "css"
      } | null,
      "viewport": "exact viewport name or all",
      "region": { "x": number, "y": number, "width": number, "height": number } | null
    }
  ],
  "altTextSuggestions": [
    {
      "selector": "img element description (e.g., hero image, logo, product photo)",
      "currentAlt": "" | null,
      "suggestedAlt": "Descriptive alt text based on visual content",
      "viewport": "viewport name"
    }
  ],
  "summary": "2-3 sentence overall UX assessment"
}`;

// ─────────────────────────────────────────────────────────────────────
// User prompt: includes context from automated tools
// ─────────────────────────────────────────────────────────────────────

export function buildAnalysisPrompt(
  viewportNames: string[],
  dimensions?: ViewportDimensions[],
  context?: AuditContext
): string {
  let prompt = `## Screenshots
Analyze these website screenshots captured at: ${viewportNames.join(", ")}.`;

  if (dimensions && dimensions.length > 0) {
    prompt += `\n\n## Screenshot Dimensions (for region coordinates)`;
    for (const dim of dimensions) {
      prompt += `\n- ${dim.name}: ${dim.width}px x ${dim.height}px`;
    }
  }

  if (context) {
    prompt += `\n\n## Automated Tool Results (DO NOT repeat these — focus on what they missed)`;

    if (context.accessibilityViolations && context.accessibilityViolations.length > 0) {
      prompt += `\n\n### Accessibility Issues Already Found by axe-core:`;
      for (const v of context.accessibilityViolations.slice(0, 15)) {
        prompt += `\n- ${v}`;
      }
    }

    if (context.lighthouseFailures && context.lighthouseFailures.length > 0) {
      prompt += `\n\n### Performance/SEO Issues Already Found by Lighthouse:`;
      for (const f of context.lighthouseFailures.slice(0, 10)) {
        prompt += `\n- ${f}`;
      }
    }

    if (context.pageStructure) {
      prompt += `\n\n### Page Structure (from DOM snapshot):\n${context.pageStructure}`;
    }
  }

  prompt += `\n\n## Your Task
1. Analyze the screenshots for visual design, UX, and usability issues that the automated tools above could NOT detect.
2. For images missing alt text, generate specific contextual alt text based on what you see in the screenshot.
3. For every issue, provide a concrete code fix when possible (BEFORE → AFTER HTML/CSS).
4. Include approximate region coordinates for each issue.
5. Do NOT repeat any issue already listed in the automated tool results above.

Respond with structured JSON.`;

  return prompt;
}
