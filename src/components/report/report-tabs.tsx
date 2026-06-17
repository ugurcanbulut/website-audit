"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReportModeProvider, type ReportView } from "./report-mode";

interface ReportTabsProps {
  summaryContent: ReactNode;
  issuesContent: ReactNode;
  complianceContent: ReactNode;
  lighthouseContent?: ReactNode;
  screenshotsContent: ReactNode;
  viewportContent: ReactNode;
  issuesCount?: number;
  view?: ReportView;
}

// Direction D underline tabs: transparent strip over a hairline border,
// active item gets bold ink + 2px primary underline.
const triggerClass =
  "h-[42px] flex-none gap-1.5 rounded-none px-3.5 text-sm font-semibold text-muted-foreground -mb-px hover:text-foreground data-active:font-bold data-active:text-foreground after:bg-primary group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-[2px]";

function CountChip({ count }: { count: number }) {
  return (
    <span className="rounded-[5px] bg-secondary px-1.5 py-px text-[11px] font-bold tabular-nums text-muted-foreground">
      {count}
    </span>
  );
}

export function ReportTabs({
  summaryContent,
  issuesContent,
  complianceContent,
  lighthouseContent,
  screenshotsContent,
  viewportContent,
  issuesCount,
  view = "internal",
}: ReportTabsProps) {
  return (
    <ReportModeProvider view={view}>
    <Tabs defaultValue="summary">
      <TabsList
        variant="line"
        className="w-full justify-start gap-1 rounded-none border-b border-border p-0 group-data-horizontal/tabs:h-auto"
      >
        <TabsTrigger value="summary" className={triggerClass}>
          Summary
        </TabsTrigger>
        <TabsTrigger value="issues" className={triggerClass}>
          Issues
          {issuesCount != null && issuesCount > 0 && <CountChip count={issuesCount} />}
        </TabsTrigger>
        <TabsTrigger value="compliance" className={triggerClass}>
          Compliance
        </TabsTrigger>
        {lighthouseContent && (
          <TabsTrigger value="lighthouse" className={triggerClass}>
            Lighthouse
          </TabsTrigger>
        )}
        <TabsTrigger value="viewports" className={triggerClass}>
          By Viewport
        </TabsTrigger>
        <TabsTrigger value="screenshots" className={triggerClass}>
          Screenshots
        </TabsTrigger>
      </TabsList>

      <TabsContent value="summary">
        <div className="mt-6 animate-in fade-in-0 duration-200">{summaryContent}</div>
      </TabsContent>
      <TabsContent value="issues">
        <div className="mt-6 animate-in fade-in-0 duration-200">{issuesContent}</div>
      </TabsContent>
      <TabsContent value="compliance">
        <div className="mt-6 animate-in fade-in-0 duration-200">{complianceContent}</div>
      </TabsContent>
      {lighthouseContent && (
        <TabsContent value="lighthouse">
          <div className="mt-6 animate-in fade-in-0 duration-200">{lighthouseContent}</div>
        </TabsContent>
      )}
      <TabsContent value="viewports">
        <div className="mt-6 animate-in fade-in-0 duration-200">{viewportContent}</div>
      </TabsContent>
      <TabsContent value="screenshots">
        <div className="mt-6 animate-in fade-in-0 duration-200">{screenshotsContent}</div>
      </TabsContent>
    </Tabs>
    </ReportModeProvider>
  );
}
