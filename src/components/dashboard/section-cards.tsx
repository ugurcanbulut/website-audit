import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SectionCardsProps {
  totalScans: number;
  completedScans: number;
  avgScore: number | null;
  totalIssues: number;
  criticalIssues: number;
}

export function SectionCards({
  totalScans,
  completedScans,
  avgScore,
  totalIssues,
  criticalIssues,
}: SectionCardsProps) {
  const scoreGrade =
    avgScore !== null
      ? avgScore >= 90
        ? "A"
        : avgScore >= 80
          ? "B"
          : avgScore >= 70
            ? "C"
            : avgScore >= 60
              ? "D"
              : "F"
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Scans</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalScans}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-base">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {completedScans} completed
          </div>
          <div className="text-muted-foreground">
            {totalScans - completedScans} in progress or failed
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Average Score</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {avgScore !== null ? avgScore : "--"}
          </CardTitle>
          {scoreGrade && (
            <div className="absolute right-4 top-4">
              <Badge variant="outline">
                {avgScore !== null && avgScore >= 70 ? (
                  <TrendingUp className="size-3" />
                ) : avgScore !== null ? (
                  <TrendingDown className="size-3" />
                ) : null}
                Grade {scoreGrade}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-base">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {avgScore !== null && avgScore >= 80
              ? "Good overall quality"
              : avgScore !== null
                ? "Room for improvement"
                : "No data yet"}
            {avgScore !== null && avgScore >= 80 && (
              <TrendingUp className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground">Across all completed scans</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Issues Found</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalIssues}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-base">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {criticalIssues} critical issues
            {criticalIssues > 0 && <TrendingDown className="size-4" />}
          </div>
          <div className="text-muted-foreground">
            Warnings and info included
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Scan Success Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalScans > 0
              ? `${Math.round((completedScans / totalScans) * 100)}%`
              : "--"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-base">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {totalScans > 0 && completedScans === totalScans
              ? "All scans completed"
              : totalScans > 0
                ? "Some scans pending"
                : "No scans yet"}
            {totalScans > 0 && completedScans === totalScans && (
              <TrendingUp className="size-4" />
            )}
          </div>
          <div className="text-muted-foreground">
            Completed vs total scans
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
