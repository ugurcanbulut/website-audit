// Viewport types
export type ViewportType = 'mobile' | 'tablet' | 'desktop';

export type BrowserEngine = 'chromium' | 'firefox' | 'webkit';

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
  type: ViewportType;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  userAgent?: string;
  defaultBrowserType?: BrowserEngine;
}

export interface BrowserSession {
  browser: unknown; // Playwright Browser instance
  engine: BrowserEngine;
  debuggingPort?: number;
}

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  type: ViewportType;
}

// Audit categories
export type AuditCategory =
  | 'accessibility'
  | 'responsive'
  | 'performance'
  | 'typography'
  | 'touch-targets'
  | 'forms'
  | 'visual'
  | 'seo'
  | 'best-practices'
  | 'security'
  | 'html-quality'
  | 'css-quality'
  | 'ai-analysis';

export type IssueSeverity = 'critical' | 'warning' | 'info' | 'pass';

export type ScanStatus =
  | 'pending'
  | 'scanning'
  | 'auditing'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AiProvider = 'claude' | 'openai';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

// Audit issue as returned to the client
export interface AuditIssue {
  id: string;
  category: AuditCategory;
  severity: IssueSeverity;
  ruleId: string;
  title: string;
  description: string;
  elementSelector?: string;
  elementHtml?: string;
  recommendation?: string;
  viewportName?: string;
  helpUrl?: string;        // Link to documentation (from axe-core)
  wcagTags?: string[];     // WCAG criteria tags (from axe-core)
  details?: Record<string, unknown>;
}

// Category score
export interface CategoryScore {
  category: AuditCategory;
  score: number;
  issueCount: {
    critical: number;
    warning: number;
    info: number;
  };
}

// Scan result as returned to the client
export interface ScanResult {
  id: string;
  url: string;
  status: ScanStatus;
  aiEnabled: boolean;
  aiProvider?: AiProvider;
  overallScore?: number;
  overallGrade?: Grade;
  error?: string;
  createdAt: string;
  completedAt?: string;
  viewports: ViewportConfig[];
  viewportResults: ViewportResult[];
  categoryScores: CategoryScore[];
  issues: AuditIssue[];
}

// Viewport result
export interface ViewportResult {
  id: string;
  viewportName: string;
  width: number;
  height: number;
  screenshotPath: string;
  performanceMetrics?: PerformanceMetrics;
  screenshotWidth?: number;
  screenshotHeight?: number;
}

// Performance metrics
export interface PerformanceMetrics {
  lcp?: number;
  cls?: number;
  inp?: number;
  ttfb?: number;
  fcp?: number;
  domContentLoaded?: number;
  load?: number;
  resourceCount?: number;
  totalResourceSize?: number;
}

// SSE event types
export type ScanEventType =
  | 'status'
  | 'viewport_complete'
  | 'audit_progress'
  | 'ai_progress'
  | 'score_calculated'
  | 'completed'
  | 'error';

export interface ScanEvent {
  type: ScanEventType;
  data: {
    scanId: string;
    message: string;
    progress?: number;
    viewport?: string;
    category?: string;
  };
}

// Create scan request
export interface CreateScanRequest {
  url: string;
  viewports?: string[];       // Legacy viewport names
  devices?: string[];          // New device names
  browserEngine?: BrowserEngine;
  aiEnabled: boolean;
  aiProvider?: AiProvider;
}
