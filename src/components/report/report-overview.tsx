"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { CategoryScore, Grade } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/ui-constants";
import { ScoreBadge } from "@/components/report/score-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LighthouseGauges } from "@/components/report/lighthouse-gauges";

function getGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

interface ReportOverviewProps {
  overallScore: number;
  overallGrade: Grade;
  categoryScores: CategoryScore[];
  scanUrl: string;
  createdAt: string;
  lighthouseScores?: {
    performance?: number;
    accessibility?: number;
    bestPractices?: number;
    seo?: number;
  };
  browserEngine?: string;
}

export function ReportOverview({
  overallScore,
  overallGrade,
  categoryScores,
  scanUrl,
  createdAt,
  lighthouseScores,
  browserEngine,
}: ReportOverviewProps) {
  const radarData = categoryScores.map((cs) => ({
    category: CATEGORY_LABELS[cs.category] ?? cs.category,
    score: cs.score,
    fullMark: 100,
  }));

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* Score Header */}
      <div className="flex flex-col items-center text-center gap-4">
        <div className="grid gap-4 md:grid-cols-2 w-full">
          {/* Left: Overall score badge */}
          <Card>
            <CardContent className="flex items-center justify-center py-6">
              <ScoreBadge score={overallScore} grade={overallGrade} size="lg" />
            </CardContent>
          </Card>

          {/* Right: Lighthouse gauges */}
          {lighthouseScores && <LighthouseGauges scores={lighthouseScores} />}
        </div>
        <div>
          <p className="text-base text-muted-foreground break-all">{scanUrl}</p>
          {browserEngine && (
            <span className="inline-block mt-1 text-sm font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {browserEngine}
            </span>
          )}
          <p className="text-sm text-muted-foreground mt-1">{formattedDate}</p>
        </div>
      </div>

      {/* Radar Chart + Category Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar Chart */}
        {radarData.length >= 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Score Overview</CardTitle>
              <CardDescription>
                Performance across all audit categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickCount={5}
                    />
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Score Cards */}
        <div className="space-y-3">
          <h3 className="text-base font-medium text-muted-foreground">
            Category Breakdown
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {categoryScores.map((cs) => {
              const grade = getGrade(cs.score);
              const label = CATEGORY_LABELS[cs.category] ?? cs.category;
              const totalIssues =
                cs.issueCount.critical +
                cs.issueCount.warning +
                cs.issueCount.info;

              return (
                <div key={cs.category}>
                  <Card
                    size="sm"
                  >
                    <CardContent className="pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-medium">{label}</span>
                        <ScoreBadge score={cs.score} grade={grade} size="sm" />
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            cs.score >= 80
                              ? "bg-green-500"
                              : cs.score >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500",
                          )}
                          style={{ width: `${cs.score}%` }}
                        />
                      </div>
                      <div className="flex gap-3 text-sm text-muted-foreground">
                        {cs.issueCount.critical > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            {cs.issueCount.critical} critical
                          </span>
                        )}
                        {cs.issueCount.warning > 0 && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            {cs.issueCount.warning} warnings
                          </span>
                        )}
                        {cs.issueCount.info > 0 && (
                          <span>{cs.issueCount.info} info</span>
                        )}
                        {totalIssues === 0 && <span>No issues</span>}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
