# UI Audit v2: Enterprise-Grade Architecture Upgrade

## Context

The current audit system uses homebrew rules analyzing DOM snapshots, which produces false positives (especially accessibility checks) and lacks the depth of professional tools. This upgrade replaces the core audit engines with industry-standard tools (axe-core, Lighthouse, HTMLHint, CSS analyzer) while adding multi-browser/device support, visual issue annotations, and enhanced AI analysis. The goal is to match the quality of tools like Lighthouse, axe DevTools, and Siteimprove.

---

## Architecture: Current vs Target

```
CURRENT                              TARGET
─────────────────                    ─────────────────
Chromium only                   →    Chromium + Firefox + WebKit
7 custom viewports              →    143 Playwright device presets
Custom a11y rules (false+)      →    @axe-core/playwright (zero false+)
Custom perf thresholds          →    Lighthouse (proper scoring curves)
No HTML/CSS linting             →    HTMLHint + CSS Analyzer
No security checks              →    OWASP security headers
Text-only AI findings           →    AI + SVG visual annotations
Deduction scoring               →    Blended Lighthouse + custom scores
```

---

## Phase 1: Scanner Foundation

**Goal**: Multi-browser, device presets, remote debugging port, live data capture.

### New dependencies
```
npm install @axe-core/playwright lighthouse htmlhint @projectwallace/css-analyzer
```

