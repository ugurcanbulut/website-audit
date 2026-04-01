import Link from "next/link";
import {
  ExternalLink,
  Ban,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/report/score-badge";

interface ScanCardProps {
  scan: {
    id: string;
    url: string;
    status: string;
    overallScore: number | null;
    overallGrade: string | null;
    aiEnabled: boolean;
    aiProvider: string | null;
    createdAt: Date;
    completedAt: Date | null;
    error: string | null;
  };
}

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-3 w-3" />,
    color: "bg-muted text-muted-foreground",
  },
  scanning: {
    label: "Scanning",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "bg-blue-100 text-blue-800",
  },
  auditing: {
    label: "Auditing",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "bg-blue-100 text-blue-800",
  },
  analyzing: {
    label: "AI Analysis",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "bg-purple-100 text-purple-800",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: "bg-green-100 text-green-800",
  },
  failed: {
    label: "Failed",
    icon: <AlertCircle className="h-3 w-3" />,
    color: "bg-red-100 text-red-800",
  },
  cancelled: {
    label: "Cancelled",
    icon: <Ban className="h-3 w-3" />,
    color: "bg-muted text-muted-foreground",
  },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function ScanCard({ scan }: ScanCardProps) {
  const status = statusConfig[scan.status] ?? statusConfig.pending;
  const hostname = (() => {
    try {
      return new URL(scan.url).hostname;
    } catch {
      return scan.url;
    }
  })();

  return (
    <Link href={`/scan/${scan.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{hostname}</CardTitle>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {scan.url}
              </p>
            </div>
            {scan.status === "completed" &&
              scan.overallScore !== null &&
              scan.overallGrade && (
                <ScoreBadge
                  score={scan.overallScore}
                  grade={scan.overallGrade as "A" | "B" | "C" | "D" | "F"}
                  size="sm"
                />
              )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-base">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${status.color}`}
            >
              {status.icon}
              {status.label}
            </span>
            {scan.aiEnabled && (
              <Badge variant="outline" className="text-sm">
                AI: {scan.aiProvider === "claude" ? "Claude" : "OpenAI"}
              </Badge>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {formatTimeAgo(scan.createdAt)}
            </span>
          </div>
          {scan.status === "failed" && scan.error && (
            <p className="text-sm text-destructive mt-2 truncate">
              {scan.error}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
