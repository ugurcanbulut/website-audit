"use client";

import type { AuditIssue, AuditCategory, CategoryScore } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoryDetail } from "./category-detail";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  pass: 3,
};

const categoryLabels: Record<string, string> = {
  accessibility: "Accessibility",
  responsive: "Responsive",
  performance: "Performance",
  typography: "Typography",
  "touch-targets": "Touch Targets",
  forms: "Forms",
  visual: "Visual",
  seo: "SEO",
  "best-practices": "Best Practices",
  security: "Security",
  "html-quality": "HTML Quality",
  "css-quality": "CSS Quality",
  "ai-analysis": "AI Analysis",
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
  const defaultCat = initialCategory || categoryScores[0]?.category || "accessibility";

  if (categoryScores.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No category scores available.
      </p>
    );
  }

  return (
    <Tabs defaultValue={defaultCat}>
      <TabsList className="flex-wrap h-auto gap-1 p-1">
        {categoryScores.map((cs) => {
          const totalIssues = cs.issueCount.critical + cs.issueCount.warning + cs.issueCount.info;
          return (
            <TabsTrigger key={cs.category} value={cs.category} className="text-xs">
              {categoryLabels[cs.category] ?? cs.category}
              {totalIssues > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-xs tabular-nums">
                  {totalIssues}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {categoryScores.map((cs) => {
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
