# UI/UX Audit Report — UI Audit Web Application

**Date**: 2026-03-31
**Auditor**: Senior UI/UX Engineer
**Scope**: Complete frontend codebase (`src/`)
**Components reviewed**: 45 files

---

## Executive Summary

The frontend is well-structured with solid Tailwind CSS usage and a good theming system. However, the audit uncovered **47 issues** across 6 categories. The most critical areas are: **duplicated color/state logic** spread across 11+ files (maintenance risk), **missing accessibility attributes** (11 icon-only buttons without aria-labels), and **touch targets below 44px** on mobile. No critical blockers, but several medium-severity issues that impact professional polish.

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Visual Consistency | 0 | 1 | 3 | 2 | 6 |
| Component Quality | 0 | 0 | 5 | 2 | 7 |
| Layout & Responsiveness | 0 | 1 | 4 | 3 | 8 |
| Accessibility | 0 | 2 | 5 | 4 | 11 |
| Modern Design Patterns | 0 | 0 | 3 | 5 | 8 |
| Information Architecture | 0 | 0 | 4 | 3 | 7 |
| **Total** | **0** | **4** | **24** | **19** | **47** |

---

## 1. Visual Consistency

### 1.1 [HIGH] Duplicated Color/State Logic — 11+ files
Severity, score, grade, and HTTP status color functions are copy-pasted across the codebase.

**Duplicated functions:**
| Function | Files |
|----------|-------|
| `getGradeColor()` | `recent-scans.tsx:84`, `history-tabs.tsx:119` |
| `scoreColor()` | `report-overview.tsx:47`, `lighthouse-report.tsx:38`, `lighthouse-gauges.tsx:12` |
| Severity badge colors | `issue-card.tsx:13`, `annotation-overlay.tsx:5`, `annotated-screenshot.tsx:103` |
| HTTP status colors | `crawl-tabs.tsx:108`, `site-tree.tsx:13`, `crawl-results-table.tsx:60` |
| Status config (scan states) | `scan-card.tsx:34`, `recent-scans.tsx:35`, `history-tabs.tsx:83` |

**Fix**: Create `src/lib/ui-constants.ts`:
```ts
export const SEVERITY_COLORS = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  pass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
} as const;

export function getScoreColor(score: number) { ... }
export function getGradeColor(grade: string) { ... }
export function getHttpStatusColor(code: number) { ... }
```

### 1.2 [MEDIUM] Hardcoded SVG Colors
`annotation-overlay.tsx:7-9` uses hex strings (`#ef4444`, `#f59e0b`, `#3b82f6`) instead of CSS variables.
`element-screenshot.tsx:20` hardcodes padding as `30` (px).

**Fix**: Use `hsl(var(--destructive))` pattern or at minimum reference Tailwind color tokens.

### 1.3 [MEDIUM] Inconsistent Spacing Scale
List spacing varies: `space-y-1.5`, `space-y-2`, `space-y-3` used interchangeably for similar content types.

**Fix**: Document spacing scale — `gap-2` for tight lists, `gap-3` for related items, `gap-4` for sections, `gap-6` for major sections.

### 1.4 [MEDIUM] Inconsistent Border Radius
Most components use `rounded-lg`. Exceptions: `annotation-overlay.tsx:84` uses `rx={3}`, `element-screenshot.tsx:62` uses `rounded-sm`.

**Fix**: Align all to `rounded-lg` or theme `--radius`.

### 1.5 [LOW] Typography Hierarchy Unclear
`issue-card.tsx:97` — title uses `text-base` same as description body. Hard to distinguish.

**Fix**: Titles should be `text-base font-semibold`, descriptions `text-sm text-muted-foreground`.

### 1.6 [LOW] Mixed text-xs/text-sm After Font Upgrade
Some files still have `text-xs` (history-tabs.tsx:266) while neighbors use `text-sm`. The global upgrade was inconsistent in a few spots.

---

## 2. Component Quality

