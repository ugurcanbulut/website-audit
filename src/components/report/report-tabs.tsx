"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ReportTabsProps {
  overviewContent: ReactNode;
  issuesContent: ReactNode;
  screenshotsContent: ReactNode;
  viewportContent: ReactNode;
}

export function ReportTabs({
  overviewContent,
  issuesContent,
  screenshotsContent,
  viewportContent,
}: ReportTabsProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="issues">Issues</TabsTrigger>
        <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
        <TabsTrigger value="viewports">By Viewport</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="mt-6">{overviewContent}</div>
      </TabsContent>

      <TabsContent value="issues">
        <div className="mt-6">{issuesContent}</div>
      </TabsContent>

      <TabsContent value="screenshots">
        <div className="mt-6">{screenshotsContent}</div>
      </TabsContent>

      <TabsContent value="viewports">
        <div className="mt-6">{viewportContent}</div>
      </TabsContent>
    </Tabs>
  );
}
