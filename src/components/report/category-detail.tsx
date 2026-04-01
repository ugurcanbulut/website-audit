"use client";

import { useState } from "react";
import type { AuditIssue, AuditCategory, IssueSeverity, Grade } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IssueCard } from "@/components/report/issue-card";
import { ScoreBadge } from "@/components/report/score-badge";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  pass: 3,
};

function getGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

const categoryLabels: Record<string, string> = {
  accessibility: "Accessibility",
  responsive: "Responsive Design",
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

interface CategoryDetailProps {
  category: AuditCategory;
  score: number;
  issues: AuditIssue[];
  issueCount: {
    critical: number;
    warning: number;
    info: number;
  };
}

type FilterSeverity = "all" | IssueSeverity;

export function CategoryDetail({
  category,
  score,
  issues,
  issueCount,
}: CategoryDetailProps) {
  const [filter, setFilter] = useState<FilterSeverity>("all");
  const grade = getGrade(score);
  const label = categoryLabels[category] ?? category;

  const filteredIssues = (
    filter === "all" ? issues : issues.filter((i) => i.severity === filter)
  ).sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  const totalIssues = issueCount.critical + issueCount.warning + issueCount.info;

  return (
    <section id={`category-${category}`} className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{label}</h3>
          <ScoreBadge score={score} grade={grade} size="sm" />
        </div>
        <p className="text-base text-muted-foreground">
          {totalIssues} {totalIssues === 1 ? "issue" : "issues"} found
        </p>
      </div>

      <Tabs defaultValue="all" onValueChange={(v) => setFilter(v as FilterSeverity)}>
        <TabsList>
          <TabsTrigger value="all">
            All ({totalIssues})
          </TabsTrigger>
          {issueCount.critical > 0 && (
            <TabsTrigger value="critical">
              Critical ({issueCount.critical})
            </TabsTrigger>
          )}
          {issueCount.warning > 0 && (
            <TabsTrigger value="warning">
              Warning ({issueCount.warning})
            </TabsTrigger>
          )}
          {issueCount.info > 0 && (
            <TabsTrigger value="info">
              Info ({issueCount.info})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Single content panel -- we manually filter */}
        <TabsContent value={filter}>
          <div className="space-y-3 mt-3">
            {filteredIssues.length === 0 ? (
              <p className="text-base text-muted-foreground py-6 text-center">
                No {filter === "all" ? "" : filter} issues in this category.
              </p>
            ) : (
              filteredIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
