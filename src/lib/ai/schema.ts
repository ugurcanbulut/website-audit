import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shared contract between Claude tool_use and OpenAI response_format:json_schema
// so a single zod validator handles both providers and server-side parsing
// is uniform.
// ─────────────────────────────────────────────────────────────────────────────

export const aiIssueSchema = z.object({
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string().min(1),
  description: z.string(),
  recommendation: z.string(),
  viewport: z.string(),
  region: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .nullable()
    .optional(),
  codeFix: z
    .object({
      before: z.string(),
      after: z.string(),
      language: z.enum(["html", "css", "javascript"]),
    })
    .nullable()
    .optional(),
  wcagCriteria: z.array(z.string()).nullable().optional(),
});

export const aiAltTextSuggestionSchema = z.object({
  selector: z.string(),
  currentAlt: z.string().nullable(),
  suggestedAlt: z.string(),
  viewport: z.string(),
});

export const aiAnalysisOutputSchema = z.object({
  issues: z.array(aiIssueSchema),
  altTextSuggestions: z.array(aiAltTextSuggestionSchema).default([]),
  summary: z.string().default(""),
});

export type AiIssueStructured = z.infer<typeof aiIssueSchema>;
export type AiAltTextStructured = z.infer<typeof aiAltTextSuggestionSchema>;
export type AiAnalysisOutputStructured = z.infer<typeof aiAnalysisOutputSchema>;

// JSON Schema objects used directly by the provider APIs. Kept in sync with
// the zod schemas above by hand because the SDK requires strict JSON Schema
// (no anyOf-with-const-null tricks that zod-to-json-schema often emits).

export const AI_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["issues", "altTextSuggestions", "summary"],
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "severity",
          "title",
          "description",
          "recommendation",
          "viewport",
          "region",
          "codeFix",
          "wcagCriteria",
        ],
        properties: {
          severity: { type: "string", enum: ["critical", "warning", "info"] },
          title: { type: "string" },
          description: { type: "string" },
          recommendation: { type: "string" },
          viewport: { type: "string" },
          region: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["x", "y", "width", "height"],
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
          codeFix: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["before", "after", "language"],
            properties: {
              before: { type: "string" },
              after: { type: "string" },
              language: {
                type: "string",
                enum: ["html", "css", "javascript"],
              },
            },
          },
          wcagCriteria: {
            type: ["array", "null"],
            items: { type: "string" },
          },
        },
      },
    },
    altTextSuggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["selector", "currentAlt", "suggestedAlt", "viewport"],
        properties: {
          selector: { type: "string" },
          currentAlt: { type: ["string", "null"] },
          suggestedAlt: { type: "string" },
          viewport: { type: "string" },
        },
      },
    },
    summary: { type: "string" },
  },
} as const;

// Remediation (single-element fix) schema
export const aiRemediationSchema = z.object({
  fixedHtml: z.string(),
  explanation: z.string(),
});
export type AiRemediationStructured = z.infer<typeof aiRemediationSchema>;

export const AI_REMEDIATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fixedHtml", "explanation"],
  properties: {
    fixedHtml: { type: "string" },
    explanation: { type: "string" },
  },
} as const;
