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

  // Build a map of id -> elements for label association lookup
  const elementsById = new Map<string, DomElement>();
  for (const el of domSnapshot.elements) {
    if (el.attributes.id) {
      elementsById.set(el.attributes.id, el);
    }
  }

  // Collect all label elements with their `for` attribute
  const labelForIds = new Set<string>();
  for (const el of domSnapshot.elements) {
    if (el.tagName === "label" && el.attributes.for) {
      labelForIds.add(el.attributes.for);
    }
  }

  // --- Inputs without labels ---
  const unlabeledInputs: DomElement[] = [];
  for (const el of formInputs) {
    // Skip hidden inputs and submit/button types
    const inputType = el.attributes.type?.toLowerCase() ?? "";
    if (inputType === "hidden" || inputType === "submit" || inputType === "button") {
      continue;
    }

    const hasAriaLabel = !!el.attributes["aria-label"];
    const hasAriaLabelledBy = !!el.attributes["aria-labelledby"];
    const hasTitle = !!el.attributes.title;
    const hasAssociatedLabel = el.attributes.id
      ? labelForIds.has(el.attributes.id)
      : false;

    if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle && !hasAssociatedLabel) {
      unlabeledInputs.push(el);
    }
  }

  if (unlabeledInputs.length > 0) {
    issues.push({
      category: "forms",
      severity: "critical",
      ruleId: "input-no-label",
      title: `${unlabeledInputs.length} form input(s) without labels on ${viewportName}`,
      description: `Found ${unlabeledInputs.length} form input(s) lacking an associated label. Inputs without labels are inaccessible to screen readers and make forms harder to use for all users.`,
      recommendation:
        "Associate each input with a <label> element using the for/id pattern, or add an aria-label or aria-labelledby attribute.",
      details: {
        count: unlabeledInputs.length,
        viewport: viewportName,
      },
    });

    for (const el of unlabeledInputs.slice(0, 10)) {
      issues.push({
        category: "forms",
        severity: "critical",
        ruleId: "input-no-label",
        title: `Input without label on ${viewportName}`,
        description: `<${el.tagName}${el.attributes.type ? ` type="${el.attributes.type}"` : ""}> has no associated label, aria-label, or aria-labelledby attribute.`,
        elementSelector: el.selector,
        recommendation:
          "Add a <label for=\"...\"> element, or an aria-label attribute to describe the input's purpose.",
        details: {
          tagName: el.tagName,
          type: el.attributes.type ?? "text",
          viewport: viewportName,
        },
      });
    }
  }

  // --- Placeholder-only labels ---
  const placeholderOnlyInputs: DomElement[] = [];
  for (const el of formInputs) {
    const inputType = el.attributes.type?.toLowerCase() ?? "";
    if (inputType === "hidden" || inputType === "submit" || inputType === "button") {
      continue;
    }

    const hasPlaceholder = !!el.attributes.placeholder;
    const hasAriaLabel = !!el.attributes["aria-label"];
    const hasAriaLabelledBy = !!el.attributes["aria-labelledby"];
    const hasTitle = !!el.attributes.title;
    const hasAssociatedLabel = el.attributes.id
      ? labelForIds.has(el.attributes.id)
      : false;

    if (
      hasPlaceholder &&
      !hasAriaLabel &&
      !hasAriaLabelledBy &&
      !hasTitle &&
      !hasAssociatedLabel
    ) {
      placeholderOnlyInputs.push(el);
    }
  }

  if (placeholderOnlyInputs.length > 0) {
    issues.push({
      category: "forms",
      severity: "warning",
      ruleId: "placeholder-only",
      title: `${placeholderOnlyInputs.length} input(s) using placeholder as only label on ${viewportName}`,
      description: `Found ${placeholderOnlyInputs.length} input(s) that rely on placeholder text as their only label. Placeholders disappear when the user starts typing, making it easy to forget the field's purpose.`,
      recommendation:
        "Add a persistent visible label above or beside each input. Placeholders should supplement labels, not replace them.",
      details: {
        count: placeholderOnlyInputs.length,
        viewport: viewportName,
      },
    });

    for (const el of placeholderOnlyInputs.slice(0, 5)) {
      issues.push({
        category: "forms",
        severity: "warning",
        ruleId: "placeholder-only",
        title: `Placeholder used as only label on ${viewportName}`,
        description: `<${el.tagName}> uses placeholder="${el.attributes.placeholder}" as its only label. This text disappears on input focus, leaving users without context.`,
        elementSelector: el.selector,
        recommendation:
          "Add a visible <label> element. Keep the placeholder as supplementary hint text.",
        details: {
          placeholder: el.attributes.placeholder,
          viewport: viewportName,
        },
      });
    }
  }

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
