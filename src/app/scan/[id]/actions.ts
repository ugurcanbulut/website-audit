"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { suppressions } from "@/lib/db/schema";
import { calculateScores } from "@/lib/audit/scoring";

// Server actions for per-scan suppressions. These post to the page route (not
// /api/*), so they're outside the API bearer-token middleware, and
// revalidatePath re-renders the report with the recomputed score.

function matchClause(scanId: string, ruleId: string, elementSelector: string | null) {
  return and(
    eq(suppressions.scanId, scanId),
    eq(suppressions.ruleId, ruleId),
    elementSelector == null
      ? isNull(suppressions.elementSelector)
      : eq(suppressions.elementSelector, elementSelector),
  );
}

export async function suppressFinding(
  scanId: string,
  ruleId: string,
  elementSelector: string | null = null,
  reason?: string,
) {
  const existing = await db.query.suppressions.findFirst({
    where: matchClause(scanId, ruleId, elementSelector),
  });
  if (!existing) {
    await db.insert(suppressions).values({
      scanId,
      ruleId,
      elementSelector,
      reason: reason ?? null,
    });
    // Suppressed findings are excluded from the score, so recompute + persist.
    await calculateScores(scanId);
  }
  revalidatePath(`/scan/${scanId}`);
}

export async function unsuppressFinding(
  scanId: string,
  ruleId: string,
  elementSelector: string | null = null,
) {
  await db.delete(suppressions).where(matchClause(scanId, ruleId, elementSelector));
  await calculateScores(scanId);
  revalidatePath(`/scan/${scanId}`);
}