### 2.1 [MEDIUM] Missing Loading/Skeleton States
No skeleton loaders exist anywhere in the codebase. Key locations:
- `report-overview.tsx` — radar chart appears without loading state
- `lighthouse-report.tsx` — large audit details expand instantly
- `crawl-compare.tsx` — comparison results appear abruptly
- `history/page.tsx` — tables load with no skeleton

**Fix**: Create `src/components/ui/skeleton.tsx` and add skeletons for tables, cards, and charts.

### 2.2 [MEDIUM] Missing Error Recovery
- `crawl-compare.tsx:174` — shows error text but no retry button
- `generate-fix-button.tsx:94` — error shown without retry
- `scan-form.tsx:268` — error shown but no clear recovery path

**Fix**: Add retry buttons and contextual recovery instructions.

### 2.3 [MEDIUM] Missing Toast Notifications
`sonner` is installed but NOT used anywhere. Delete/cancel/export actions have no feedback.

**Fix**: Add `toast()` calls for: scan created, scan deleted, export completed, fix generated.

### 2.4 [MEDIUM] Empty States Lack CTAs
- `viewport-tabs.tsx:152` — "No issues detected" with no suggestion
- `lighthouse-report.tsx:317` — "Requires Chromium" with no action

**Fix**: Add contextual suggestions and CTA buttons.

### 2.5 [MEDIUM] crawl-tabs.tsx is Too Large
1240+ lines in a single file. Should be split into sub-components.

### 2.6 [LOW] Missing Transition on Tab Content
Tab content appears instantly with no fade/slide. Add `transition-opacity duration-200`.

### 2.7 [LOW] No Copy Feedback
Export/copy actions in crawl-tabs have no "Copied!" confirmation state.

---

## 3. Layout & Responsiveness

### 3.1 [HIGH] Touch Targets Below 44px
`icon-sm` size = 28px. Used in:
- `delete-scan-inline.tsx:32` — delete button
- `theme-toggle.tsx` — theme toggle
- `history-tabs.tsx:170` — delete buttons

**Fix**: Change all `size="icon-sm"` to `size="icon"` (32px) or add padding to reach 44px.

### 3.2 [MEDIUM] Missing md: Breakpoints
- `viewport-tabs.tsx:116` — `grid-cols-1 lg:grid-cols-2` jumps from 1→2 with no tablet layout
- `crawl-compare.tsx:184` — `grid-cols-2 lg:grid-cols-4` with no md variant
- `lighthouse-report.tsx:241` — `grid-cols-2 lg:grid-cols-5` same issue

**Fix**: Add `md:grid-cols-2` or `md:grid-cols-3` intermediate breakpoints.

### 3.3 [MEDIUM] Browser Engine Buttons Don't Wrap
`scan-form.tsx:177` and `batch-scan-form.tsx:141` — `grid-cols-3` is fixed, will overflow on 320px screens.

**Fix**: Change to `grid-cols-1 sm:grid-cols-3`.

### 3.4 [MEDIUM] Tables Overflow on Mobile
`recent-scans.tsx` and `history-tabs.tsx` show all columns on mobile with no responsive hiding.

**Fix**: Hide non-critical columns below `sm:` or switch to card layout.

### 3.5 [MEDIUM] Changed Pages Grid Breaks on Mobile
`crawl-compare.tsx:299` — `grid-cols-[120px_1fr_auto_1fr]` fixed layout overflows.

**Fix**: `grid-cols-1 sm:grid-cols-[120px_1fr_auto_1fr]`.

### 3.6 [LOW] Missing Max-Width on Lighthouse View
`lighthouse-report.tsx` has no container constraint — spreads too wide on ultrawide displays.

**Fix**: Wrap in `max-w-5xl mx-auto`.

### 3.7 [LOW] Screenshot Container Missing overflow-x-hidden
`viewport-tabs.tsx:125` — wide screenshots can cause horizontal scroll.

### 3.8 [LOW] Code Blocks Use break-all
`issue-card.tsx:119,164` — `break-all` causes mid-word breaks. Use `break-words`.

---

## 4. Accessibility

