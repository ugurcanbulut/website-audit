"use client";

import type { ViewportResult } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { ScreenshotGallery, ScreenshotThumbnail } from "@/components/report/screenshot-gallery";

function getDeviceIcon(width: number) {
  if (width >= 1024) return Monitor;
  if (width >= 768) return Tablet;
  return Smartphone;
}

interface ScreenshotCompareProps {
  viewportResults: ViewportResult[];
}

export function ScreenshotCompare({
  viewportResults,
}: ScreenshotCompareProps) {
  if (viewportResults.length === 0) {
    return (
      <p className="text-base text-muted-foreground text-center py-8">
        No screenshots available.
      </p>
    );
  }

  return (
    <ScreenshotGallery galleryId="screenshots-compare">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {viewportResults.map((vr) => {
          const DeviceIcon = getDeviceIcon(vr.width);

          return (
            <Card key={vr.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                  {vr.viewportName}
                  <span className="text-sm text-muted-foreground font-normal">
                    {vr.width} x {vr.height}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-hidden rounded-md border bg-muted">
                  <ScreenshotThumbnail
                    src={vr.screenshotPath}
                    alt={`Screenshot at ${vr.viewportName} (${vr.width}x${vr.height})`}
                    className="w-full h-auto object-cover object-top max-h-[300px]"
                    estimatedWidth={vr.screenshotWidth ?? vr.width * 2}
                    estimatedHeight={vr.screenshotHeight ?? vr.height * 6}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScreenshotGallery>
  );
}
