"use client";

import { useMemo, useRef, useState } from "react";
import type { ViewportResult, AuditIssue, IssueSeverity } from "@/lib/types";
import type { Annotation } from "@/lib/annotations/mapper";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  IssueCard,
  type ElementScreenshotData,
} from "@/components/report/issue-card";
import { AnnotationOverlay } from "@/components/report/annotation-overlay";
import {
  ScreenshotGallery,
  ScreenshotThumbnail,
} from "@/components/report/screenshot-gallery";
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  EyeOff,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/ui-constants";

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

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  pass: 3,
};

type SeverityFilter = "all" | IssueSeverity;

export function ViewportTabs({
  viewportResults,
  issues,
  annotationsByViewport,
}: ViewportTabsProps) {
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null,
  );
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const issueRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  if (viewportResults.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <p className="text-base text-muted-foreground mb-2">
          No viewport results available.
        </p>
        <p className="text-sm text-muted-foreground">
          Results will appear here once the scan completes.
        </p>
      </div>
    );
  }

  const issuesByViewport = new Map<string, AuditIssue[]>();
  for (const vr of viewportResults) issuesByViewport.set(vr.viewportName, []);
  for (const issue of issues) {
    const vpName =
      issue.viewportName ?? (issue.details?.viewport as string | undefined);
    if (vpName && issuesByViewport.has(vpName))
      issuesByViewport.get(vpName)!.push(issue);
  }

  function handleAnnotationClick(ann: Annotation) {
    setSelectedAnnotationId(ann.id === selectedAnnotationId ? null : ann.id);
    // Expand the category the issue lives in so it is scrollable into view.
    const issue = issues.find((i) => i.id === ann.issueId);
    if (issue) {
      setCollapsedCategories((prev) => {
        const next = new Set(prev);
        next.delete(issue.category);
        return next;
      });
    }
    const issueEl = issueRefs.current.get(ann.issueId);
    if (issueEl) {
      issueEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleIssueHover(issueId: string | null) {
    setHoveredIssueId(issueId);
    if (issueId) {
      for (const anns of Object.values(annotationsByViewport ?? {})) {
        const ann = anns.find((a) => a.issueId === issueId);
        if (ann) {
          setSelectedAnnotationId(ann.id);
          return;
        }
      }
    }
    setSelectedAnnotationId(null);
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
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
              <TabsTrigger
                key={vr.viewportName}
                value={vr.viewportName}
                className="text-sm"
              >
                <DeviceIcon className="size-3.5" />
                {vr.viewportName}
                {vpIssues.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-sm">
                    {vpIssues.length}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAnnotations(!showAnnotations)}
          aria-label={
            showAnnotations ? "Hide annotations" : "Show annotations"
          }
          aria-expanded={showAnnotations}
        >
          {showAnnotations ? (
            <>
              <EyeOff className="size-3.5 mr-1" />
              Hide
            </>
          ) : (
            <>
              <Eye className="size-3.5 mr-1" />
              Show
            </>
          )}
        </Button>
      </div>

      {viewportResults.map((vr) => {
        const vpIssues = issuesByViewport.get(vr.viewportName) ?? [];
        const vpAnnotations = annotationsByViewport?.[vr.viewportName] ?? [];
        const annotationNumberByIssueId = new Map<string, number>();
        for (const ann of vpAnnotations)
          annotationNumberByIssueId.set(ann.issueId, ann.number);

        const elementScreenshotByIssueId = new Map<
          string,
          ElementScreenshotData
        >();
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

        const hoveredAnnotationId = hoveredIssueId
          ? vpAnnotations.find((a) => a.issueId === hoveredIssueId)?.id ?? null
          : selectedAnnotationId;

        return (
          <TabsContent key={vr.viewportName} value={vr.viewportName}>
            <ViewportPanel
              vr={vr}
              vpIssues={vpIssues}
              vpAnnotations={vpAnnotations}
              showAnnotations={showAnnotations}
              hoveredAnnotationId={hoveredAnnotationId}
              selectedAnnotationId={selectedAnnotationId}
              hoveredIssueId={hoveredIssueId}
              annotationNumberByIssueId={annotationNumberByIssueId}
              elementScreenshotByIssueId={elementScreenshotByIssueId}
              severityFilter={severityFilter}
              setSeverityFilter={setSeverityFilter}
              collapsedCategories={collapsedCategories}
              toggleCategory={toggleCategory}
              onAnnotationClick={handleAnnotationClick}
              onIssueHover={handleIssueHover}
              issueRefs={issueRefs}
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

interface ViewportPanelProps {
  vr: ViewportResult;
  vpIssues: AuditIssue[];
  vpAnnotations: Annotation[];
  showAnnotations: boolean;
  hoveredAnnotationId: string | null;
  selectedAnnotationId: string | null;
  hoveredIssueId: string | null;
  annotationNumberByIssueId: Map<string, number>;
  elementScreenshotByIssueId: Map<string, ElementScreenshotData>;
  severityFilter: SeverityFilter;
  setSeverityFilter: (s: SeverityFilter) => void;
  collapsedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  onAnnotationClick: (ann: Annotation) => void;
  onIssueHover: (id: string | null) => void;
  issueRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function ViewportPanel(props: ViewportPanelProps) {
  const {
    vr,
    vpIssues,
    vpAnnotations,
    showAnnotations,
    hoveredAnnotationId,
    selectedAnnotationId,
    hoveredIssueId,
    annotationNumberByIssueId,
    elementScreenshotByIssueId,
    severityFilter,
    setSeverityFilter,
    collapsedCategories,
    toggleCategory,
    onAnnotationClick,
    onIssueHover,
    issueRefs,
  } = props;

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: vpIssues.length,
      critical: 0,
      warning: 0,
      info: 0,
    };
    for (const i of vpIssues) {
      if (i.severity === "critical") c.critical++;
      else if (i.severity === "warning") c.warning++;
      else if (i.severity === "info") c.info++;
    }
    return c;
  }, [vpIssues]);

  const filteredIssues = useMemo(() => {
    return severityFilter === "all"
      ? vpIssues
      : vpIssues.filter((i) => i.severity === severityFilter);
  }, [vpIssues, severityFilter]);

  // Group by category, sort categories by highest-severity-count first.
  const grouped = useMemo(() => {
    const map = new Map<string, AuditIssue[]>();
    for (const issue of filteredIssues) {
      const list = map.get(issue.category) ?? [];
      list.push(issue);
      map.set(issue.category, list);
    }
    // Sort issues within category by severity.
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 9) -
          (SEVERITY_ORDER[b.severity] ?? 9),
      );
    }
    // Sort categories by severity weight desc.
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const weight = (list: AuditIssue[]) =>
        list.reduce(
          (s, i) =>
            s +
            (i.severity === "critical" ? 15 : i.severity === "warning" ? 5 : 1),
          0,
        );
      return weight(b) - weight(a);
    });
  }, [filteredIssues]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* LEFT: Annotated Screenshot. Outer div scrolls; inner div takes the
          image's natural height so the AnnotationOverlay SVG absolute-inset-0
          resolves to image-height (not 700px), preserving coordinates. */}
      <div className="rounded-lg border bg-muted/30 overflow-hidden">
        <div className="px-3 py-2 border-b bg-card flex items-center justify-between">
          <p className="text-base font-medium">
            {vr.viewportName}{" "}
            <span className="text-muted-foreground font-normal">
              ({vr.width}x{vr.height})
            </span>
          </p>
        </div>
        <ScreenshotGallery
          galleryId={`vp-split-${vr.viewportName.replace(/\s+/g, "-")}`}
        >
          <div className="max-h-[700px] overflow-y-auto overflow-x-hidden">
            <div className="relative">
              <ScreenshotThumbnail
                src={vr.screenshotPath}
                alt={`Screenshot at ${vr.viewportName}`}
                className="w-full h-auto block"
                estimatedWidth={vr.screenshotWidth ?? vr.width * 2}
                estimatedHeight={vr.screenshotHeight ?? vr.height * 6}
              />
              {showAnnotations && vpAnnotations.length > 0 && (
                <AnnotationOverlay
                  annotations={vpAnnotations}
                  screenshotWidth={vr.screenshotWidth ?? vr.width}
                  screenshotHeight={vr.screenshotHeight ?? vr.height * 6}
                  selectedId={hoveredAnnotationId}
                  onAnnotationClick={onAnnotationClick}
                />
              )}
            </div>
          </div>
        </ScreenshotGallery>
      </div>

      {/* RIGHT: Filterable, category-grouped issue list. */}
      <div className="flex flex-col max-h-[700px]">
        <div className="sticky top-0 bg-background/95 backdrop-blur-md z-10 pb-2 mb-2 border-b space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-base font-medium">
              Issues ({filteredIssues.length})
            </p>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(
              [
                ["all", `All (${counts.all})`],
                ["critical", `Critical (${counts.critical})`],
                ["warning", `Warning (${counts.warning})`],
                ["info", `Info (${counts.info})`],
              ] as Array<[SeverityFilter, string]>
            ).map(([value, label]) => {
              const count =
                value === "all" ? counts.all : (counts[value] ?? 0);
              if (value !== "all" && count === 0) return null;
              return (
                <button
                  key={value}
                  onClick={() => setSeverityFilter(value)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors",
                    severityFilter === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 space-y-3 pr-1">
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="size-8 text-emerald-500 mb-2" />
              <p className="text-base font-medium">No issues match</p>
              <p className="text-sm text-muted-foreground">
                Try a different severity filter.
              </p>
            </div>
          ) : (
            grouped.map(([category, categoryIssues]) => {
              const isCollapsed = collapsedCategories.has(category);
              const critCount = categoryIssues.filter(
                (i) => i.severity === "critical",
              ).length;
              return (
                <div
                  key={category}
                  className="rounded-lg border bg-card/40"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors rounded-t-lg"
                    aria-expanded={!isCollapsed}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isCollapsed ? (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {CATEGORY_LABELS[category] ?? category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {critCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="text-xs h-5"
                        >
                          {critCount} critical
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs h-5">
                        {categoryIssues.length}
                      </Badge>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="border-t p-2 space-y-2">
                      {categoryIssues.map((issue) => (
                        <div
                          key={issue.id}
                          ref={(el) => {
                            if (el) issueRefs.current.set(issue.id, el);
                          }}
                          tabIndex={0}
                          onMouseEnter={() => onIssueHover(issue.id)}
                          onMouseLeave={() => onIssueHover(null)}
                          onFocus={() => onIssueHover(issue.id)}
                          onBlur={() => onIssueHover(null)}
                        >
                          <IssueCard
                            issue={issue}
                            annotationNumber={annotationNumberByIssueId.get(
                              issue.id,
                            )}
                            isHighlighted={
                              hoveredIssueId === issue.id ||
                              selectedAnnotationId ===
                                vpAnnotations.find(
                                  (a) => a.issueId === issue.id,
                                )?.id
                            }
                            elementScreenshot={elementScreenshotByIssueId.get(
                              issue.id,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
