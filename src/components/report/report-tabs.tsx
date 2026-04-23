"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ReportTabsProps {
  issuesContent: ReactNode;
  complianceContent: ReactNode;
  lighthouseContent?: ReactNode;
  screenshotsContent: ReactNode;
  viewportContent: ReactNode;
}

export function ReportTabs({
  issuesContent,
  complianceContent,
  lighthouseContent,
  screenshotsContent,
  viewportContent,
}: ReportTabsProps) {
  return (
    <Tabs defaultValue="issues">
      <TabsList variant="line">
        <TabsTrigger value="issues">Issues</TabsTrigger>
        <TabsTrigger value="compliance">Compliance</TabsTrigger>
        {lighthouseContent && <TabsTrigger value="lighthouse">Lighthouse</TabsTrigger>}
        <TabsTrigger value="viewports">By Viewport</TabsTrigger>
        <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
      </TabsList>

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
  );
}
