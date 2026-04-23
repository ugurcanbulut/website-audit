import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";

// Prices in USD per 1M tokens. Updated 2026-04 per MASTER_AUDIT_2026.md §3.4.
// When a new model rolls out, add an entry. Unknown models default to zero cost
// (we still record token usage; cost stays null and dashboards show "unknown").
type PricePerMillion = { input: number; output: number };

const PRICES: Record<string, PricePerMillion> = {
  // Anthropic
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
  // OpenAI
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5.4": { input: 2.5, output: 15 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): number | null {
  const price = PRICES[model];
  if (!price) return null;
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  return (input * price.input) / 1_000_000 + (output * price.output) / 1_000_000;
}

export interface RecordUsageArgs {
  scanId?: string | null;
  provider: "claude" | "openai";
  model: string;
  operation: "analyze" | "remediate";
  inputTokens?: number | null;
  outputTokens?: number | null;
  imageTokens?: number | null;
  durationMs: number;
  errored?: boolean;
  errorMessage?: string | null;
}

export async function recordAiUsage(args: RecordUsageArgs): Promise<void> {
  try {
    const cost = args.errored
      ? null
      : estimateCostUsd(args.model, args.inputTokens, args.outputTokens);

    await db.insert(aiUsage).values({
      scanId: args.scanId ?? null,
      provider: args.provider,
      model: args.model,
      operation: args.operation,
      inputTokens: args.inputTokens ?? null,
      outputTokens: args.outputTokens ?? null,
      imageTokens: args.imageTokens ?? null,
      costUsd: cost != null ? cost.toFixed(6) : null,
      durationMs: args.durationMs,
      errored: args.errored ?? false,
      errorMessage: args.errorMessage ?? null,
    });
  } catch (e) {
    // Usage tracking must never block an AI response.
    console.warn(
      "Failed to record AI usage:",
      e instanceof Error ? e.message : e,
    );
  }
}
