// ─────────────────────────────────────────────────────────────────────────────
// WCAG 2.2 Level A + AA success criteria — compliance matrix.
//
// Each criterion is mapped to the axe-core rules that automate it (when any).
// For a given scan we compute each criterion's status by looking at the
// audit_issues rows tagged with the matching axe rule IDs.
//
// Scope: all Level A + AA criteria (the enterprise-relevant set, required by
// EAA, ADA Title II, Section 508, EN 301 549). Level AAA is out of scope —
// enterprise regulations rarely require AAA.
//
// Sources:
//   - WCAG 2.2 spec: https://www.w3.org/TR/WCAG22/
//   - axe-core rule-to-wcag mapping: `violation.tags` include `wcag<crit>`
//     (e.g. wcag143 for criterion 1.4.3). This file encodes the mapping.
// ─────────────────────────────────────────────────────────────────────────────

export type WcagLevel = "A" | "AA";

export type ComplianceStatus =
  | "pass"
  | "fail"
  | "needs-review"
  | "not-applicable";

export interface WcagCriterion {
  /** Criterion number like "1.4.3" */
  id: string;
  /** Success criterion title */
  title: string;
  level: WcagLevel;
  /** Which WCAG Principle (1-4) this falls under */
  principle: "Perceivable" | "Operable" | "Understandable" | "Robust";
  /** axe-core rule IDs that automate this criterion (empty = manual only) */
  axeRuleIds: string[];
  /** Link to W3C understanding doc */
  understandingUrl: string;
}

export interface RegulatoryMapping {
  eaa: boolean; // European Accessibility Act
  adaTitleII: boolean; // US Americans with Disabilities Act Title II
  section508: boolean; // US Section 508
  en301549: boolean; // EN 301 549 (EU public sector)
}

// All Level A + AA criteria in 2.2 (new in 2.2 flagged in title) map to
// EAA / ADA Title II / Section 508 / EN 301 549 at Level AA. This is the
// default mapping — all four frameworks converge on "WCAG 2.1/2.2 AA".
const AA_ALL_FRAMEWORKS: RegulatoryMapping = {
  eaa: true,
  adaTitleII: true,
  section508: true,
  en301549: true,
};

export function regulatoryMappingFor(level: WcagLevel): RegulatoryMapping {
  if (level === "AA" || level === "A") return AA_ALL_FRAMEWORKS;
  return { eaa: false, adaTitleII: false, section508: false, en301549: false };
}

