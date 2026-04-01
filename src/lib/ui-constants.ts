import type { Grade } from "@/lib/types";

// ── Severity colors (used in issue cards, annotations, badges) ──────
export const SEVERITY_COLORS = {
  critical: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    icon: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    svg: { stroke: "#ef4444", fill: "rgba(239,68,68,0.12)" },
  },
  warning: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-800",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
    icon: "text-yellow-700 dark:text-yellow-400",
    dot: "bg-amber-500",
    svg: { stroke: "#f59e0b", fill: "rgba(245,158,11,0.10)" },
  },
  info: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    icon: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
    svg: { stroke: "#3b82f6", fill: "rgba(59,130,246,0.08)" },
  },
  pass: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-800 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    icon: "text-green-700 dark:text-green-400",
    dot: "bg-green-500",
    svg: { stroke: "#22c55e", fill: "rgba(34,197,94,0.08)" },
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
