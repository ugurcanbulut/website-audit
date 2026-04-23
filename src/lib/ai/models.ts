// ─────────────────────────────────────────────────────────────────────────────
// Model identifiers — overridable from environment, sensible defaults below.
// Never hardcode model strings elsewhere in the codebase. When a customer
// ships to production with a different model tier, they change env vars only.
//
// Defaults chosen 2026-04: balance cost and capability per MASTER_AUDIT_2026.md
// §7.2.4. Values are passed as-is to the provider SDKs.
// ─────────────────────────────────────────────────────────────────────────────

export const ANTHROPIC_VISION_MODEL =
  process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-5";

export const ANTHROPIC_REMEDIATION_MODEL =
  process.env.ANTHROPIC_REMEDIATION_MODEL ||
  process.env.ANTHROPIC_VISION_MODEL ||
  "claude-haiku-4-5";

export const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || "gpt-5";

export const OPENAI_REMEDIATION_MODEL =
  process.env.OPENAI_REMEDIATION_MODEL ||
  process.env.OPENAI_VISION_MODEL ||
  "gpt-5-mini";

// Max output tokens. Analysis benefits from headroom; remediation is short.
export const AI_ANALYSIS_MAX_TOKENS = Number(
  process.env.AI_ANALYSIS_MAX_TOKENS || "8192",
);
export const AI_REMEDIATION_MAX_TOKENS = Number(
  process.env.AI_REMEDIATION_MAX_TOKENS || "2048",
);
