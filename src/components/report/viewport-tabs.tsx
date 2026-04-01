"use client";

import type { ViewportResult, AuditIssue } from "@/lib/types";
import type { Annotation } from "@/lib/annotations/mapper";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IssueCard } from "@/components/report/issue-card";
import { AnnotatedScreenshot } from "@/components/report/annotated-screenshot";
import { Monitor, Tablet, Smartphone } from "lucide-react";

function getDeviceIcon(width: number) {
  if (width >= 1024) return Monitor;
  if (width >= 768) return Tablet;
  return Smartphone;
}

interface ViewportTabsProps {
  viewportResults: ViewportResult[];
  issues: AuditIssue[];
  annotationsByViewport?: Record<string, Annotation[]>;
}

export function ViewportTabs({ viewportResults, issues, annotationsByViewport }: ViewportTabsProps) {
  if (viewportResults.length === 0) {
    return (
      <p className="text-base text-muted-foreground text-center py-8">
        No viewport results available.
      </p>
    );
  }

  // Build a map of viewportName -> issues
  const issuesByViewport = new Map<string, AuditIssue[]>();
  for (const vr of viewportResults) {
    issuesByViewport.set(vr.viewportName, []);
  }
  for (const issue of issues) {
    const vpName =
      issue.viewportName ??
      (issue.details?.viewport as string | undefined);
    if (vpName && issuesByViewport.has(vpName)) {
      issuesByViewport.get(vpName)!.push(issue);
    }
  }

  const defaultViewport = viewportResults[0].viewportName;

  return (
    <Tabs defaultValue={defaultViewport}>
      <TabsList className="flex-wrap">
        {viewportResults.map((vr) => {
          const DeviceIcon = getDeviceIcon(vr.width);
          const vpIssues = issuesByViewport.get(vr.viewportName) ?? [];

          return (
            <TabsTrigger key={vr.viewportName} value={vr.viewportName}>
              <DeviceIcon className="h-3.5 w-3.5" />
              {vr.viewportName}
              {vpIssues.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-sm tabular-nums">
                  {vpIssues.length}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {viewportResults.map((vr) => {
        const vpIssues = issuesByViewport.get(vr.viewportName) ?? [];
        const vpAnnotations = annotationsByViewport?.[vr.viewportName] ?? [];
        // Build issue-id -> annotation number lookup for this viewport
        const annotationNumberByIssueId = new Map<string, number>();
        for (const ann of vpAnnotations) {
          annotationNumberByIssueId.set(ann.issueId, ann.number);
        }

        return (
          <TabsContent key={vr.viewportName} value={vr.viewportName}>
            <div className="space-y-6 mt-4">
              {/* Screenshot with annotations */}
              <AnnotatedScreenshot
                screenshotPath={vr.screenshotPath}
                viewportName={vr.viewportName}
                width={vr.width}
                height={vr.height}
                annotations={annotationsByViewport?.[vr.viewportName] ?? []}
                galleryId={`screenshots-vp-${vr.viewportName.replace(/\s+/g, "-")}`}
                screenshotWidth={vr.screenshotWidth}
                screenshotHeight={vr.screenshotHeight}
              />

              {/* Issues for this viewport */}
              <div>
                <h4 className="text-base font-medium mb-3">
                  Issues ({vpIssues.length})
                </h4>
                {vpIssues.length === 0 ? (
                  <p className="text-base text-muted-foreground py-4 text-center">
                    No issues detected for this viewport.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {vpIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        annotationNumber={annotationNumberByIssueId.get(issue.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
