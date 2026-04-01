"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnnotationOverlay } from "./annotation-overlay";
import { ScreenshotGallery, ScreenshotThumbnail } from "./screenshot-gallery";
import type { Annotation } from "@/lib/annotations/mapper";
import { SEVERITY_COLORS } from "@/lib/ui-constants";

interface AnnotatedScreenshotProps {
  screenshotPath: string;
  viewportName: string;
  width: number;
  height: number;
  annotations: Annotation[];
  galleryId: string;
  screenshotWidth?: number;
  screenshotHeight?: number;
}

export function AnnotatedScreenshot({
  screenshotPath,
  viewportName,
  width,
  height,
  annotations,
  galleryId,
  screenshotWidth: storedScreenshotWidth,
  screenshotHeight: storedScreenshotHeight,
}: AnnotatedScreenshotProps) {
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<Annotation | null>(null);

  // Use stored dimensions if available, otherwise fall back to estimates
  const estimatedWidth = storedScreenshotWidth ?? width * 2;
  const estimatedDocHeight = storedScreenshotHeight ?? height * 6;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-base font-medium">
            {viewportName}{" "}
            <span className="text-muted-foreground font-normal">
              ({width}x{height})
            </span>
          </p>
          {annotations.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {annotations.length} annotations
            </Badge>
          )}
        </div>
        {annotations.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnnotations(!showAnnotations)}
          >
            {showAnnotations ? (
              <><EyeOff className="size-3.5 mr-1" /> Hide</>
            ) : (
              <><Eye className="size-3.5 mr-1" /> Show</>
            )}
          </Button>
        )}
      </div>

      {/* Screenshot with overlay */}
      <ScreenshotGallery galleryId={galleryId}>
        <div className="relative rounded-md border bg-muted overflow-hidden">
          <ScreenshotThumbnail
            src={screenshotPath}
            alt={`Screenshot at ${viewportName}`}
            className="w-full h-auto object-contain"
            estimatedWidth={estimatedWidth}
            estimatedHeight={estimatedDocHeight}
          />
          {showAnnotations && annotations.length > 0 && (
            <AnnotationOverlay
              annotations={annotations}
              screenshotWidth={estimatedWidth}
              screenshotHeight={estimatedDocHeight}
              selectedId={selectedId}
              onAnnotationClick={(ann) => {
                setSelectedId(ann.id === selectedId ? null : ann.id);
              }}
              onAnnotationHover={setHoveredAnnotation}
            />
          )}
        </div>
      </ScreenshotGallery>

      {/* Hovered/selected annotation info */}
      {(hoveredAnnotation || selectedId) && (
        <div className="rounded-md border bg-card p-3 text-base">
          {(() => {
            const ann = hoveredAnnotation ?? annotations.find(a => a.id === selectedId);
            if (!ann) return null;
            const severityColor = (SEVERITY_COLORS[ann.severity as keyof typeof SEVERITY_COLORS]?.text) ?? "";
            return (
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center rounded-full bg-muted size-6 text-sm font-bold shrink-0">
                  {ann.number}
                </span>
                <div>
                  <p className="font-medium">{ann.title}</p>
                  <p className={`text-sm ${severityColor}`}>
                    {ann.severity} - {ann.category}
                    {ann.source === "ai" && " (AI)"}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
