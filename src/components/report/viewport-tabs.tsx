"use client";

import { useState, useRef, useCallback } from "react";
import type { ViewportResult, AuditIssue } from "@/lib/types";
import type { Annotation } from "@/lib/annotations/mapper";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { IssueCard, type ElementScreenshotData } from "@/components/report/issue-card";
import { AnnotationOverlay } from "@/components/report/annotation-overlay";
import { ScreenshotGallery, ScreenshotThumbnail } from "@/components/report/screenshot-gallery";
import { Monitor, Tablet, Smartphone, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const issueRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  if (viewportResults.length === 0) {
    return <p className="text-base text-muted-foreground text-center py-8">No viewport results available.</p>;
  }

  // Build issue maps
  const issuesByViewport = new Map<string, AuditIssue[]>();
  for (const vr of viewportResults) issuesByViewport.set(vr.viewportName, []);
  for (const issue of issues) {
    const vpName = issue.viewportName ?? (issue.details?.viewport as string | undefined);
    if (vpName && issuesByViewport.has(vpName)) issuesByViewport.get(vpName)!.push(issue);
  }

  function handleAnnotationClick(ann: Annotation) {
    setSelectedAnnotationId(ann.id === selectedAnnotationId ? null : ann.id);
    // Scroll to the corresponding issue
    const issueEl = issueRefs.current.get(ann.issueId);
    if (issueEl) {
      issueEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleIssueHover(issueId: string | null) {
    setHoveredIssueId(issueId);
    if (issueId) {
      // Find annotation for this issue and select it
      for (const anns of Object.values(annotationsByViewport ?? {})) {
        const ann = anns.find(a => a.issueId === issueId);
        if (ann) { setSelectedAnnotationId(ann.id); return; }
      }
    }
    setSelectedAnnotationId(null);
  }

  const defaultViewport = viewportResults[0].viewportName;

  return (
    <Tabs defaultValue={defaultViewport}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {viewportResults.map((vr) => {
            const DeviceIcon = getDeviceIcon(vr.width);
            const vpIssues = issuesByViewport.get(vr.viewportName) ?? [];
            return (
              <TabsTrigger key={vr.viewportName} value={vr.viewportName} className="text-sm">
                <DeviceIcon className="size-3.5" />
                {vr.viewportName}
                {vpIssues.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-sm">{vpIssues.length}</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <Button variant="ghost" size="sm" onClick={() => setShowAnnotations(!showAnnotations)}>
          {showAnnotations ? <><EyeOff className="size-3.5 mr-1" />Hide</> : <><Eye className="size-3.5 mr-1" />Show</>}
        </Button>
      </div>

      {viewportResults.map((vr) => {
        const vpIssues = issuesByViewport.get(vr.viewportName) ?? [];
        const vpAnnotations = annotationsByViewport?.[vr.viewportName] ?? [];
        const annotationNumberByIssueId = new Map<string, number>();
        for (const ann of vpAnnotations) annotationNumberByIssueId.set(ann.issueId, ann.number);

        // Build element screenshot data for each annotated issue
        const elementScreenshotByIssueId = new Map<string, ElementScreenshotData>();
        for (const ann of vpAnnotations) {
          if (ann.rect.width > 0 && ann.rect.height > 0) {
            elementScreenshotByIssueId.set(ann.issueId, {
              screenshotPath: vr.screenshotPath,
              screenshotWidth: vr.screenshotWidth ?? vr.width,
              screenshotHeight: vr.screenshotHeight ?? vr.height * 6,
              elementRect: ann.rect,
            });
          }
        }

        // Find which annotation corresponds to hovered issue
        const hoveredAnnotationId = hoveredIssueId
          ? vpAnnotations.find(a => a.issueId === hoveredIssueId)?.id ?? null
          : selectedAnnotationId;

        return (
          <TabsContent key={vr.viewportName} value={vr.viewportName}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LEFT: Annotated Screenshot */}
              <div className="rounded-lg border bg-muted/30 overflow-hidden">
                <div className="px-3 py-2 border-b bg-card flex items-center justify-between">
                  <p className="text-base font-medium">
                    {vr.viewportName} <span className="text-muted-foreground font-normal">({vr.width}x{vr.height})</span>
                  </p>
                </div>
                <ScreenshotGallery galleryId={`vp-split-${vr.viewportName.replace(/\s+/g, "-")}`}>
                  <div className="relative max-h-[700px] overflow-y-auto">
                    <ScreenshotThumbnail
                      src={vr.screenshotPath}
                      alt={`Screenshot at ${vr.viewportName}`}
                      className="w-full h-auto"
                      estimatedWidth={vr.screenshotWidth ?? vr.width * 2}
                      estimatedHeight={vr.screenshotHeight ?? vr.height * 6}
                    />
                    {showAnnotations && vpAnnotations.length > 0 && (
                      <AnnotationOverlay
                        annotations={vpAnnotations}
                        screenshotWidth={vr.screenshotWidth ?? vr.width}
                        screenshotHeight={vr.screenshotHeight ?? vr.height * 6}
                        selectedId={hoveredAnnotationId}
                        onAnnotationClick={handleAnnotationClick}
                      />
                    )}
                  </div>
                </ScreenshotGallery>
              </div>

              {/* RIGHT: Issue List */}
              <div className="max-h-[700px] overflow-y-auto space-y-3">
                <p className="text-base font-medium sticky top-0 bg-background py-2 z-10 border-b">
                  Issues ({vpIssues.length})
                </p>
                {vpIssues.length === 0 ? (
                  <p className="text-base text-muted-foreground py-8 text-center">
                    No issues detected for this viewport.
                  </p>
                ) : (
                  vpIssues.map((issue) => (
                    <div
                      key={issue.id}
                      ref={(el) => { if (el) issueRefs.current.set(issue.id, el); }}
                      onMouseEnter={() => handleIssueHover(issue.id)}
                      onMouseLeave={() => handleIssueHover(null)}
                    >
                      <IssueCard
                        issue={issue}
                        annotationNumber={annotationNumberByIssueId.get(issue.id)}
                        isHighlighted={hoveredIssueId === issue.id || selectedAnnotationId === vpAnnotations.find(a => a.issueId === issue.id)?.id}
                        elementScreenshot={elementScreenshotByIssueId.get(issue.id)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