### 4.1 [HIGH] 11 Icon-Only Buttons Missing aria-label
| Location | Button | Fix |
|----------|--------|-----|
| `viewport-tabs.tsx:85` | Eye/EyeOff toggle | `aria-label="Toggle annotations"` |
| `theme-toggle.tsx:12` | Sun/Moon toggle | `aria-label="Toggle theme"` |
| `delete-scan-inline.tsx:28` | Trash icon | `aria-label="Delete scan"` |
| `history-tabs.tsx:170` | Trash icon | `aria-label="Delete"` |
| `lighthouse-report.tsx:292` | Passed audits toggle | `aria-label="Toggle passed audits"` |
| `lighthouse-report.tsx:102` | Audit expand | `aria-label="Expand audit details"` |
| `crawl-tabs.tsx:302` | Export CSV | `aria-label="Export as CSV"` |
| `site-tree.tsx:28` | Expand/collapse | `aria-expanded={expanded}` |
| `device-selector.tsx:55` | Select all | `aria-label="Select all devices"` |
| `generate-fix-button.tsx:62` | Generate fix | `aria-label="Generate accessibility fix"` |
| `annotation-overlay.tsx:70` | Annotation click | `role="button" aria-label={ann.title}` |

### 4.2 [HIGH] Missing aria-live Regions
Dynamic status updates have no screen reader announcements:
- `scan-progress.tsx` — progress updates
- `crawl/[id]/page.tsx` — auto-refresh progress
- `history-tabs.tsx` — search filter results count
- `crawl-tabs.tsx` — filtered row count

**Fix**: Add `aria-live="polite" aria-atomic="true"` to status containers.

### 4.3 [MEDIUM] Missing aria-expanded on Toggle Buttons
- `site-tree.tsx:28` — expand/collapse without `aria-expanded`
- `lighthouse-report.tsx:102` — AuditItem expand without `aria-expanded`

### 4.4 [MEDIUM] Missing Keyboard Equivalents for Mouse Events
`viewport-tabs.tsx:157-161` — `onMouseEnter`/`onMouseLeave` with no `onFocus`/`onBlur` equivalents.

**Fix**: Add `onFocus={() => handleIssueHover(issue.id)}` and `onBlur={() => handleIssueHover(null)}`.

### 4.5 [MEDIUM] Missing focus-visible on Custom Buttons
- `device-selector.tsx:79-88` — no focus ring
- `scan-form.tsx:179-192` — browser engine buttons
- `batch-scan-form.tsx:142-159` — same

**Fix**: Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.

### 4.6 [MEDIUM] Lighthouse Gauge SVGs Have No Text Alternative
`lighthouse-report.tsx:50-72` — circular gauge SVG has no screen reader fallback.

**Fix**: Wrap in `<div role="img" aria-label={`${label}: ${score} out of 100`}>`.

### 4.7 [MEDIUM] Form Inputs Without Labels
- `batch-scan-form.tsx:114` — textarea has no associated label
- `crawl-tabs.tsx:294` — search input uses placeholder only
- `history-tabs.tsx:208` — search input no label

**Fix**: Add `<Label htmlFor="...">` or `aria-label="..."`.

### 4.8 [LOW] Annotation Number Badges Not Announced
`issue-card.tsx:80` — number badges are visual-only.
**Fix**: Add `aria-label={`Annotation ${annotationNumber}`}`.

### 4.9 [LOW] Status Icons Missing aria-label
`history-tabs.tsx:272` — Loader2/CheckCircle2 icons have no text.
**Fix**: Add `aria-hidden="true"` and ensure adjacent text conveys meaning.

### 4.10 [LOW] Missing Screen Reader Text for Scores
`score-badge.tsx` — visual score display needs `sr-only` text alternative.

### 4.11 [LOW] Color Contrast Unverified
`text-green-500` on white background may be marginal for WCAG AA. Needs testing.

---

## 5. Modern Design Patterns

### 5.1 [MEDIUM] No Skeleton Loaders
Zero skeleton loaders in the codebase. Every data-loading view shows nothing until complete.

**Fix**: Add Skeleton variants for: table rows, metric cards, charts, full-page layouts.

### 5.2 [MEDIUM] No Toast Notifications
`sonner` is installed but unused. Actions (delete, export, generate fix) give no feedback.