### Files to create
| File | Purpose |
|------|---------|
| `src/lib/scanner/devices.ts` | Curated device preset data (~20 devices from Playwright's 143) |

### Files to modify
| File | Change |
|------|--------|
| `src/lib/scanner/browser.ts` | Multi-engine launch (`chromium`/`firefox`/`webkit`), return `BrowserSession` with `debuggingPort` for Lighthouse |
| `src/lib/scanner/viewports.ts` | Add `DevicePreset` type system alongside existing `ViewportConfig` for backward compat |
| `src/lib/scanner/capture.ts` | Run axe-core on LIVE page, capture response headers, extract HTML/CSS, accept `BrowserSession` + `DevicePreset` |
| `src/lib/types.ts` | Add `BrowserEngine`, `DevicePreset`, expand `CreateScanRequest` |
| `src/lib/db/schema.ts` | Add columns: `scans.browserEngine`, `viewport_results.{deviceName, axeResults, responseHeaders, pageHtml, pageCss}` |
| `src/lib/queue/scan-worker.ts` | Pass `BrowserSession` through pipeline, restructure: audit runs BEFORE browser close |
| `src/lib/queue/scan-queue.ts` | Expand `ScanJobData` with `browserEngine` and `devices` |
| `Dockerfile` | Install Firefox + WebKit browsers, add `lighthouse` to runtime deps |

### DB Migration: `drizzle/0001_enterprise_scanner.sql`
- `scans`: add `browser_engine TEXT DEFAULT 'chromium'`
- `viewport_results`: add `device_name TEXT`, `axe_results JSONB`, `response_headers JSONB`, `page_html TEXT`, `page_css TEXT`

### Key design decisions
- axe-core runs during capture (needs live Page), not during audit phase
- Lighthouse needs `--remote-debugging-port` on Chromium; skipped for Firefox/WebKit
- CDP-based perf metrics guarded behind `engine === 'chromium'` check
- `pageHtml`/`pageCss` stored for first viewport only (run HTMLHint/CSS analyzer once)

---

## Phase 2: Professional Audit Runners

**Goal**: Wrapper modules that transform external tool output into our `AuditIssueInput` format.

### Files to create
| File | Purpose |
|------|---------|
| `src/lib/audit/runners/axe-runner.ts` | Maps `AxeResults.violations` → `AuditIssueInput[]`. Impact: critical/serious→critical, moderate→warning, minor→info |
| `src/lib/audit/runners/lighthouse-runner.ts` | Runs `lighthouse(url, {port})`, extracts category scores + failed audits → `AuditIssueInput[]`. Categories: performance, seo, best-practices (NOT accessibility — axe-core handles that per-viewport) |
| `src/lib/audit/runners/html-runner.ts` | Runs `HTMLHint.verify(html)` → `AuditIssueInput[]`. Category: `html-quality` |
| `src/lib/audit/runners/css-runner.ts` | Runs `analyze(css)` → `AuditIssueInput[]` + `CssStats`. Category: `css-quality`. Flags: too many colors/fonts, high specificity, !important abuse |
| `src/lib/audit/runners/security-runner.ts` | Checks response headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Category: `security` |

### Files to modify
| File | Change |
|------|--------|
| `src/lib/types.ts` | Expand `AuditCategory` with: `security`, `html-quality`, `css-quality`, `best-practices` |
| `src/lib/db/schema.ts` | Add `viewport_results.lighthouseJson JSONB`, `category_scores.lighthouseScore INTEGER` |

### DB Migration: `drizzle/0002_audit_engines.sql`

---

## Phase 3: Audit Engine Overhaul

**Goal**: Replace custom rules with new runners, update scoring.

### Files to DELETE (replaced by professional tools)
| File | Replacement |
|------|-------------|
| `src/lib/audit/rules/accessibility.ts` | `axe-runner.ts` (zero false positives vs our ~7 approximate checks) |
| `src/lib/audit/rules/performance.ts` | `lighthouse-runner.ts` (proper Lighthouse scoring vs basic thresholds) |
| `src/lib/audit/rules/seo.ts` | `lighthouse-runner.ts` SEO category (covers all our 5 checks + much more) |

### Files to TRIM
| File | Change |
|------|--------|
| `src/lib/audit/rules/forms.ts` | Keep only `small-input-mobile` and `missing-autocomplete`. Remove `input-no-label` and `placeholder-only` (axe-core covers these) |

### Files to KEEP (unique cross-viewport value)
- `src/lib/audit/rules/responsive.ts` — no external tool does cross-viewport comparison
- `src/lib/audit/rules/typography.ts` — snapshot-based, per-viewport typography analysis
- `src/lib/audit/rules/touch-targets.ts` — per-viewport touch target sizing
- `src/lib/audit/rules/visual.ts` — cross-viewport visual consistency

### Files to REWRITE
| File | Change |
|------|--------|
| `src/lib/audit/engine.ts` | New orchestrator: axe-runner → HTMLHint → security → kept custom rules → CSS analysis → Lighthouse. Accepts `BrowserSession` for Lighthouse |
| `src/lib/audit/scoring.ts` | Blended scoring: Lighthouse scores for perf/seo/best-practices, calibrated deduction for accessibility (from axe-core counts), existing deduction for custom categories. Weighted overall: Performance 25%, Accessibility 25%, SEO 15%, others share 35% |

### Worker pipeline change
```
CURRENT:  capture all → close browser → audit → AI → score
TARGET:   capture all → audit (with live browser for Lighthouse) → close browser → AI → score
```

---

## Phase 4: Visual Annotations

**Goal**: SVG overlays mapping issues to their locations on screenshots.

### Files to create
| File | Purpose |
|------|---------|
| `src/lib/annotations/mapper.ts` | `mapIssuesToAnnotations(issues, domSnapshot, viewportName)` → `Annotation[]`. Matches `elementSelector` to DOM element rects. Fuzzy matching fallback for complex selectors |
| `src/components/report/annotation-overlay.tsx` | SVG overlay: colored rects (red/amber/blue by severity) + numbered circle markers. Interactive: click → show issue |
| `src/components/report/annotated-screenshot.tsx` | Combines screenshot + annotation overlay + toggle + issue panel |

### Files to modify
| File | Change |
|------|--------|
| `src/components/report/viewport-tabs.tsx` | Replace `ScreenshotThumbnail` with `AnnotatedScreenshot` |
| `src/components/report/screenshot-compare.tsx` | Add annotation number markers to grid thumbnails |
| `src/components/report/issue-card.tsx` | Add annotation number badge, highlight state, hover interaction |
| `src/app/scan/[id]/page.tsx` | Compute annotations server-side, pass to report components |

### No DB changes needed — annotations computed at render time from existing issues + DOM snapshots

---

## Phase 5: Enhanced AI Analysis

**Goal**: AI returns region coordinates for visual placement of findings.

### Files to modify
| File | Change |
|------|--------|
| `src/lib/ai/prompts.ts` | Add region coordinate instructions + screenshot dimensions to prompt |
| `src/lib/ai/provider.ts` | Pass viewport dimensions map to prompt builder |
| `src/lib/ai/claude.ts` | Parse `region` field from AI response |
| `src/lib/ai/openai.ts` | Parse `region` field from AI response |
| `src/lib/annotations/mapper.ts` | Handle AI issues: use `details.region` for annotation rect, mark `source: 'ai'` |
| `src/components/report/annotation-overlay.tsx` | Render AI annotations with dashed borders (vs solid for tool annotations) |

### AI response format change
```json
{
  "issues": [{
    "severity": "warning",
    "title": "Cluttered navigation",
    "description": "...",
    "recommendation": "...",
    "viewport": "Mobile S",
    "region": { "x": 0, "y": 0, "width": 360, "height": 60 }
  }]
}
```

---

## Phase 6: UI Updates

**Goal**: Device/browser selection, Lighthouse score display, new category UI.

### Files to create
| File | Purpose |
|------|---------|
| `src/components/scan/device-selector.tsx` | Device preset picker grouped by Phones/Tablets/Desktops with search, quick-select presets, and resolution/scale info |
| `src/components/report/lighthouse-gauges.tsx` | Lighthouse-style circular score gauges (green ≥90, orange 50-89, red <50) |

### Files to modify
| File | Change |
|------|--------|
| `src/components/scan/scan-form.tsx` | Replace viewport checkboxes with `DeviceSelector` + browser engine radio group |
| `src/app/api/scans/route.ts` | Accept `devices[]` and `browserEngine`, resolve device presets |
| `src/components/report/report-overview.tsx` | Add `LighthouseGauges` section, expand category labels for new categories, show browser/device info |
| `src/components/report/issues-by-category.tsx` | Support new categories (security, html-quality, css-quality, best-practices) with appropriate icons |

---

## Phase 7: Multi-URL Batch Scanning

**Goal**: Allow users to submit multiple URLs in a single scan job, with aggregated reporting.

### Approach
- Scan form accepts multiple URLs (textarea, one per line, or CSV paste)
- Each URL becomes a child scan under a parent "batch" record
- Worker processes URLs sequentially (or with configurable concurrency)
- Dashboard shows batch as a single entry with expandable child scans
- Batch report: aggregated scores across all URLs, per-URL breakdown

### DB changes
- `scans` table: add `batchId UUID` (nullable FK to self or new `scan_batches` table)
- New `scan_batches` table: `id`, `name`, `urls[]`, `status`, `overallScore`, `createdAt`, `completedAt`
- Each URL gets its own `scans` record linked to the batch

### Files to create
| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | Add `scanBatches` table |
| `src/app/scan/batch/page.tsx` | Batch scan form page |
| `src/components/scan/batch-form.tsx` | Multi-URL input component |
| `src/app/scan/batch/[id]/page.tsx` | Batch results overview |
| `src/components/report/batch-overview.tsx` | Aggregated batch report |

### Files to modify
| File | Change |
|------|--------|
| `src/app/api/scans/route.ts` | Accept `urls[]` array, create batch + child scans |
| `src/lib/queue/scan-worker.ts` | Process batch jobs sequentially |
| `src/app/page.tsx` | Show batches in dashboard |
| `src/components/layout/app-sidebar.tsx` | Add "Batch Scan" nav item |

---

## Phase 8: Full Site SEO Crawler

**Goal**: Screaming Frog / Semrush style site-wide SEO crawler. Separate from viewport scanning -- no screenshots, pure technical SEO crawl.

### Architecture
This is a **separate service/module** that:
1. Takes a seed URL
2. Discovers all pages via link crawling + sitemap.xml parsing
3. Crawls each page and extracts SEO data
4. Generates a comprehensive report with CSV export

### SEO data extracted per page
- URL, status code, redirect chain, redirect target
- Title tag, meta description, meta robots
- H1-H6 headings (content + count)
- Canonical URL, rel=prev/next
- Open Graph tags, Twitter Card tags
- Structured data (JSON-LD, microdata)
- Internal/external links (href, anchor text, follow/nofollow)
- Images (src, alt, dimensions, file size)
- Hreflang tags
- Response time, content size, content type
- robots.txt directives, sitemap references
- Word count, text-to-HTML ratio

### Crawler engine
Use Playwright for rendering (JavaScript-rendered pages) with a queue system:
- BFS crawl from seed URL, respecting `robots.txt`
- Parse `sitemap.xml` and `sitemap_index.xml` for additional URLs
- Configurable: max pages, max depth, crawl rate, include/exclude patterns
- Store crawl state in DB for pause/resume

### Files to create
| File | Purpose |
|------|---------|
| `src/lib/crawler/crawler.ts` | Core crawler engine: BFS queue, URL discovery, robots.txt |
| `src/lib/crawler/extractor.ts` | Per-page SEO data extraction (title, meta, headings, links, etc.) |
| `src/lib/crawler/sitemap.ts` | Sitemap.xml parser |
| `src/lib/crawler/robots.ts` | robots.txt parser |
| `src/lib/crawler/types.ts` | Crawler types (CrawlJob, PageData, CrawlConfig) |
| `src/lib/db/schema.ts` | Add `crawls` and `crawl_pages` tables |
| `src/app/crawl/new/page.tsx` | Crawler config form |
| `src/app/crawl/[id]/page.tsx` | Crawl results page |
| `src/components/crawl/crawl-form.tsx` | Config: seed URL, max pages, depth, rate, patterns |
| `src/components/crawl/crawl-results.tsx` | Data table with sortable columns (like Screaming Frog) |
| `src/components/crawl/crawl-export.tsx` | CSV/JSON export buttons |
| `src/app/api/crawls/route.ts` | CRUD API for crawls |
| `src/app/api/crawls/[id]/route.ts` | Individual crawl API |
| `src/app/api/crawls/[id]/export/route.ts` | CSV export endpoint |
| `src/lib/queue/crawl-queue.ts` | BullMQ queue for crawl jobs |
| `src/lib/queue/crawl-worker.ts` | Worker that processes crawl jobs |

### DB schema
```sql
-- Crawls (parent record)
crawls:
  id UUID PK
  seed_url TEXT NOT NULL
  status TEXT DEFAULT 'pending'
  config JSONB (maxPages, maxDepth, crawlRate, includePatterns, excludePatterns)
  total_pages INTEGER
  pages_crawled INTEGER DEFAULT 0
  created_at TIMESTAMP
  completed_at TIMESTAMP

-- Individual crawled pages
crawl_pages:
  id UUID PK
  crawl_id UUID FK -> crawls (cascade)
  url TEXT NOT NULL
  status_code INTEGER
  redirect_url TEXT
  title TEXT
  meta_description TEXT
  meta_robots TEXT
  canonical_url TEXT
  h1 TEXT[]
  h2 TEXT[]
  word_count INTEGER
  response_time_ms INTEGER
  content_size INTEGER
  content_type TEXT
  internal_links JSONB (array of {href, anchor, nofollow})
  external_links JSONB
  images JSONB (array of {src, alt, width, height})
  structured_data JSONB
  og_tags JSONB
  hreflang JSONB
  errors JSONB (broken links, missing tags, etc.)
  crawled_at TIMESTAMP
```

### CSV export format (Screaming Frog compatible columns)
URL, Status Code, Status, Title 1, Title 1 Length, Meta Description 1, Meta Description 1 Length, H1-1, H2-1, Canonical Link Element 1, Word Count, Text Ratio, Response Time, Content Size, Inlinks, Outlinks, External Links, Images, Images Missing Alt

### Sidebar navigation update
Add "SEO Crawler" section to sidebar with "New Crawl" and "History" links.

---

## Migration & Backward Compatibility

- All new DB columns are **nullable** — existing scans render without Lighthouse gauges or annotations
- `VIEWPORT_PRESETS` kept as alias for `DevicePreset[]` → `ViewportConfig[]`
- API accepts both `viewports` (legacy) and `devices` (new)
- Missing categories show "No data" rather than erroring

## Verification

After each phase:
1. `npm run build` — zero type errors
2. `docker compose up --build` — all services healthy
3. Run scan on `example.com` — verify new data collected (axe results, headers, etc.)
4. Check report — new categories, annotations, Lighthouse gauges appear
5. Test Firefox/WebKit scan — verify graceful Lighthouse skip
6. Test pre-upgrade scans — verify they still render correctly
