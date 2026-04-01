"use client";

import { cn } from "@/lib/utils";

interface ElementScreenshotProps {
  screenshotPath: string;
  screenshotWidth: number;
  screenshotHeight: number;
  elementRect: { x: number; y: number; width: number; height: number };
  className?: string;
}

export function ElementScreenshot({
  screenshotPath,
  screenshotWidth,
  screenshotHeight,
  elementRect,
  className,
}: ElementScreenshotProps) {
  const padding = 30;

  // Calculate the crop region with padding, clamped to image bounds
  const cropX = Math.max(0, elementRect.x - padding);
  const cropY = Math.max(0, elementRect.y - padding);
  const cropW = Math.min(
    elementRect.width + padding * 2,
    screenshotWidth - cropX
  );
  const cropH = Math.min(
    elementRect.height + padding * 2,
    screenshotHeight - cropY
  );

  // Cap display height so tall elements don't dominate the card
  const maxDisplayHeight = 200;
  const displayHeight = Math.min(cropH, maxDisplayHeight);
  const scale = displayHeight / cropH;
  const displayWidth = cropW * scale;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-muted",
        className
      )}
      style={{ width: displayWidth, height: displayHeight }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={screenshotPath}
        alt="Element screenshot"
        className="absolute max-w-none"
        style={{
          width: screenshotWidth * scale,
          height: screenshotHeight * scale,
          left: -cropX * scale,
          top: -cropY * scale,
        }}
      />
      {/* Highlight border around the actual element */}
      <div
        className="absolute border-2 border-primary/60 rounded-sm pointer-events-none"
        style={{
          left: (elementRect.x - cropX) * scale,
          top: (elementRect.y - cropY) * scale,
          width: elementRect.width * scale,
          height: elementRect.height * scale,
        }}
      />
    </div>
  );
}
