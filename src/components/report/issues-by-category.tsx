"use client";

import type { AuditIssue, AuditCategory, CategoryScore } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/ui-constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoryDetail } from "./category-detail";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  pass: 3,
};

interface IssuesByCategoryProps {
  categoryScores: CategoryScore[];
  issuesByCategory: Record<string, AuditIssue[]>;
  initialCategory?: string;
}

export function IssuesByCategory({
  categoryScores,
  issuesByCategory,
  initialCategory,
}: IssuesByCategoryProps) {
  if (categoryScores.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <p className="text-base text-muted-foreground mb-2">No audit results yet.</p>
        <p className="text-sm text-muted-foreground">Issues will appear here once the audit engine completes.</p>
      </div>
    );
  }

  // Sort categories: those with most critical issues first, then by total issue count
  const sortedScores = [...categoryScores].sort((a, b) => {
    const aCrit = a.issueCount.critical;
    const bCrit = b.issueCount.critical;
    if (aCrit !== bCrit) return bCrit - aCrit;
    const aTotal = a.issueCount.critical + a.issueCount.warning + a.issueCount.info;
    const bTotal = b.issueCount.critical + b.issueCount.warning + b.issueCount.info;
    return bTotal - aTotal;
  });

  const defaultCat = initialCategory || sortedScores[0]?.category || "accessibility";

  return (
    <Tabs defaultValue={defaultCat}>
      <TabsList className="flex-wrap h-auto gap-1 p-1">
        {sortedScores.map((cs) => {
          const totalIssues = cs.issueCount.critical + cs.issueCount.warning + cs.issueCount.info;
          return (
            <TabsTrigger key={cs.category} value={cs.category} className="text-sm gap-1.5">
              {cs.issueCount.critical > 0 && <span className="size-2 rounded-full bg-red-500" />}
              {cs.issueCount.critical === 0 && cs.issueCount.warning > 0 && <span className="size-2 rounded-full bg-orange-500" />}
              {CATEGORY_LABELS[cs.category] ?? cs.category}
              {totalIssues > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-sm tabular-nums">
                  {totalIssues}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {sortedScores.map((cs) => {
        const issues = (issuesByCategory[cs.category] ?? []).sort(
          (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
        );
        return (
          <TabsContent key={cs.category} value={cs.category}>
            <CategoryDetail
              category={cs.category as AuditCategory}
              score={cs.score}
              issues={issues}
              issueCount={cs.issueCount}
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
