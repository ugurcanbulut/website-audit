"use client";

import type { Annotation } from "@/lib/annotations/mapper";
import { SEVERITY_COLORS } from "@/lib/ui-constants";

const severityStyles: Record<
  string,
  { stroke: string; fill: string; badge: string }
> = {
  critical: {
    stroke: SEVERITY_COLORS.critical.svg.stroke,
    fill: SEVERITY_COLORS.critical.svg.fill,
    badge: SEVERITY_COLORS.critical.dot,
  },
  warning: {
    stroke: SEVERITY_COLORS.warning.svg.stroke,
    fill: SEVERITY_COLORS.warning.svg.fill,
    badge: SEVERITY_COLORS.warning.dot,
  },
  info: {
    stroke: SEVERITY_COLORS.info.svg.stroke,
    fill: SEVERITY_COLORS.info.svg.fill,
    badge: SEVERITY_COLORS.info.dot,
  },
  pass: {
    stroke: SEVERITY_COLORS.pass.svg.stroke,
    fill: SEVERITY_COLORS.pass.svg.fill,
    badge: SEVERITY_COLORS.pass.dot,
  },
};

interface AnnotationOverlayProps {
  annotations: Annotation[];
  screenshotWidth: number;
  screenshotHeight: number;
  selectedId?: string | null;
  onAnnotationClick?: (annotation: Annotation) => void;
  onAnnotationHover?: (annotation: Annotation | null) => void;
}

export function AnnotationOverlay({
  annotations,
  screenshotWidth,
  screenshotHeight,
  selectedId,
  onAnnotationClick,
  onAnnotationHover,
}: AnnotationOverlayProps) {
  if (annotations.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${screenshotWidth} ${screenshotHeight}`}
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="xMinYMin meet"
      style={{ zIndex: 10 }}
    >
      {annotations.map((ann) => {
        const style = severityStyles[ann.severity] ?? severityStyles.info;
        const isSelected = selectedId === ann.id;
        const isDashed = ann.source === "ai";
        const BADGE_R = Math.min(
          14,
          Math.max(10, screenshotWidth * 0.01)
        );

        return (
          <g
            key={ann.id}
            className="pointer-events-auto cursor-pointer"
            role="button"
            aria-label={ann.title}
            tabIndex={0}
            onClick={() => onAnnotationClick?.(ann)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAnnotationClick?.(ann); } }}
            onMouseEnter={() => onAnnotationHover?.(ann)}
            onMouseLeave={() => onAnnotationHover?.(null)}
            onFocus={() => onAnnotationHover?.(ann)}
            onBlur={() => onAnnotationHover?.(null)}
          >
            {/* Highlight rectangle */}
            <rect
              x={ann.rect.x}
              y={ann.rect.y}
              width={ann.rect.width}
              height={ann.rect.height}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={isSelected ? 3 : 2}
              strokeDasharray={isDashed ? "6 3" : undefined}
              rx={3}
              opacity={isSelected ? 1 : 0.8}
            />
            {/* Numbered badge circle */}
            <circle
              cx={ann.rect.x + ann.rect.width}
              cy={ann.rect.y}
              r={BADGE_R}
              fill={style.stroke}
              stroke="white"
              strokeWidth={1.5}
            />
            {/* Badge number */}
            <text
              x={ann.rect.x + ann.rect.width}
              y={ann.rect.y + BADGE_R * 0.35}
              textAnchor="middle"
              fill="white"
              fontSize={BADGE_R * 0.9}
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              {ann.number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
