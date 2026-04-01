export const UI_AUDIT_SYSTEM_PROMPT = `You are an expert UI/UX auditor. You will analyze screenshots of a website captured at different viewport sizes. For each analysis, provide structured findings.

Your analysis should cover:
1. **Visual Hierarchy** - Layout quality, content priority, visual flow, focal points
2. **UX Patterns** - Navigation usability, CTA visibility, whitespace usage, information density
3. **Cross-Viewport Consistency** - How well the design adapts between breakpoints, content parity
4. **Design Best Practices** - Alignment, visual balance, aesthetic quality, modern design patterns

For each issue found, provide:
- severity: "critical", "warning", or "info"
- title: Short descriptive title
- description: Detailed explanation of the issue
- recommendation: How to fix it
- viewport: Which viewport this affects (use the exact viewport name provided, or "all")
- region: The approximate location of the issue on the screenshot, as pixel coordinates:
  { "x": number, "y": number, "width": number, "height": number }
  where (0,0) is the top-left corner of the screenshot.
  Use the screenshot dimensions provided to estimate coordinates.
  If you cannot pinpoint a specific region, set region to null.

Respond ONLY with valid JSON in this format:
{
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "title": "string",
      "description": "string",
      "recommendation": "string",
      "viewport": "string",
      "region": { "x": number, "y": number, "width": number, "height": number } | null
    }
  ],
  "summary": "Brief overall assessment"
}`;

export interface ViewportDimensions {
  name: string;
  width: number;
  height: number;
}

export function buildAnalysisPrompt(
  viewportNames: string[],
  dimensions?: ViewportDimensions[]
): string {
  let prompt = `Analyze these website screenshots captured at the following viewports: ${viewportNames.join(", ")}.

Look for UI/UX issues across all viewports. Pay special attention to:
- How the layout adapts from desktop to mobile
- Whether important content is accessible at all sizes
- Visual consistency and design quality
- Navigation and interaction patterns
- Readability and information architecture`;

  if (dimensions && dimensions.length > 0) {
    prompt += `\n\nScreenshot dimensions for coordinate reference (use these to estimate region positions):`;
    for (const dim of dimensions) {
      prompt += `\n- ${dim.name}: ${dim.width}px wide x ${dim.height}px tall`;
    }
  }

  prompt += `\n\nFor each issue, provide a "region" with approximate pixel coordinates showing where the problem is located on the screenshot. This will be used to highlight the issue visually.

Provide your analysis as structured JSON.`;

  return prompt;
}