**Fix**: Import `toast` from `sonner` and add to all mutation handlers.

### 5.3 [MEDIUM] Breadcrumbs Not Used
`breadcrumb.tsx` UI component exists but is never rendered. Deep pages (`/scan/[id]`, `/crawl/[id]`, `/scan/batch/[id]`) have no breadcrumbs.

**Fix**: Add `<Breadcrumb>` to SiteHeader for nested routes.

### 5.4 [LOW] No Micro-Interactions
Missing: button press feedback (`active:scale-[0.98]`), checkbox animations, toggle transitions.

### 5.5 [LOW] No Page Transitions
Tab content and page changes are instant. No fade/slide transitions.

### 5.6 [LOW] Empty States Are Basic
Icon + text only. No illustrations or engaging visual design.

### 5.7 [LOW] Limited Glassmorphism Usage
Only `crawl-tabs.tsx:312` uses `backdrop-blur-sm`. Could enhance sticky headers and modals.

### 5.8 [LOW] No Progressive Disclosure for Dense Data
Lighthouse diagnostics and crawl tabs show all data at once. Could collapse secondary info.

---

## 6. Information Architecture

### 6.1 [MEDIUM] Dead "Help" Link
`app-sidebar.tsx:44` — Help link points to `"#"`. Either implement or remove.

### 6.2 [MEDIUM] Missing Breadcrumbs on Deep Pages
`/scan/[id]`, `/crawl/[id]`, `/scan/batch/[id]` — no breadcrumbs. User has no context of navigation path.

### 6.3 [MEDIUM] Empty States Lack Actionable Guidance
- "No viewport results available" — doesn't explain why
- "Lighthouse requires Chromium" — doesn't suggest changing settings
- "No issues detected" — could suggest checking other categories

### 6.4 [MEDIUM] Crawl History Link is Indirect
`/history?tab=crawls` via query param is fragile. Consider a dedicated `/crawl/history` route.

### 6.5 [LOW] Visual Hierarchy in Issue Cards
Title and description use the same font size (`text-base`). Title should be more prominent.

### 6.6 [LOW] Table Headers Blend with Content
`recent-scans.tsx:139` — headers lack color distinction from body text.

### 6.7 [LOW] No Contextual Labels on Status Displays
`scan/[id]/page.tsx:76` — URL shown without "Scanning:" label prefix.

---

## Priority Implementation Plan

### Week 1 — High Impact, Quick Wins
1. Create `src/lib/ui-constants.ts` and consolidate all duplicate color/state logic
2. Add `aria-label` to all 11 icon-only buttons
3. Add `aria-live` regions to dynamic status areas
4. Fix touch targets: change `icon-sm` to `icon` with padding
5. Add `focus-visible:ring-2` to all custom buttons
6. Integrate `sonner` toast notifications for delete/export/generate actions

### Week 2 — Medium Impact
7. Add Skeleton loader component and apply to key loading states
8. Add breadcrumbs to SiteHeader for nested routes
9. Add responsive `md:` breakpoints to grid layouts
10. Fix mobile table overflow (hide columns or card layout)
11. Add `aria-expanded` to all toggle buttons
12. Add keyboard handlers (`onFocus`/`onBlur`) alongside mouse events
13. Fix browser engine buttons wrapping on small screens

### Week 3 — Polish
14. Add page/tab transition animations
15. Add micro-interactions (`active:scale-[0.98]`)
16. Improve empty state messaging with CTAs
17. Fix or remove dead Help link
18. Add contextual labels to status displays
19. Split crawl-tabs.tsx into sub-components
20. Add max-width constraints to Lighthouse view

---

## Positive Highlights

- Excellent Tailwind CSS usage with consistent patterns
- Strong theming system (OKLCH colors, dark mode)
- Good component composition and separation of concerns
- Split viewport view with bidirectional annotations is excellent UX
- Lighthouse report layout follows industry patterns well
- PhotoSwipe integration is solid
- Progressive disclosure in Lighthouse passed audits section
- Dashboard section cards follow shadcn dashboard-01 pattern correctly
- Device selector grouped by type with clear visual selection state
