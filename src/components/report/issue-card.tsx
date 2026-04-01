import { cn } from "@/lib/utils";
import type { AuditIssue } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { ElementScreenshot } from "@/components/report/element-screenshot";
import { GenerateFixButton } from "@/components/report/generate-fix-button";

const severityConfig: Record<
  string,
  { color: string; bgColor: string; icon: typeof AlertTriangle; label: string }
> = {
  critical: {
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    icon: AlertCircle,
    label: "Critical",
  },
  warning: {
    color: "text-yellow-700 dark:text-yellow-400",
    bgColor: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
    icon: AlertTriangle,
    label: "Warning",
  },
  info: {
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    icon: Info,
    label: "Info",
  },
  pass: {
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    icon: Info,
    label: "Pass",
  },
};

export interface ElementScreenshotData {
  screenshotPath: string;
  screenshotWidth: number;
  screenshotHeight: number;
  elementRect: { x: number; y: number; width: number; height: number };
}

interface IssueCardProps {
  issue: AuditIssue;
  annotationNumber?: number;
  isHighlighted?: boolean;
  elementScreenshot?: ElementScreenshotData;
}

export function IssueCard({ issue, annotationNumber, isHighlighted, elementScreenshot }: IssueCardProps) {
  const config = severityConfig[issue.severity] ?? severityConfig.info;
  const Icon = config.icon;
  const viewportName =
    issue.viewportName ??
    (issue.details?.viewportName as string | undefined);

  const annotationBadgeColor: Record<string, string> = {
    critical: "bg-red-500 text-white",
    warning: "bg-amber-500 text-white",
    info: "bg-blue-500 text-white",
    pass: "bg-green-500 text-white",
  };

  return (
    <Card
      size="sm"
      className={cn(
        isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          {annotationNumber != null && (
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full size-6 text-sm font-bold shrink-0 mt-0.5",
                annotationBadgeColor[issue.severity] ?? "bg-blue-500 text-white",
              )}
            >
              {annotationNumber}
            </span>
          )}
          <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", config.color)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-sm font-medium",
                  config.bgColor,
                )}
              >
                {config.label}
              </span>
              {viewportName && (
                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-sm font-medium text-muted-foreground">
                  {viewportName}
                </span>
              )}
            </div>
            <CardTitle className="text-base">{issue.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-base text-muted-foreground">{issue.description}</p>

        {issue.elementSelector && (
          <div className="rounded-md bg-muted px-3 py-2">
            <p className="text-sm text-muted-foreground mb-1">
              Element selector
            </p>
            <code className="text-sm font-mono break-all">
              {issue.elementSelector}
            </code>
          </div>
        )}

        {elementScreenshot && (
          <ElementScreenshot
            screenshotPath={elementScreenshot.screenshotPath}
            screenshotWidth={elementScreenshot.screenshotWidth}
            screenshotHeight={elementScreenshot.screenshotHeight}
            elementRect={elementScreenshot.elementRect}
          />
        )}

        {issue.recommendation && (
          <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
            <p className="text-sm font-medium text-primary mb-1">
              Recommendation
            </p>
            <p className="text-sm text-muted-foreground">
              {issue.recommendation}
            </p>
          </div>
        )}

        {/* Generate Fix button for accessibility issues with HTML but no existing fix */}
        {issue.category === "accessibility" && issue.elementHtml && !issue.details?.codeFix && (
          <GenerateFixButton issueId={issue.id} />
        )}

        {/* Code fix (from AI analysis) */}
        {(() => {
          const cf = issue.details?.codeFix;
          if (!cf || typeof cf !== "object") return null;
          const fix = cf as { before?: string; after?: string; language?: string };
          if (!fix.before || !fix.after) return null;
          return (
            <div className="rounded-md border overflow-hidden">
              <div className="px-3 py-1.5 bg-muted text-sm font-medium border-b">
                Suggested Fix ({fix.language ?? "html"})
              </div>
              <div className="grid grid-cols-2 divide-x text-sm font-mono">
                <div className="p-2 bg-red-50/50 dark:bg-red-950/20">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-1 font-sans font-medium">Before</p>
                  <pre className="whitespace-pre-wrap break-all text-sm">{fix.before}</pre>
                </div>
                <div className="p-2 bg-green-50/50 dark:bg-green-950/20">
                  <p className="text-sm text-green-600 dark:text-green-400 mb-1 font-sans font-medium">After</p>
                  <pre className="whitespace-pre-wrap break-all text-sm">{fix.after}</pre>
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
