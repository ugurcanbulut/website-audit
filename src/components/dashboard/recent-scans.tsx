import Link from "next/link";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Monitor,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { DeleteScanInline } from "@/components/scan/delete-scan-inline";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

interface Scan {
  id: string;
  url: string;
  status: string;
  overallScore: number | null;
  overallGrade: string | null;
  createdAt: Date;
}

interface RecentScansProps {
  scans: Scan[];
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "outline" },
  scanning: { label: "Scanning", variant: "secondary" },
  auditing: { label: "Auditing", variant: "secondary" },
  analyzing: { label: "Analyzing", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "scanning":
    case "auditing":
    case "analyzing":
      return <Loader2 className="size-3 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="size-3" />;
    case "failed":
      return <AlertCircle className="size-3" />;
    case "cancelled":
      return <Ban className="size-3" />;
    default:
      return <Clock className="size-3" />;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "text-green-600 dark:text-green-400";
    case "B":
      return "text-blue-600 dark:text-blue-400";
    case "C":
      return "text-yellow-600 dark:text-yellow-400";
    case "D":
      return "text-orange-600 dark:text-orange-400";
    case "F":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

export function RecentScans({ scans }: RecentScansProps) {
  if (scans.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Monitor className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No scans yet</h3>
            <p className="text-muted-foreground text-base mb-4 max-w-sm">
              Start by scanning a website to get a comprehensive UI/UX audit
              across multiple viewports.
            </p>
            <Link
              href="/scan/new"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Start Your First Scan
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Scans</CardTitle>
        <CardDescription>
          Your latest website audits and their results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="pb-2 pr-4 text-left font-medium">Site</th>
                <th className="pb-2 pr-4 text-left font-medium">Status</th>
                <th className="pb-2 pr-4 text-left font-medium">Score</th>
                <th className="pb-2 text-left font-medium">Date</th>
                <th className="pb-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const config = statusConfig[scan.status] ?? statusConfig.pending;
                return (
                  <tr key={scan.id} className="group border-b last:border-0">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/scan/${scan.id}`}
                        className="group-hover:underline font-medium"
                      >
                        {getHostname(scan.url)}
                      </Link>
                      <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                        {scan.url}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={config.variant} className="gap-1">
                        <StatusIcon status={scan.status} />
                        {config.label}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {scan.status === "completed" && scan.overallScore !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums font-medium">
                            {scan.overallScore}
                          </span>
                          {scan.overallGrade && (
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                getGradeColor(scan.overallGrade)
                              )}
                            >
                              {scan.overallGrade}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(scan.createdAt)}
                    </td>
                    <td className="py-3 text-right">
                      <DeleteScanInline scanId={scan.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