export const WCAG_22_AA_CRITERIA: WcagCriterion[] = [
  // ── Principle 1: Perceivable ────────────────────────────────────────────
  {
    id: "1.1.1",
    title: "Non-text Content",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: [
      "image-alt",
      "input-image-alt",
      "area-alt",
      "svg-img-alt",
      "object-alt",
      "role-img-alt",
    ],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content",
  },
  {
    id: "1.2.1",
    title: "Audio-only and Video-only (Prerecorded)",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/audio-only-and-video-only-prerecorded",
  },
  {
    id: "1.2.2",
    title: "Captions (Prerecorded)",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: ["video-caption"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded",
  },
  {
    id: "1.2.3",
    title: "Audio Description or Media Alternative (Prerecorded)",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/audio-description-or-media-alternative-prerecorded",
  },
  {
    id: "1.2.4",
    title: "Captions (Live)",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/captions-live",
  },
  {
    id: "1.2.5",
    title: "Audio Description (Prerecorded)",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded",
  },
  {
    id: "1.3.1",
    title: "Info and Relationships",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: [
      "aria-hidden-body",
      "definition-list",
      "dlitem",
      "heading-order",
      "label",
      "landmark-one-main",
      "list",
      "listitem",
      "table-duplicate-name",
      "td-headers-attr",
      "th-has-data-cells",
      "p-as-heading",
    ],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships",
  },
  {
    id: "1.3.2",
    title: "Meaningful Sequence",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence",
  },
  {
    id: "1.3.3",
    title: "Sensory Characteristics",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/sensory-characteristics",
  },
  {
    id: "1.3.4",
    title: "Orientation",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: ["css-orientation-lock"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/orientation",
  },
  {
    id: "1.3.5",
    title: "Identify Input Purpose",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: ["autocomplete-valid"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose",
  },
  {
    id: "1.4.1",
    title: "Use of Color",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: ["link-in-text-block"],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/use-of-color",
  },
  {
    id: "1.4.2",
    title: "Audio Control",
    level: "A",
    principle: "Perceivable",
    axeRuleIds: ["no-autoplay-audio"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/audio-control",
  },
  {
    id: "1.4.3",
    title: "Contrast (Minimum)",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: ["color-contrast"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum",
  },
  {
    id: "1.4.4",
    title: "Resize text",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: ["meta-viewport"],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/resize-text",
  },
  {
    id: "1.4.5",
    title: "Images of Text",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/images-of-text",
  },
  {
    id: "1.4.10",
    title: "Reflow",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: ["meta-viewport"],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/reflow",
  },
  {
    id: "1.4.11",
    title: "Non-text Contrast",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast",
  },
  {
    id: "1.4.12",
    title: "Text Spacing",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/text-spacing",
  },
  {
    id: "1.4.13",
    title: "Content on Hover or Focus",
    level: "AA",
    principle: "Perceivable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus",
  },

  // ── Principle 2: Operable ───────────────────────────────────────────────
  {
    id: "2.1.1",
    title: "Keyboard",
    level: "A",
    principle: "Operable",
    axeRuleIds: ["server-side-image-map"],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard",
  },
  {
    id: "2.1.2",
    title: "No Keyboard Trap",
    level: "A",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap",
  },
  {
    id: "2.1.4",
    title: "Character Key Shortcuts",
    level: "A",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts",
  },
  {
    id: "2.2.1",
    title: "Timing Adjustable",
    level: "A",
    principle: "Operable",
    axeRuleIds: ["meta-refresh"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable",
  },
  {
    id: "2.2.2",
    title: "Pause, Stop, Hide",
    level: "A",
    principle: "Operable",
    axeRuleIds: ["meta-refresh", "marquee", "blink"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide",
  },
  {
    id: "2.3.1",
    title: "Three Flashes or Below Threshold",
    level: "A",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold",
  },
  {
    id: "2.4.1",
    title: "Bypass Blocks",
    level: "A",
    principle: "Operable",
    axeRuleIds: ["bypass", "region"],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks",
  },
  {
    id: "2.4.2",
    title: "Page Titled",
    level: "A",
    principle: "Operable",
    axeRuleIds: ["document-title"],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/page-titled",
  },
  {
    id: "2.4.3",
    title: "Focus Order",
    level: "A",
    principle: "Operable",
    axeRuleIds: ["tabindex"],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order",
  },
  {
    id: "2.4.4",
    title: "Link Purpose (In Context)",
    level: "A",
    principle: "Operable",
    axeRuleIds: ["link-name"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context",
  },
  {
    id: "2.4.5",
    title: "Multiple Ways",
    level: "AA",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways",
  },
  {
    id: "2.4.6",
    title: "Headings and Labels",
    level: "AA",
    principle: "Operable",
    axeRuleIds: ["empty-heading", "label"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels",
  },
  {
    id: "2.4.7",
    title: "Focus Visible",
    level: "AA",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible",
  },
  {
    id: "2.4.11",
    title: "Focus Not Obscured (Minimum) — new in 2.2",
    level: "AA",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum",
  },
  {
    id: "2.5.1",
    title: "Pointer Gestures",
    level: "A",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures",
  },
  {
    id: "2.5.2",
    title: "Pointer Cancellation",
    level: "A",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation",
  },
  {
    id: "2.5.3",
    title: "Label in Name",
    level: "A",
    principle: "Operable",
    axeRuleIds: ["label-content-name-mismatch"],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/label-in-name",
  },
  {
    id: "2.5.4",
    title: "Motion Actuation",
    level: "A",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation",
  },
  {
    id: "2.5.7",
    title: "Dragging Movements — new in 2.2",
    level: "AA",
    principle: "Operable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements",
  },
  {
    id: "2.5.8",
    title: "Target Size (Minimum) — new in 2.2",
    level: "AA",
    principle: "Operable",
    axeRuleIds: ["target-size"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum",
  },

  // ── Principle 3: Understandable ─────────────────────────────────────────
  {
    id: "3.1.1",
    title: "Language of Page",
    level: "A",
    principle: "Understandable",
    axeRuleIds: ["html-has-lang", "html-lang-valid", "html-xml-lang-mismatch"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/language-of-page",
  },
  {
    id: "3.1.2",
    title: "Language of Parts",
    level: "AA",
    principle: "Understandable",
    axeRuleIds: ["valid-lang"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts",
  },
  {
    id: "3.2.1",
    title: "On Focus",
    level: "A",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/on-focus",
  },
  {
    id: "3.2.2",
    title: "On Input",
    level: "A",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/on-input",
  },
  {
    id: "3.2.3",
    title: "Consistent Navigation",
    level: "AA",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation",
  },
  {
    id: "3.2.4",
    title: "Consistent Identification",
    level: "AA",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification",
  },
  {
    id: "3.2.6",
    title: "Consistent Help — new in 2.2",
    level: "A",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/consistent-help",
  },
  {
    id: "3.3.1",
    title: "Error Identification",
    level: "A",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/error-identification",
  },
  {
    id: "3.3.2",
    title: "Labels or Instructions",
    level: "A",
    principle: "Understandable",
    axeRuleIds: [
      "label",
      "form-field-multiple-labels",
      "select-name",
    ],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions",
  },
  {
    id: "3.3.3",
    title: "Error Suggestion",
    level: "AA",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion",
  },
  {
    id: "3.3.4",
    title: "Error Prevention (Legal, Financial, Data)",
    level: "AA",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data",
  },
  {
    id: "3.3.7",
    title: "Redundant Entry — new in 2.2",
    level: "A",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry",
  },
  {
    id: "3.3.8",
    title: "Accessible Authentication (Minimum) — new in 2.2",
    level: "AA",
    principle: "Understandable",
    axeRuleIds: [],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum",
  },

  // ── Principle 4: Robust ─────────────────────────────────────────────────
  {
    id: "4.1.1",
    title: "Parsing (Obsolete in 2.2)",
    level: "A",
    principle: "Robust",
    axeRuleIds: [],
    understandingUrl: "https://www.w3.org/WAI/WCAG22/Understanding/parsing",
  },
  {
    id: "4.1.2",
    title: "Name, Role, Value",
    level: "A",
    principle: "Robust",
    axeRuleIds: [
      "aria-allowed-attr",
      "aria-command-name",
      "aria-dialog-name",
      "aria-hidden-focus",
      "aria-input-field-name",
      "aria-meter-name",
      "aria-progressbar-name",
      "aria-required-attr",
      "aria-required-children",
      "aria-required-parent",
      "aria-roles",
      "aria-roledescription",
      "aria-toggle-field-name",
      "aria-tooltip-name",
      "aria-treeitem-name",
      "aria-valid-attr",
      "aria-valid-attr-value",
      "button-name",
      "duplicate-id-aria",
      "input-button-name",
      "presentation-role-conflict",
      "role-img-alt",
    ],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value",
  },
  {
    id: "4.1.3",
    title: "Status Messages",
    level: "AA",
    principle: "Robust",
    axeRuleIds: ["aria-allowed-role"],
    understandingUrl:
      "https://www.w3.org/WAI/WCAG22/Understanding/status-messages",
  },
];

export interface CriterionResult {
  criterion: WcagCriterion;
  status: ComplianceStatus;
  failingRules: string[];
  passingRules: string[];
  affectedElementCount: number;
}

/**
 * Evaluate compliance per criterion given the scan's audit issues.
 * Decision policy:
 *   - If any of the mapped axe rules has one or more failing issues → fail
 *   - If the criterion has no mapped axe rules → needs-review (manual)
 *   - Otherwise → pass (automated checks did not find a violation; manual
 *     review may still find issues)
 */
export function evaluateCompliance(
  issues: Array<{
    category: string;
    ruleId: string;
    severity: string;
  }>,
): CriterionResult[] {
  // axe-core issues carry ruleId like "axe-image-alt"
  const failingAxeRules = new Set<string>();
  for (const issue of issues) {
    if (issue.category !== "accessibility") continue;
    if (issue.severity === "pass") continue;
    if (issue.ruleId.startsWith("axe-")) {
      failingAxeRules.add(issue.ruleId.replace(/^axe-/, ""));
    }
  }

  return WCAG_22_AA_CRITERIA.map((criterion) => {
    if (criterion.axeRuleIds.length === 0) {
      return {
        criterion,
        status: "needs-review" as ComplianceStatus,
        failingRules: [],
        passingRules: [],
        affectedElementCount: 0,
      };
    }

    const failing = criterion.axeRuleIds.filter((r) => failingAxeRules.has(r));
    const passing = criterion.axeRuleIds.filter(
      (r) => !failingAxeRules.has(r),
    );

    const status: ComplianceStatus = failing.length > 0 ? "fail" : "pass";

    const affectedElementCount = failing.reduce((sum, rule) => {
      return (
        sum +
        issues.filter(
          (i) =>
            i.category === "accessibility" &&
            i.ruleId === `axe-${rule}` &&
            i.severity !== "pass",
        ).length
      );
    }, 0);

    return {
      criterion,
      status,
      failingRules: failing,
      passingRules: passing,
      affectedElementCount,
    };
  });
}
