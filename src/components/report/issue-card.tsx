import { cn } from "@/lib/utils";
import type { AuditIssue } from "@/lib/types";
import { SEVERITY_COLORS } from "@/lib/ui-constants";
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
    color: SEVERITY_COLORS.critical.icon,
    bgColor: SEVERITY_COLORS.critical.badge,
    icon: AlertCircle,
    label: "Critical",
  },
  warning: {
    color: SEVERITY_COLORS.warning.icon,
    bgColor: SEVERITY_COLORS.warning.badge,
    icon: AlertTriangle,
    label: "Warning",
  },
  info: {
    color: SEVERITY_COLORS.info.icon,
    bgColor: SEVERITY_COLORS.info.badge,
    icon: Info,
    label: "Info",
  },
  pass: {
    color: SEVERITY_COLORS.pass.icon,
    bgColor: SEVERITY_COLORS.pass.badge,
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
              role="img"
              aria-label={`Annotation ${annotationNumber}`}
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
        <p className="text-sm text-muted-foreground">{issue.description}</p>

        {issue.elementSelector && (
          <div className="rounded-md bg-muted px-3 py-2">
            <p className="text-sm text-muted-foreground mb-1">
              Element selector
            </p>
            <code className="text-sm font-mono break-words">
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
                  <pre className="whitespace-pre-wrap break-words text-sm">{fix.before}</pre>
                </div>
                <div className="p-2 bg-green-50/50 dark:bg-green-950/20">
                  <p className="text-sm text-green-600 dark:text-green-400 mb-1 font-sans font-medium">After</p>
                  <pre className="whitespace-pre-wrap break-words text-sm">{fix.after}</pre>
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
