/**
 * Per-scan suppression helpers.
 *
 * A suppression hides a finding from the report and excludes it from score
 * recomputation. Scope is a single scan (see the product decision): a row keys
 * on scanId + ruleId, with an optional elementSelector — null means "suppress
 * the whole finding" (every element of that rule), non-null means a single
 * element.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { suppressions } from "@/lib/db/schema";

export interface SuppressionRule {
  ruleId: string;
  elementSelector: string | null;
}

export async function loadSuppressions(
  scanId: string,
): Promise<SuppressionRule[]> {
  const rows = await db.query.suppressions.findMany({
    where: eq(suppressions.scanId, scanId),
  });
  return rows.map((r) => ({
    ruleId: r.ruleId,
    elementSelector: r.elementSelector ?? null,
  }));
}

/** A minimal issue shape the predicate needs. */
interface SuppressibleIssue {
  ruleId: string;
  elementSelector?: string | null;
}

/**
 * Build an `isSuppressed(issue)` predicate from a set of suppression rules.
 * An issue is suppressed when a rule matches its ruleId AND either suppresses
 * the whole finding (null selector) or names that exact element selector.
 */
export function makeSuppressionFilter(rules: SuppressionRule[]) {
  const byRule = new Map<string, { whole: boolean; selectors: Set<string> }>();
  for (const r of rules) {
    const entry = byRule.get(r.ruleId) ?? { whole: false, selectors: new Set<string>() };
    if (r.elementSelector == null) entry.whole = true;
    else entry.selectors.add(r.elementSelector);
    byRule.set(r.ruleId, entry);
  }

  return function isSuppressed(issue: SuppressibleIssue): boolean {
    const entry = byRule.get(issue.ruleId);
    if (!entry) return false;
    if (entry.whole) return true;
    return issue.elementSelector != null && entry.selectors.has(issue.elementSelector);
  };
}
