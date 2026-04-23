import type { Grade } from "@/lib/types";

// ── Severity colors ─────────────────────────────────────────────────
// Soft palette — backgrounds use 50-shade, accent comes from the icon /
// dot / SVG stroke. Aligns with Lighthouse and Siteimprove convention;
// reduces visual noise when many issues are rendered at once.
export const SEVERITY_COLORS = {
  critical: {
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-900 dark:text-red-200",
    border: "border-red-200 dark:border-red-900/60",
    badge:
      "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-900/60",
    icon: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    svg: { stroke: "#dc2626", fill: "rgba(220,38,38,0.10)" },
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-900 dark:text-amber-200",
    border: "border-amber-200 dark:border-amber-900/60",
    badge:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900/60",
    icon: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    svg: { stroke: "#d97706", fill: "rgba(217,119,6,0.10)" },
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-900 dark:text-blue-200",
    border: "border-blue-200 dark:border-blue-900/60",
    badge:
      "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-900/60",
    icon: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    svg: { stroke: "#2563eb", fill: "rgba(37,99,235,0.08)" },
  },
  pass: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-900 dark:text-emerald-200",
    border: "border-emerald-200 dark:border-emerald-900/60",
    badge:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-900/60",
    icon: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    svg: { stroke: "#16a34a", fill: "rgba(22,163,74,0.08)" },
  },
} as const;

// ── Score/Grade colors ──────────────────────────────────────────────
export const GRADE_COLORS: Record<string, string> = {
  A: "text-green-700 dark:text-green-400",
  B: "text-blue-600 dark:text-blue-400",
  C: "text-yellow-600 dark:text-yellow-400",
  D: "text-orange-600 dark:text-orange-400",
  F: "text-red-600 dark:text-red-400",
};

export const GRADE_BG_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  D: "bg-orange-100 text-orange-800 border-orange-200",
  F: "bg-red-100 text-red-800 border-red-200",
};

export function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-700 dark:text-green-400";
  if (score >= 80) return "text-blue-600 dark:text-blue-400";
  if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 60) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-green-500/10";
  if (score >= 50) return "bg-orange-500/10";
  return "bg-red-500/10";
}

export function getLighthouseColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 50) return "#f97316";
  return "#ef4444";
}

export function getLighthouseTextColor(score: number): string {
  if (score >= 90) return "text-green-500";
  if (score >= 50) return "text-orange-500";
  return "text-red-500";
}

export function getGradeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? "text-muted-foreground";
}

// ── HTTP Status colors ──────────────────────────────────────────────
export function getHttpStatusColor(code: number): string {
  if (code >= 200 && code < 300) return "text-green-600 dark:text-green-400";
  if (code >= 300 && code < 400) return "text-blue-600 dark:text-blue-400";
  if (code >= 400 && code < 500) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function getHttpStatusBadge(code: number): string {
  if (code >= 200 && code < 300) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (code >= 300 && code < 400) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (code >= 400 && code < 500) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

// ── Scan status config ──────────────────────────────────────────────
export const SCAN_STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}> = {
  pending: { label: "Pending", color: "text-muted-foreground", variant: "outline" },
  scanning: { label: "Scanning", color: "text-blue-600", variant: "secondary" },
  auditing: { label: "Auditing", color: "text-blue-600", variant: "secondary" },
  analyzing: { label: "Analyzing", color: "text-purple-600", variant: "secondary" },
  completed: { label: "Completed", color: "text-green-600", variant: "default" },
  failed: { label: "Failed", color: "text-red-600", variant: "destructive" },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", variant: "outline" },
};

// ── Category labels ─────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<string, string> = {
  accessibility: "Accessibility",
  responsive: "Responsive",
  performance: "Performance",
  typography: "Typography",
  "touch-targets": "Touch Targets",
  forms: "Forms",
  visual: "Visual",
  seo: "SEO",
  "best-practices": "Best Practices",
  security: "Security",
  "html-quality": "HTML Quality",
  "css-quality": "CSS Quality",
  "ai-analysis": "AI Analysis",
};
