import type { DomSnapshot, DomElement } from "@/lib/scanner/capture";

interface AuditIssueInput {
  category: string;
  severity: "critical" | "warning" | "info" | "pass";
  ruleId: string;
  title: string;
  description: string;
  elementSelector?: string;
  elementHtml?: string;
  recommendation?: string;
  details?: Record<string, unknown>;
}

const FORM_INPUT_TAGS = new Set(["input", "select", "textarea"]);

const AUTOCOMPLETE_INPUT_TYPES = new Set([
  "text",
  "email",
  "tel",
  "password",
  "url",
  "search",
]);

/**
 * Form-related checks for a single viewport snapshot.
 * Kept checks: small-input-mobile, missing-autocomplete.
 * Removed: input-no-label, placeholder-only (covered by axe-core).
 */
export function runFormChecks(
  domSnapshot: DomSnapshot,
  viewportName: string,
  viewportType: string
): AuditIssueInput[] {
  const issues: AuditIssueInput[] = [];

  const formInputs = domSnapshot.elements.filter(
    (el) => FORM_INPUT_TAGS.has(el.tagName) && el.isVisible
  );

  // --- Small input on mobile ---
  if (viewportType === "mobile" || viewportType === "tablet") {
    const smallInputs: Array<{ el: DomElement; height: number }> = [];

    for (const el of formInputs) {
      const height = Math.round(el.rect.height);
      if (height < 44) {
        smallInputs.push({ el, height });
      }
    }

    if (smallInputs.length > 0) {
      issues.push({
        category: "forms",
        severity: "warning",
        ruleId: "small-input-mobile",
        title: `${smallInputs.length} small form input(s) on ${viewportName}`,
        description: `Found ${smallInputs.length} form input(s) with height below 44px on a ${viewportType} viewport. Small inputs are hard to tap accurately on touchscreens.`,
        recommendation:
          "Set a minimum height of 44px on form inputs for mobile viewports to meet touch target guidelines.",
        details: {
          count: smallInputs.length,
          minHeight: 44,
          viewport: viewportName,
          viewportType,
        },
      });

      for (const { el, height } of smallInputs.slice(0, 5)) {
        issues.push({
          category: "forms",
          severity: "warning",
          ruleId: "small-input-mobile",
          title: `Small form input on ${viewportName}`,
          description: `<${el.tagName}${el.attributes.type ? ` type="${el.attributes.type}"` : ""}> has a height of ${height}px, below the recommended 44px minimum for ${viewportType}.`,
          elementSelector: el.selector,
          recommendation:
            "Increase the input height to at least 44px using min-height or padding.",
          details: {
            height,
            minHeight: 44,
            viewport: viewportName,
          },
        });
      }
    }
  }

  // --- Missing autocomplete ---
  const missingAutocomplete: DomElement[] = [];
  for (const el of formInputs) {
    if (el.tagName !== "input") continue;

    const inputType = el.attributes.type?.toLowerCase() ?? "text";
    if (!AUTOCOMPLETE_INPUT_TYPES.has(inputType)) continue;

    if (!el.attributes.autocomplete) {
      missingAutocomplete.push(el);
    }
  }

  if (missingAutocomplete.length > 0) {
    issues.push({
      category: "forms",
      severity: "info",
      ruleId: "missing-autocomplete",
      title: `${missingAutocomplete.length} input(s) missing autocomplete attribute on ${viewportName}`,
      description: `Found ${missingAutocomplete.length} text-like input(s) without an autocomplete attribute. Autocomplete helps users fill forms faster and reduces errors, especially on mobile.`,
      recommendation:
        "Add appropriate autocomplete values (e.g., autocomplete=\"email\", autocomplete=\"name\", autocomplete=\"tel\") to help browsers auto-fill user information.",
      details: {
        count: missingAutocomplete.length,
        viewport: viewportName,
      },
    });

    for (const el of missingAutocomplete.slice(0, 5)) {
      const inputType = el.attributes.type ?? "text";
      const suggestedValue = suggestAutocomplete(inputType, el.attributes);
      issues.push({
        category: "forms",
        severity: "info",
        ruleId: "missing-autocomplete",
        title: `Missing autocomplete on ${viewportName}`,
        description: `<input type="${inputType}"> is missing the autocomplete attribute.`,
        elementSelector: el.selector,
        recommendation: suggestedValue
          ? `Add autocomplete="${suggestedValue}" to this input.`
          : "Add an appropriate autocomplete value to this input.",
        details: {
          type: inputType,
          suggestedAutocomplete: suggestedValue,
          viewport: viewportName,
        },
      });
    }
  }

  return issues;
}

function suggestAutocomplete(
  inputType: string,
  attributes: Record<string, string>
): string | null {
  // Try to guess from type
  if (inputType === "email") return "email";
  if (inputType === "tel") return "tel";
  if (inputType === "password") return "current-password";
  if (inputType === "url") return "url";

  // Try to guess from name/id/placeholder attributes
  const nameHints = [
    attributes.name,
    attributes.id,
    attributes.placeholder,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/email/.test(nameHints)) return "email";
  if (/phone|tel/.test(nameHints)) return "tel";
  if (/name/.test(nameHints)) return "name";
  if (/address|street/.test(nameHints)) return "street-address";
  if (/city/.test(nameHints)) return "address-level2";
  if (/zip|postal/.test(nameHints)) return "postal-code";
  if (/country/.test(nameHints)) return "country-name";
  if (/search|query/.test(nameHints)) return "off";

  return null;
}
