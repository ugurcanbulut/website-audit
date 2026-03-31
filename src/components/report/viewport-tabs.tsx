"use client";

import type { ViewportResult, AuditIssue } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IssueCard } from "@/components/report/issue-card";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { ScreenshotGallery, ScreenshotThumbnail } from "@/components/report/screenshot-gallery";

function getDeviceIcon(width: number) {
  if (width >= 1024) return Monitor;
  if (width >= 768) return Tablet;
  return Smartphone;
}

interface ViewportTabsProps {
  viewportResults: ViewportResult[];
  issues: AuditIssue[];
}

export function ViewportTabs({ viewportResults, issues }: ViewportTabsProps) {
  if (viewportResults.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
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
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-xs tabular-nums">
                  {vpIssues.length}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {viewportResults.map((vr) => {
        const vpIssues = issuesByViewport.get(vr.viewportName) ?? [];
        const alt = `Screenshot at ${vr.viewportName} (${vr.width}x${vr.height})`;

        return (
          <TabsContent key={vr.viewportName} value={vr.viewportName}>
            <div className="space-y-6 mt-4">
              {/* Screenshot */}
              <ScreenshotGallery
                galleryId={`screenshots-vp-${vr.viewportName.replace(/\s+/g, "-")}`}
              >
                <div className="rounded-md border bg-muted overflow-hidden">
                  <div className="px-3 py-2 border-b bg-card flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {vr.viewportName}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({vr.width} x {vr.height})
                      </span>
                    </p>
                  </div>
                  <ScreenshotThumbnail
                    src={vr.screenshotPath}
                    alt={alt}
                    className="w-full h-auto object-contain max-h-[600px]"
                    estimatedWidth={vr.width * 2}
                    estimatedHeight={vr.height * 6}
                  />
                </div>
              </ScreenshotGallery>

              {/* Issues for this viewport */}
              <div>
                <h4 className="text-sm font-medium mb-3">
                  Issues ({vpIssues.length})
                </h4>
                {vpIssues.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No issues detected for this viewport.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {vpIssues.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} />
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
