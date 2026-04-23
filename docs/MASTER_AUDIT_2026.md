# UI Audit — Master Engineering Assessment & Roadmap

**Document type**: Technical audit, industry benchmark, and prioritized roadmap
**Target product positioning**: Enterprise-grade All-in-One audit platform (UI, UX, SEO, Security, Accessibility)
**Date**: 2026-04-23
**Revision**: 1.0
**Scope**: Entire codebase (`src/`, `drizzle/`, infrastructure), all prior audit documents, and industry benchmark research
**Method**: Line-by-line code review, targeted web research against current 2025-2026 industry practice, live analysis of a representative problem site (`americas.land`), consolidation of four prior internal audit documents

This document **supersedes** and consolidates:
- `docs/AUDIT_REPORT.md` (UI/UX audit — 47 findings)
- `docs/enterprise-upgrade-plan.md` (v2 architecture plan)
- `docs/research-v2-improvements.md` (industry research notes)
- `docs/PROJECT_AUDIT_2026.md` (recent full-project audit)

Where the prior documents differ or overlap, this document is the authoritative version.

---

## 0. How to read this document

If you have 5 minutes → read §1 (Executive Summary) and §11 (Prioritized Roadmap).
If you are an engineer about to start work → read §1, §4 (current state), §6-§8 (the three work packages), §11.
If you are a stakeholder → read §1, §2 (vision), §3 (industry position), §11.

---

## 1. Executive Summary

### 1.1 State of the product

The UI Audit application is a functionally ambitious All-in-One auditing platform — scanning a target URL across multiple device viewports, running an industry-standard audit stack (`axe-core`, Lighthouse, HTMLHint, CSS analyzer, security-header checks), producing annotated screenshots, and layering optional AI vision analysis. It also includes a site-wide SEO crawler with SEMrush/Screaming Frog-style data extraction.

It is, today, **a well-architected advanced demo**. The foundation is sound; the execution is not yet enterprise-grade. Three categories of problem prevent the product from being credibly sold as an enterprise audit suite:

1. **Reliability of core outputs** — the two artifacts the product delivers (screenshots and reports) are both broken in ways a customer will notice within the first scan. Screenshots fail on modern marketing sites (the reveal-footer, sticky-header, background-video combination we confirmed on `americas.land`). Reports present thirteen overlapping categories with no prioritization, compliance mapping, or executive-level summary.
2. **A dysfunctional AI layer** — every AI analysis call currently misdeclares the image MIME type, silently degrading or failing the analysis. The model identifiers are outdated. Responses are parsed with regex. There is no cost tracking, no retry, and no structured-output contract.
3. **Product-market fit gaps vs. enterprise expectations** — no authentication, no multi-tenancy, no scheduled scans, no regulatory compliance matrix (WCAG 2.2 AA / EAA / ADA Title II / Section 508), no baseline / trend view, no ticketing integration, no CI/CD story.

These three categories are addressable. The work is scoped and prioritized in this document as three work packages (A, B, C) and seven sprints.

### 1.2 The three immediate work packages

| Pack | Title | Focus | Effort | Why first |
|------|-------|-------|--------|-----------|
| **A** | Screenshot engine rewrite | Replace tile-and-stitch with CDP native + layout-aware stabilization | 3–5 days | Without reliable screenshots the tool cannot be trusted |
| **C** | AI layer fix | Correct MIME type, update models, structured output, cost tracking | 1–2 days | Currently silently broken; quick unblock |
| **B** | Report information architecture | Consolidate 13 → 6 categories, add executive view and compliance matrix, refactor oversized components | 5–8 days | Requires A first so customers see trustworthy evidence |

User-approved order: **A → C → B**.

### 1.3 The top ten blockers (unchanged from PROJECT_AUDIT_2026.md, revalidated)

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| 1 | AI providers send WebP screenshots declared as PNG `media_type` | Blocker | `src/lib/ai/claude.ts:31`, `src/lib/ai/openai.ts:31` vs `src/lib/scanner/capture.ts:339,373,493,497` |
| 2 | Application is fully public — no authentication, rate limiting, or SSRF controls | Blocker | No `src/middleware.ts`; all API routes unauthenticated |
| 3 | Reveal-footer pattern (`position: sticky; z-index: -999`) is excluded from screenshot content height by our own heuristic | Blocker (UX) | `src/lib/scanner/capture.ts:621-633` |
| 4 | BullMQ worker is started inside the Next.js API process — no horizontal scaling, lost on restart | P0 | `src/app/api/scans/route.ts:10-17` |
| 5 | Fixed Chromium remote debugging port (9222) + `concurrency: 1` globally serialize scans | P0 | `src/lib/scanner/browser.ts:28`, `src/lib/queue/scan-worker.ts:176` |
| 6 | Global mutable `lastLighthouseScores` in module scope corrupts concurrent scans | P0 | `src/lib/audit/engine.ts:36` |
| 7 | SSE event bus is in-process memory — incompatible with out-of-process workers | P0 | `src/lib/queue/scan-events.ts` |
| 8 | Real OpenAI API key committed to local `.env` (not in git history but visible on disk) | P0 | `.env:9` |
| 9 | UI claims glob patterns for crawl exclusion; implementation uses literal `.includes()` | P1 | `src/components/crawl/crawl-form.tsx:279` vs `src/lib/crawler/crawler.ts:101-104` |
| 10 | Zero test coverage | P1 | `package.json` has no `test` script |

### 1.4 Strategic recommendation

Stop positioning the tool on breadth (13 categories, every viewport, every engine) and start positioning it on **trustworthy depth**. Enterprise buyers at the level we are targeting — Siteimprove, Deque Axe Monitor, DebugBear, Sitebulb — compete on (1) accuracy, (2) compliance reporting, (3) workflow integration (Jira/CI/Slack), and (4) a clear chain of custody from "finding" to "fix" to "verified fix". None of them is won or lost on "how many device presets do you support." Re-orient the product around these four axes.

---

## 2. Vision Statement

### 2.1 What we are building

An enterprise-grade All-in-One web audit platform. Customers point it at a URL (or a domain, or a list of URLs) and receive, in a single unified report, technical findings across:

- **Accessibility** — WCAG 2.2 A/AA/AAA mapped to regulatory frameworks (EAA, ADA Title II, Section 508, EN 301 549)
- **Performance** — Lighthouse lab metrics plus optional field data (CrUX), with actionable opportunities ranked by impact
- **SEO** — on-page audit plus whole-site crawl (titles, meta, structured data, canonicals, internal link graph, indexability)
- **Security** — response-header posture, mixed content, vulnerable library detection, OWASP Top 10 surface review
- **UI/UX quality** — visual consistency, responsive integrity, touch target sizing, typography hygiene
- **AI-augmented judgment** — contextual alt text, design critique, and fix suggestions that require human-level visual reasoning

### 2.2 What makes it "enterprise-grade"

The question every enterprise procurement team asks. Our answer must cover all of the following:

| Dimension | Requirement |
|-----------|-------------|
| Authentication | SSO/SAML/OIDC; at minimum API tokens and session-based user auth |
| Authorization | Role-based access (Admin/Auditor/Viewer); row-level tenancy |
| Compliance mapping | Explicit WCAG 2.2 AA, EAA, ADA Title II, Section 508, EN 301 549 tracking |
| Scheduling | Cron-style recurring scans with diff alerts |
| Integration | Jira / Linear ticketing, Slack / Teams / Email notifications, GitHub / GitLab CI |
| Observability | Structured logs, metrics, tracing, audit log of user actions |
| Data governance | Retention policies, GDPR-compliant deletion, data residency controls |
| Reliability | 99.9% SLA-achievable architecture (workers separated, idempotent jobs, health checks) |
| Cost governance | Per-workspace budget tracking for AI API usage |
| White-label | Custom branding, logo, colors for reports and PDFs |
| Export | PDF, CSV, XLSX, JSON; webhook delivery of results |
| Documentation | Public API docs, SDK, tutorials |
| Support | Audit trail, screenshot evidence archive, historical comparison |

Today we meet **zero** of these thirteen dimensions in a production-ready way. This is the gap.

### 2.3 Positioning against competition

| Product | Core strength | Weakness | What we can steal |
|---------|---------------|----------|-------------------|
| Google Lighthouse (CLI/Web) | Authoritative web performance; universally trusted scores | Single-page, no tenancy, no history, no policy view | Report IA (Opportunities → Diagnostics → Passed), moving-to-Insights model |
| Siteimprove | Compliance dashboards mapped to EAA/ADA; mature reporting | Expensive; proprietary; slow to scan | Compliance matrix, regulatory tab structure, legal-friendly reports |
| Deque axe DevTools Pro | Accurate violations via `axe-core`; Intelligent Guided Tests | Dev-tool-oriented, weaker for non-technical stakeholders | Violation cards, Jira export, WCAG reference links, "Learn more" pattern |
| Sitebulb | 300+ "Prioritized Hints" with % affected URLs | Desktop-heavy; SEO-oriented | Hint-based severity, % affected surfaces, two-sentence explanations |
| SEMrush Site Audit | Site Health % score; Errors → Warnings → Notices | SEO-centric; limited a11y/perf depth | Single-number health score; Top Issues by priority × frequency |
| Screaming Frog | Unparalleled crawl depth and flexibility | Desktop app; technical users only | Column-oriented data tables; advanced filter/segment UX |
| Percy / Applitools / Chromatic | Visual regression via DOM-snapshot server rendering | Visual-only; requires CI integration | DOM-snapshot as captured evidence; sticky/fixed handled once per snapshot |
| Urlbox | Screenshot-as-a-service with mature sticky/scroll algorithms | API product only; no audit logic | `freeze_fixed` heuristics; `hide` selector; section-based stitch |
| DebugBear | Lighthouse + CrUX trends, scheduled monitoring | Performance-only | Trend view, historical regression alerts |
| Lumar / DeepCrawl | Enterprise whole-site crawl | Crawl-only, expensive | Enterprise crawl config UX, orphan detection, internal link graph |

We are not trying to outdo any single one of these on their core strength. We are trying to deliver **the union of what an accessibility office, an SEO team, a product engineering lead, and a CISO all need from one scan**. That union does not currently exist as a single product.

---

## 3. Industry Benchmark Research (2025–2026)

### 3.1 Screenshot engines

| Vendor | Approach | Sticky/fixed handling | Notes for us |
|--------|----------|-----------------------|--------------|
| **Urlbox** (stitch mode) | Scroll-and-stitch with proprietary heuristics; `freeze_fixed` on by default; user-facing `hide` selector | Detects and captures once; heuristic-based; user can override | Closest to our current approach; mature after 8+ years |
| **Urlbox** (native mode) | CDP `Page.captureScreenshot({captureBeyondViewport: true})` | Renders sticky/fixed in initial layout position once | Fast; fails on lazy/animated content |
| **Playwright `fullPage: true`** | Uses CDP `captureBeyondViewport` internally | Same as Urlbox native | Supports `animations: "disabled"`, `style: <css>`, `mask: [locators]` options; these are critical and we are not using them |
| **Chromatic** (Storybook) | DOM snapshot → server-side render → screenshot | "Captures position:sticky and position:fixed elements in their initial positions once per snapshot" | Excellent pattern; for us overkill but the rendering invariant is correct |
| **Percy** (BrowserStack) | DOM snapshot uploaded → server renders with JS disabled | Captures initial sticky/fixed positions; freezes animations | Visual regression focus; we could adopt the snapshot evidence concept |
| **Applitools Ultrafast Grid** | DOM snapshot + resource upload → server renders in cloud "visual grid" | Same as Percy | Expensive, proprietary |
| **Google Lighthouse** | Uses Chromium `Page.captureScreenshot` | Native; single capture | What our Lighthouse runs already produce |

### 3.2 Key insight from the research

There is no magic. The industry has two viable strategies:

1. **Native CDP capture** — `Page.captureScreenshot({captureBeyondViewport: true, fromSurface: true, optimizeForSpeed: false})`. The browser renders the page as if the viewport were the full document height, handles sticky/fixed elements in their initial position once. Fails when content requires scroll-triggered loading or animations.
2. **Scroll-and-stitch with explicit stabilization** — Scroll through the page first to trigger lazy loads and scroll-based animations, freeze them (via `animations: "disabled"` and CSS injection), then take a native capture. This is what Urlbox calls "stitch mode" and what we are currently doing — but our stabilization layer is incomplete.

The correct engineering answer for us is **hybrid**: scroll-to-bottom to trigger lazy content, wait for network idle and media readiness, scroll back to top, inject a stabilization stylesheet (normalize sticky/fixed positioning for the capture), then take a native CDP full-page capture. This matches what Urlbox stitch mode does internally, and it is the approach Playwright's own `fullPage: true` performs — except we should drive it explicitly rather than trust Playwright's defaults.

### 3.3 Report information architecture (industry conventions)

All of the credible tools converge on a layered structure:

```
Layer 1: Executive overview (single score, trend, top issues)
Layer 2: Category view (per-area gauge, summary, issue list)
Layer 3: Rule / hint detail (description, affected elements, "Learn more")
Layer 4: Element detail (HTML snippet, code fix, screenshot evidence)
Layer 5: Compliance mapping (WCAG criteria, regulatory matrix)
```

Concrete patterns worth adopting:

| Element | Source | What it is | Why it works |
|---------|--------|------------|--------------|
| Gauge scores | Lighthouse | Circular SVG gauge, color by threshold (green ≥90, orange 50-89, red <50) | Instantly legible; industry-familiar |
| Opportunities with savings | Lighthouse | Each issue is labeled with estimated savings ("−1.2s LCP", "−340 KB") | Makes prioritization quantitative |
| Diagnostics section | Lighthouse | Audits that failed but have no direct savings estimate | Separates "fix me" from "informational" |
| Passed Audits (collapsed) | Lighthouse | Completed section for morale and confidence | Signal of completeness; helps auditors defend score |
| 300+ Hints with % URLs | Sitebulb | Each hint shows % of scanned pages affected | Helps prioritize systemic vs isolated problems |
| Two-sentence hint explanations | Sitebulb | "What it is. Why it matters." | Copy-pasteable for tickets |
| Three-tier severity | SEMrush, Lighthouse, axe | Errors / Warnings / Notices (or Critical / Serious / Moderate) | Universal vocabulary; cognitively cheap |
| Site Health % score | SEMrush | Single 0-100% figure based on errors/warnings vs checks | Non-technical executive metric |
| Compliance tab | Siteimprove | Dedicated tabs per regulation (EAA, ADA, Section 508) with per-criterion pass/fail | Makes legal/compliance teams trust the tool |
| Intelligent Guided Tests | Deque axe DevTools Pro | Guided manual checks for criteria that automated tools cannot verify | Makes a11y audits legally defensible |
| Jira export | axe DevTools Pro, Siteimprove | One-click conversion of issues to tickets | The feature that wins enterprise deals |
| WCAG reference on every a11y issue | axe DevTools | Link to the specific success criterion, with summary | Expected by accessibility auditors |

### 3.4 AI vision best practices (Claude, GPT-5)

| Finding | Claude (Sonnet 4.5 / Opus 4.7) | OpenAI (GPT-5 / GPT-5.4) | Implication for us |
|---------|-------------------------------|--------------------------|---------------------|
| Supported formats | JPEG, PNG, GIF, WebP | JPEG, PNG, WebP, GIF | WebP is fine — our MIME-type declaration is the bug, not the format |
| Max image dimensions | 8000×8000 px per image; downscaled to native resolution | GPT-5.4 "original" detail up to 6000 px long edge; "high" up to 2048 px | Our 1920×8000 screenshots get downscaled and **detail is destroyed** |
| Native resolution (what the model sees) | 1568 px long edge (pre-Opus), 2576 px (Opus 4.7) | 2048 px high / 768 px low / 6000 px original | Viewport-sized screenshots (1920×1080) fit natively with full detail |
| Token calculation | `width × height / 750`, capped at ~1568 tokens per image | 170 tokens per 512×512 tile + 85 base for "high"; 85 fixed for "low" | Cost is roughly predictable; not sending oversized images is a waste |
| Multi-image per request | 100 per request (200k-ctx models) | Multiple supported | We send 3; fine |
| Structured output | `tool_use` for JSON schema | `response_format: { type: "json_schema" }` | We currently use regex parsing; switch to structured output on both |
| Files API (deduplication) | Supported — upload once, reference by `file_id` | Not as first-class, but `gpt-5` base64 inline works | For recurring scans, cache screenshots |
| Image-before-text prompting | Explicitly recommended | Implicit | Our prompt order (image, text) is correct |
| Pricing (2026) | Sonnet 4.5: $3/$15 per 1M tokens; Opus 4.7: $5/$25 | GPT-5: $1.25/$10; GPT-5.4: $2.50/$15 | Per-image cost: ~$0.005 full-detail Claude; ~$0.01 GPT-5 high |

### 3.5 Critical AI-pipeline implications

Our current AI pipeline sends up to three screenshots at 1920×8000 px each. These are **downscaled to 376×1568 on Claude** before the model sees them — the resolution at which UI details (icons, small text, button states) are below the model's discrimination threshold. We are paying for a failing pipeline.

The correct architecture sends:
- One viewport-only screenshot (1920×1080 desktop / 412×823 mobile) per device at **full native resolution** for detail work
- Optionally a reduced-scale full-page thumbnail (max 1568 px long edge) for layout understanding
- Structured context: axe-core violations, Lighthouse failure titles, DOM skeleton

This cuts token cost by ~10x and increases output quality because the model can actually see the pixels.

---

## 4. Current State Assessment

### 4.1 Architecture snapshot

```
┌──────────────────────────────────────────────────────────┐
│ Next.js 16 (App Router) — renders UI + hosts API routes  │
│                                                          │
│  ┌──────────┐   ┌────────────┐   ┌───────────────────┐   │
│  │ Pages    │   │ API routes │   │ In-process worker │   │
│  │ (RSC)    │◀─▶│ (REST)     │◀─▶│ (BullMQ)          │   │
│  └──────────┘   └────────────┘   └──────┬────────────┘   │
│                                         │                │
│              In-memory SSE pub/sub ◀────┘                │
└─────────────────────────────────┬────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Postgres 16  │  │ Redis 7      │  │ Chromium     │
        │ (Drizzle)    │  │ (BullMQ)     │  │ (Playwright) │
        └──────────────┘  └──────────────┘  └──────────────┘

External APIs: Anthropic (Claude), OpenAI (GPT-4o)
External tools in-process: Lighthouse 13, axe-core, HTMLHint, CSS analyzer
Storage: Local filesystem /public/screenshots (Docker volume)
```

### 4.2 Feature inventory (what works today)

| Area | Works | Partial | Broken |
|------|-------|---------|--------|
| Scan creation | ✓ | | |
| Batch scan (multiple URLs) | ✓ | | |
| Multi-device capture | ✓ | | Concurrency bottleneck |
| Full-page screenshot | | ✓ (fails on sticky/video/reveal patterns) | |
| axe-core accessibility | ✓ | | |
| Lighthouse performance/SEO/best-practices | | ✓ (Chromium only, serial desktop+mobile) | |
| HTMLHint / CSS analyzer | | ✓ (CSS analyzer fails on cross-origin stylesheets) | |
| Security header audit | ✓ | | |
| Typography / touch-target / responsive / visual (custom rules) | ✓ | | |
| Form checks (`runFormChecks`) | | | Never called (dead code) |
| AI vision analysis | | | MIME type wrong, detail lost, regex-parsed output |
| AI remediation (per-issue fix) | | ✓ (single-element only) | |
| SEO crawler | ✓ | | `includes()` instead of glob; `securityHeaders` never populated |
| Crawl comparison (diff) | ✓ | | |
| Duplicate content detection (simhash) | | ✓ (logic exists, no UI) | |
| PDF export | | ✓ (all-in-memory, OOM risk) | |
| CSV export (crawl) | ✓ | | |
| Report tabs (5 tabs) | ✓ | | IA is overloaded |
| Annotation overlay | ✓ | | Coordinate frame mismatch on high-DPR |
| SSE progress | ✓ | | In-process only |
| Job cancellation (scan) | ✓ | | Crawl has no cancel |
| Dark mode / theming | ✓ | | Contrast not audited |
| Mobile responsive UI | | ✓ (tables overflow on some pages) | |
| Authentication | | | None |
| Rate limiting | | | None |
| Multi-tenancy | | | None |
| Scheduled scans | | | None |
| Webhooks | | | None |
| Jira / Slack integration | | | None |
| Tests | | | None |

### 4.3 Technical debt indicators

- **Five separate `AuditIssueInput` interface declarations** across runners (`axe-runner.ts`, `lighthouse-runner.ts`, `html-runner.ts`, `css-runner.ts`, `security-runner.ts`) with minor variations
- **`parseAiResponse` copy-pasted** between `claude.ts` and `openai.ts`
- **Dead files**: `audit/rules/accessibility.ts`, `performance.ts`, `seo.ts` are 3-line stubs; `audit/rules/forms.ts`'s `runFormChecks` is never invoked
- **`crawl-tabs.tsx` is 1,335 lines**; `lighthouse-report.tsx` is 735 lines
- **Any-casts** in critical paths: `audit/engine.ts:80` (axe results), `api/scans/[id]/pdf/route.ts:109,151` (jsPDF internals)
- **Module-scope mutable state**: `lastLighthouseScores` in `audit/engine.ts:36` — thread-unsafe global
- **Mixed config sources**: `Dockerfile:21` hard-codes dependency versions that must be kept in sync with `package.json`

---

## 5. Cross-cutting engineering concerns

These are issues that cut across all three work packages. They are not "in" Pack A, B, or C — they are the substrate on which A, B, and C rest.

### 5.1 Security (deferred but tracked)

The customer has explicitly chosen to defer security. This section is a standing item, to be picked up in Sprint 1 following screenshot and AI fixes. Full detail in `PROJECT_AUDIT_2026.md` §1.

Must-do in Sprint 1 (already agreed):

1. Revoke the OpenAI key in `.env:9` and rotate
2. Sandbox Chromium (remove `--no-sandbox` from `browser.ts:31`, use Docker user namespace)
3. URL allowlist + private IP blocklist (SSRF defense)
4. Rate limiting on `POST /api/scans`, `POST /api/crawls`, `POST /api/remediate`
5. Authentication token / session layer
6. Security headers on our own app (`next.config.ts`)

### 5.2 Database and performance

Issues documented in `PROJECT_AUDIT_2026.md` §3–4. Must-do in Sprint 3:

1. Add indexes on all foreign keys and `created_at` columns
2. Add `workspace_id` / `user_id` to every table (multi-tenancy)
3. Split large JSONB (lighthouse_json, pageHtml, pageCss, domSnapshot, axeResults) into a separate blob table or S3
4. Data retention policy (scheduled deletion)
5. Run Lighthouse desktop + mobile in parallel
6. Stream CSV and PDF exports instead of buffering
7. Connection pool configuration on `postgres(DATABASE_URL)`

### 5.3 Observability

Currently nonexistent. Must-do in Sprint 6:

- `pino` structured logging with per-scan `scanId` correlation
- Prometheus metrics endpoint (scan duration histogram, queue depth, AI cost counter)
- OpenTelemetry trace spans across API → worker → DB → external
- BullMQ dashboard (`bull-board`)
- Sentry / equivalent error aggregator
- Request ID propagation through all layers

### 5.4 Testing

No automated tests exist. Must-start in Sprint 7 (continuing thereafter):

- Vitest unit tests for pure-logic modules: `simhash.ts`, `robots.ts`, `scoring.ts`, `mapper.ts`, `parseAiResponse`, `detectContentHeight`
- Playwright E2E for the three core flows: single scan, batch scan, SEO crawl
- Integration tests for the audit engine with mocked Playwright pages
- Visual regression for the report UI using our own tool on a stable demo site (dogfooding)
- Pre-commit: lint, type-check, unit test
- CI: GitHub Actions with PR checks, Docker build, integration tests

---

## 6. Pack A — Screenshot engine rewrite

**Priority: 1st. User-approved as highest priority.**

### 6.1 Root cause analysis: the `americas.land` case study

#### 6.1.1 Live site observations

`americas.land` is a WordPress site built with Elementor and Elementor Pro. It exhibits all three screenshot failure modes in a single page:

1. **Sticky header** — `data-settings="{...,"sticky":"top","sticky_parent":"yes","sticky_offset":0}"`. Elementor Pro's sticky module applies `position: fixed` inline via JavaScript after initialization. The CSS file `sticky.min.css` (162 bytes) only sets `z-index: 99` on `.elementor-sticky--active`.
2. **Background video** — `<video class="elementor-background-video-hosted" ...></video>` elements with empty `src`. Elementor Pro's frontend JS reads `data-settings.background_video_link` (e.g., `/wp-content/uploads/2026/01/montage-edit.mp4`) and injects `<source>` or `src` when the element enters the viewport (IntersectionObserver).
3. **Reveal footer** — the inline custom CSS in `wp-content/uploads/elementor/css/post-1162.css:24-28` contains:
   ```css
   .footer-dustin {
       width: 100%;
       position: sticky;
       bottom: -400px;
       z-index: -999 !important;
   }
   ```
   This is the reveal pattern: the footer sticks to 400px below the viewport bottom, behind other content (negative z-index), and "reveals" as the user scrolls past the main content.

#### 6.1.2 Our current code produces three distinct failures on this page

**Failure A — reveal footer disappears.** `src/lib/scanner/capture.ts:621-633` excludes all elements with negative `z-index` (and their descendants) from the content-height calculation:

```ts
// src/lib/scanner/capture.ts, lines 621-633 (paraphrased)
for (const el of Array.from(allForZCheck)) {
  const z = parseInt(style.zIndex, 10);
  if (!isNaN(z) && z < 0) {
    negativeZContainers.add(el);
    const descendants = el.querySelectorAll("*");
    for (const d of Array.from(descendants)) {
      negativeZContainers.add(d);
    }
  }
}
// ...later:
if (negativeZContainers.has(el)) continue; // don't count in contentHeight
```

The reveal footer (`z-index: -999`) is classified as "background decoration" and excluded. Our screenshot therefore ends at the point where main content ends, leaving the bottom 400-800px as blank white space where the footer should be visible.

**Failure B — background video frames are blank.** `src/lib/scanner/capture.ts:73-195` attempts to capture video frames by calling `video.play()` then drawing the current frame to a canvas overlay. However:

1. The `<video>` elements on americas.land start with empty `src`. Elementor's JS injects the source only after the element enters the viewport.
2. Our `waitForMediaToLoad` runs once before `smartAutoScroll`, then again after. Between those runs, the IntersectionObserver fires as we scroll — but Elementor's JS may still be loading the video asset.
3. If we capture before the `src` is set, `video.readyState` is 0 and no frame exists; the video tag is effectively empty. The fallback image set in Elementor's background settings never activates because the video element has never errored — it is merely not loaded.

**Failure C — sticky header tiles repeat or disappear.** Our tile-and-stitch mechanism (`capture.ts:399-438`) iterates through `numTiles` scroll positions. On each iteration, `setVisibilityByCaptureId` hides sticky/fixed elements except on the first (for headers) and last (for footers) tiles. This works for ordinary sticky headers but misbehaves for:
- Elementor Pro sticky headers (applied via JS `position: fixed` inline styles, which our visibility override does not account for in all orderings)
- The reveal footer, which has `position: sticky` + `z-index: -999` — we mark it as "other" (not header, not footer) and hide it on every tile

#### 6.1.3 The underlying design flaw

Our engine combines three orthogonal responsibilities:

1. Deciding how tall the rendered page *should* be (`detectContentHeight`)
2. Deciding how to iterate through the page (scroll-and-tile)
3. Deciding how to neutralize problematic elements (hide/show sticky)

The heuristics for (1) and (3) are coupled with assumptions about (2). When a page uses non-standard patterns (reveal footer, JS-driven sticky, lazy-loaded video), the heuristics fail — and because all three decisions are interwoven, failures compound.

The industry standard — as confirmed by Urlbox, Chromatic, Percy, and Chromium itself — is to decouple these:

- Pre-capture: drive the page (scroll, wait for network, wait for media) to a stable state
- Stabilize: inject CSS to normalize animations and optionally sticky positioning
- Capture: let the browser produce a single full-page image via CDP

### 6.2 Target architecture

#### 6.2.1 Phase-oriented capture pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1 — Navigate                                           │
│   - page.goto(url, { waitUntil: "domcontentloaded" })        │
│   - Set consistent viewport (viewport-sized DPR-aware)       │
├─────────────────────────────────────────────────────────────┤
│ Phase 2 — Load                                               │
│   - page.waitForLoadState("load")                            │
│   - Wait for document.fonts.ready                             │
│   - Wait for all <img> with src to complete (bounded)         │
│   - Wait for <video> src injection (bounded, Elementor-aware) │
├─────────────────────────────────────────────────────────────┤
│ Phase 3 — Drive (trigger lazy content)                       │
│   - Smooth auto-scroll to bottom (trigger IntersectionObserver│
│     for lazy images, videos, animations)                      │
│   - page.waitForLoadState("networkidle", { timeout: 3000 })   │
│   - Wait for all media to have a frame (readyState >= 2)      │
│   - Re-check for deferred <img src> attribute assignment      │
├─────────────────────────────────────────────────────────────┤
│ Phase 4 — Stabilize                                          │
│   - Scroll back to top (smooth or instant)                   │
│   - Inject stabilization stylesheet:                          │
│       * .elementor-sticky--active { position: static !important; top: auto !important; } │
│       * [data-sticky], [data-fixed] similar                   │
│       * * { animation-play-state: paused !important;          │
│              transition: none !important; }                   │
│     (Playwright's screenshot() option `style:` does this)     │
│   - Wait a small settle time (200ms) for layout              │
├─────────────────────────────────────────────────────────────┤
│ Phase 5 — Capture                                             │
│   - page.screenshot({ fullPage: true, animations: "disabled", │
│                       scale: "css", style: stabilizeCss,      │
│                       type: "jpeg", quality: 85 })             │
│   - (Under the hood this uses CDP Page.captureScreenshot       │
│     with captureBeyondViewport: true)                         │
├─────────────────────────────────────────────────────────────┤
│ Phase 6 — Post-process                                        │
│   - Compute SHA-256 hash for caching                          │
│   - Write WebP version (for UI display, quality 80)          │
│   - Write viewport-sized JPEG (for AI analysis, first 1080px) │
│   - Store exact dimensions in DB                              │
└─────────────────────────────────────────────────────────────┘
```

#### 6.2.2 Why this works

- **Native CDP capture** renders the page as if the viewport equaled the document height. Position:sticky and position:fixed elements appear in their initial layout positions once, as the layout engine intends. The reveal footer, with `position: sticky; bottom: -400px`, will appear 400px below the main content end, visible in the final rendered stretch — which is exactly what the site's design intends.
- **The stabilization stylesheet** converts `position: sticky` / `position: fixed` to `position: static` *for the screenshot pass only*. This is what Chromatic does by default. It eliminates the "sticky element appears floating mid-page" artifact.
- **animations: "disabled"** ensures that CSS transitions are fast-forwarded to their end state and infinite animations are paused to their initial state — consistent visual output.
- **Scroll-drive-then-capture** handles lazy-loaded images and Elementor-style deferred video src injection. We drive the page to a fully-loaded state first, then stabilize, then capture — this separates concerns cleanly.
- **Viewport-sized second capture** gives AI the high-detail image it needs without the downscaling penalty.

#### 6.2.3 Expected outcomes on americas.land

| Current failure | After new pipeline |
|-----------------|---------------------|
| Reveal footer missing, 800px blank area | Reveal footer visible in its natural position (400px below content end) |
| Background video blank | Video shows first rendered frame (or poster if still loading) |
| Sticky header duplicated per tile | Header appears once at the top of the image |
| Inconsistent stitching seams | No seams — single native capture |

### 6.3 Implementation plan — Pack A

#### 6.3.1 Files to modify

| File | Change |
|------|--------|
| `src/lib/scanner/capture.ts` | Remove `tagAndIdentifyElements`, `setVisibilityByCaptureId`, `cleanupCaptureIds`, the tile-and-stitch path, and the negative-z filter in `detectContentHeight`. Replace with pipeline above. |
| `src/lib/scanner/capture.ts` | Add `stabilizeCss` string (see 6.3.2). |
| `src/lib/scanner/capture.ts` | `takeScreenshot()` becomes: scroll drive → stabilize → `page.screenshot({ fullPage: true, ... })` → sharp post-process. |
| `src/lib/scanner/capture.ts` | Add `captureViewportOnly` helper that returns the initial viewport-sized JPEG for AI use. |
| `src/lib/scanner/browser.ts` | Remove hardcoded debugging port (move to Pack A.2 below). |
| `src/lib/scanner/browser.ts` | Ensure `--no-sandbox` is removed (Sprint 1). |
| `src/lib/db/schema.ts` | Optional: add `viewport_results.viewport_screenshot_path` column for the AI-sized capture. |
| `src/components/report/screenshot-gallery.tsx` | No change needed; receives same `screenshotPath`. |

#### 6.3.2 The stabilization stylesheet

```css
/* Normalize sticky/fixed positioning for screenshot fidelity */
[class*="elementor-sticky"],
[class*="is-sticky"],
[data-sticky="true"],
.sticky-header,
.sticky-footer {
  position: static !important;
  top: auto !important;
  bottom: auto !important;
  left: auto !important;
  right: auto !important;
  transform: none !important;
}

/* Pause all animations and transitions */
*,
*::before,
*::after {
  animation-play-state: paused !important;
  animation-delay: -1ms !important;
  animation-duration: 1ms !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}

/* Ensure video elements show their first frame if playing */
video {
  animation: none !important;
}
```

This is applied only during the screenshot call via Playwright's `style:` option. It does not alter the DOM, is not visible to users, and is reverted automatically when the screenshot completes.

#### 6.3.3 Decision log

- **Keep Playwright `page.screenshot({fullPage: true, ...})` rather than direct CDP call.** Playwright internally uses CDP and handles device emulation, retina scaling, and JPEG encoding correctly. A direct CDP call gives marginal speed advantage but loses Playwright's abstractions.
- **Drop the tile-and-stitch path entirely.** It is the source of most complexity and most bugs. Chromium's 16,384 px dimension limit is only reached on pathological pages (documented hacks around it exist if needed later).
- **Keep Sharp post-processing.** WebP conversion at quality 80 gives good compression; viewport-cropped JPEG for AI.
- **Remove `smartAutoScroll` fixed 150ms step delay** — replace with an adaptive "until scrollY stops changing or bottom reached" loop plus `networkidle` wait.

#### 6.3.4 Acceptance criteria

1. Full-page screenshot of `americas.land` home page shows:
   - Sticky header at top, once, not repeated
   - Background videos rendered (first frame or poster)
   - Reveal footer visible at the correct position
   - No blank trailing whitespace
2. Full-page screenshot completes in ≤ 15s for desktop, ≤ 20s for mobile, against this page
3. Resulting image is ≤ 1.5 MB WebP (quality 80) at 1920 px wide
4. AI-sized viewport capture is a separate 1920×1080 JPEG at quality 90, ≤ 400 KB
5. No changes to report UI are required; same `screenshotPath` resolves

#### 6.3.5 Test matrix (Sprint 7 dogfooding)

Run new pipeline against a curated set of reference sites, inspect output:

| Site / pattern | Expected |
|----------------|----------|
| `americas.land` (reveal footer + sticky header + bg video) | All three patterns render correctly |
| `vercel.com` (heavy animation + sticky nav) | Animations paused, sticky nav at top once |
| `stripe.com` (gradient canvas + lazy images) | Canvas captured, all images loaded |
| `apple.com/iphone` (scroll-driven animations) | First-frame state captured |
| `en.wikipedia.org/wiki/JavaScript` (very long article) | Completes; no 16k truncation on desktop |
| `news.ycombinator.com` (plain, short) | Single tile, exactly content height |
| A page with `<iframe>` | Iframe contents captured if same-origin |

---

## 7. Pack C — AI layer fix

**Priority: 2nd. Quick unblock.**

### 7.1 Current state bugs (all in one place)

| # | Bug | Evidence | Severity |
|---|-----|----------|----------|
| C1 | WebP screenshots declared as PNG | `src/lib/ai/claude.ts:31`, `src/lib/ai/openai.ts:31` vs `src/lib/scanner/capture.ts:339` | Blocker — fails or degrades every analysis call |
| C2 | Model identifiers hardcoded and outdated | `claude.ts:42` uses `claude-sonnet-4-20250514`; `openai.ts:42` uses `gpt-4o`; `api/remediate/route.ts:79` also outdated | P0 |
| C3 | Full-page 1920×8000 images sent to AI; downscaled to 376×1568; detail lost | `src/lib/ai/provider.ts:53-56` sends `imagePath` = full-page screenshot | P0 |
| C4 | OpenAI lacks `response_format: { type: "json_schema" }`; responses parsed by regex | `openai.ts:41-48`, `parseAiResponse` in both | P0 |
| C5 | Claude lacks `tool_use` with schema for structured output | `claude.ts:41-46` | P0 |
| C6 | `parseAiResponse` duplicated identically in `claude.ts` and `openai.ts` | Both files | P1 |
| C7 | No retry / timeout on AI calls | Neither `claude.messages.create` nor `openai.chat.completions.create` has a signal | P0 |
| C8 | No cost tracking; `response.usage` is discarded | Neither file reads `usage` tokens | P1 |
| C9 | Screenshots read from filesystem directly (path-traversal adjacent) | `claude.ts:22-25`, `openai.ts:22-25` | P1 — OK pattern, but could use abstraction |
| C10 | No batch remediation endpoint; N issues = N sequential API calls | `src/app/api/remediate/route.ts` handles single `issueId` | P1 |
| C11 | AI context (`buildAuditContext`) sends violation **titles** only; axe-core selectors, HTML snippets not included | `src/lib/ai/provider.ts:153-168` | P1 |
| C12 | Severity mismatch: AI issues are not validated against the enum; "high" from Claude falls through to `info` | `parseAiResponse` in both files: `severity: (issue.severity as string) || "info"` | P1 |
| C13 | `MEMORY.md` (auto-memory) notes hybrid AI toggle preference, but scan form only allows single-provider selection | `scan-form.tsx:249-266` | P2 |

### 7.2 Target AI architecture

#### 7.2.1 Input strategy

```
For each scan, AI receives:
  - 1 viewport-sized screenshot per device (1920×1080 desktop, 412×823 mobile) — full detail
  - Optional: 1 reduced full-page thumbnail per device (max 1024 px tall, low-detail) for layout context
  - Structured context block:
      - Top 15 accessibility violations with element selectors and HTML snippets
      - Top 10 Lighthouse failures with displayValue and savings
      - DOM skeleton (headings hierarchy, nav count, form count, image count)
      - Browser engine + device name
```

#### 7.2.2 Output contract (structured)

Define a single JSON schema shared by Claude (`tool_use`) and OpenAI (`response_format: json_schema`):

```typescript
interface AiAnalysisOutput {
  issues: Array<{
    severity: "critical" | "warning" | "info";  // enum enforced by schema
    title: string;
    description: string;
    recommendation: string;
    codeFix: {
      before: string;
      after: string;
      language: "html" | "css" | "javascript";
    } | null;
    viewport: string;
    region: {
      x: number;
      y: number;
      width: number;
      height: number;
      coordinateSpace: "screenshot";  // always screenshot pixels
    } | null;
    wcagCriteria: string[] | null;
  }>;
  altTextSuggestions: Array<{
    elementDescriptor: string;
    suggestedAlt: string;
    viewport: string;
    rationale: string;
  }>;
  designCritique: {
    hierarchy: string;
    navigation: string;
    readability: string;
    crossViewportAdaptation: string;
  };
  summary: string;
}
```

This replaces both `parseAiResponse` implementations with a typed parse (using `zod` for validation) and eliminates the regex-match fragility.

#### 7.2.3 Provider wrapper

Abstract both providers behind a common interface:

```typescript
interface AiProviderClient {
  analyze(input: AiAnalysisInput): Promise<AiAnalysisOutput>;
}
```

`input` contains: screenshots (as buffers + dimensions), context, provider-specific options.

Implementation goals:
- Shared `zod` schema for parse-and-validate
- Shared cost-tracking (read `usage` tokens, record to DB per scan)
- Shared retry with exponential backoff (3 attempts; 2s, 8s, 30s)
- Shared 60s timeout per call
- Provider-specific only: API client, request construction, structured-output invocation

#### 7.2.4 Model selection

Based on 2026 pricing and capability research:

| Role | Recommended model | Rationale |
|------|--------------------|-----------|
| Primary vision analysis | Claude Sonnet 4.5 (or Sonnet 4.6 if stable) | Balances cost and quality; structured `tool_use` mature; WebP native |
| High-fidelity vision (optional premium tier) | Claude Opus 4.7 | 2576 px native resolution; 3x token budget — for enterprise customers willing to pay |
| OpenAI alternative | GPT-5 | Structured JSON; competitive on pricing |
| Remediation (HTML fix) | Claude Haiku 4.5 or GPT-5 mini | Small task; cost-optimized |

Model names must be **configurable via environment variables** and surfaced in the settings UI, never hardcoded. Default to the cheapest stable option; let the customer upgrade.

### 7.3 Implementation plan — Pack C

#### 7.3.1 Files to modify

| File | Change |
|------|--------|
| `src/lib/ai/schema.ts` (new) | Shared `zod` schema for `AiAnalysisOutput` |
| `src/lib/ai/provider.ts` | Generic `analyzeWithProvider(provider, input)` dispatcher |
| `src/lib/ai/claude.ts` | Use `tool_use` with schema; read MIME from file signature; track usage; remove `parseAiResponse` |
| `src/lib/ai/openai.ts` | Use `response_format: { type: "json_schema" }`; same updates |
| `src/lib/ai/models.ts` (new) | Model identifiers via env vars; fallback to defaults |
| `src/lib/scanner/capture.ts` | Emit both full-page WebP and viewport-sized JPEG; DB migration for new path column |
| `src/lib/db/schema.ts` | `viewport_results.viewport_screenshot_path` (nullable text) |
| `src/app/settings/page.tsx` | Expose model selection UI per provider |
| `src/app/api/remediate/route.ts` | Use shared provider wrapper; support batch (`issueIds: string[]`) |
| `src/lib/ai/parser.ts` (new) | Single `parseWithSchema(text, schema)` using `zod`; used by remediation too |

#### 7.3.2 MIME type resolution logic

```typescript
function detectMimeFromPath(path: string): "image/jpeg" | "image/webp" | "image/png" {
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}
```

Used in both Claude and OpenAI call sites.

#### 7.3.3 Cost tracking

Add to DB:

```typescript
// src/lib/db/schema.ts
export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id").references(() => scans.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id"),  // nullable until multi-tenancy lands
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  operation: text("operation").notNull(),  // "analyze" | "remediate"
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  imageTokens: integer("image_tokens"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Write a row after every AI call. A dashboard widget displays rolling cost per workspace (once multi-tenancy exists, per-user).

#### 7.3.4 Acceptance criteria

1. Scan with AI enabled completes successfully on a test URL
2. AI output is validated by `zod` — no `any` casts in result mapping
3. `aiUsage` table has a row per scan with non-zero tokens
4. A deliberately malformed AI response triggers retry, not silent failure
5. MIME type in wire payload matches actual file format (verified via instrumented test)
6. Switching provider in the UI actually changes which API is called (verify via usage log)
7. Viewport-sized screenshots are sent to AI, not full-page; detail (small text, icons) is preserved in model output

---

## 8. Pack B — Report information architecture

**Priority: 3rd. Largest refactor, requires Pack A to be trustworthy first.**

### 8.1 Current IA problems

From the `AUDIT_REPORT.md` review and fresh component reading:

1. **13 overlapping categories** create cognitive overload:
   - `accessibility` (axe-core) overlaps with Lighthouse's `accessibility`
   - `performance` (Lighthouse) overlaps with `best-practices`
   - `visual`, `typography`, `touch-targets`, `responsive`, `forms` are all "UI/UX quality" subcategories
   - `html-quality`, `css-quality` are diagnostic sub-indicators of `best-practices`
2. **Five tabs with unclear hierarchy**: Overview, Issues, Lighthouse, Screenshots, By Viewport. "Lighthouse" as a tab name leaks an implementation detail; "By Viewport" duplicates content from "Issues" filtered by viewport.
3. **No executive view**. Dashboard cards show raw totals; the scan detail has no "top 3 issues to fix first" or "executive summary" block.
4. **No compliance mapping**. A scan result does not answer the question "does this page pass WCAG 2.2 AA?"
5. **No benchmark or trend**. A user cannot compare against their own baseline, nor to a prior scan of the same URL.
6. **Severity mismatch between tools**. Same accessibility issue rated `critical` by axe and `info` by Lighthouse — presented without reconciliation.
7. **Issue cards mix concerns**. `issue-card.tsx:149-151` inlines the "Generate Fix" button; `category-detail.tsx:98-162` re-implements most of the same card in a different style.
8. **Component sizes are unmanageable**: `crawl-tabs.tsx` (1,335 lines), `lighthouse-report.tsx` (735 lines). Unsplittable for code review; slow to render.
9. **Color palette is over-saturated**. `bg-red-100`, `bg-amber-100` backgrounds for every severity marker create visual noise. Lighthouse uses subtler treatments.
10. **Progress UI for in-flight scans is three separate cards** — progress bar, viewport list, activity log. Should be one compact card with expandable detail.

### 8.2 Target report architecture

```
┌──────────────────────────────────────────────────────────┐
│ Scan Detail Page                                          │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  [ Hero Banner ]                                          │
│    - Scanned URL                                          │
│    - Site health score (0–100) + grade                    │
│    - Trend arrow vs last scan ("↑ +3 vs 2 days ago")      │
│    - Compliance status badges: WCAG 2.2 AA: 82%           │
│    - CTA: "PDF Report" · "Compare" · "Re-scan"            │
│                                                           │
│  [ Top Issues to Fix (1 card) ]                            │
│    Top 5 issues ranked by priority × frequency            │
│    Each: severity · title · affected page count ·         │
│           estimated savings (if applicable)               │
│    Click → jumps to the issue detail                      │
│                                                           │
│  [ Category Tabs: Performance / Accessibility / SEO /      │
│                     Best Practices / Security / UX ]      │
│                                                           │
│    Within each tab:                                        │
│      • Gauge + metric strip (LCP/CLS/TBT for Perf, etc.) │
│      • Opportunities (with savings)                        │
│      • Diagnostics                                         │
│      • Passed audits (collapsed)                           │
│                                                           │
│  [ Compliance Tab ]                                        │
│    WCAG 2.2 A/AA/AAA checklist — each criterion:          │
│      • Pass / Fail / Not tested (manual review required)   │
│      • Evidence link (which rule gave this result)        │
│      • Regulatory mapping: EAA ✓, ADA Title II ✓,          │
│                             Section 508, EN 301 549       │
│                                                           │
│  [ Visual Evidence Tab ]                                   │
│    Per-viewport split: annotated screenshot + issue list   │
│    (This is our current "By Viewport" view, kept and       │
│     polished)                                              │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 8.3 Category consolidation

From 13 to 6:

| New category | Absorbed from | Rationale |
|--------------|---------------|-----------|
| **Performance** | `performance` (Lighthouse) + perf-related `best-practices` | Matches Lighthouse; universal vocabulary |
| **Accessibility** | `accessibility` (axe + Lighthouse a11y), `touch-targets`, `forms` (a11y subset) | Everything WCAG-mappable goes here |
| **SEO** | `seo` (Lighthouse) + crawl-specific hints (applied to single-page scan) | Matches Lighthouse; extensible via crawl |
| **Best Practices** | `best-practices` (Lighthouse) + `html-quality` + `css-quality` | Technical hygiene grouping |
| **Security** | `security` (header checks) + future OWASP expansions | Own category; compliance-critical |
| **UX Quality** | `responsive`, `typography`, `visual`, non-a11y form checks | Everything design-quality that is not strictly a11y |
| ~~AI Insights~~ | `ai-analysis` | Keep as a non-scoring section shown inline per category |

Database migration: do not change `audit_issues.category` at write time yet; add a view `v_audit_issues_grouped` that maps existing categories to the new six. The UI queries the view. Old data still renders. A follow-up sprint does a data migration to the new categories.

### 8.4 Severity unification

Today: `critical | warning | info | pass` (our internal) plus `critical | serious | moderate | minor` (axe-core) plus Lighthouse's numeric score mapped to severity.

Target unified severity:

| Severity | axe mapping | Lighthouse mapping | Description |
|----------|-------------|---------------------|-------------|
| **Critical** | `critical`, `serious` | Score = 0 AND audit in a WCAG-mapped category | Blocks users or breaks WCAG AA |
| **High** | `moderate` | Score < 0.5 | Significant impact, should fix next release |
| **Medium** | `minor` | 0.5 ≤ Score < 0.9 | Quality improvement, not urgent |
| **Low** | `minor` informational | 0.9 ≤ Score < 1.0 | Notice; nice-to-fix |
| **Pass** | n/a | Score = 1.0 | Done |

This aligns with Sitebulb and SEMrush while preserving backward compatibility with our current `critical | warning | info | pass` wire format — a migration adapter in the scoring layer.

### 8.5 Site Health Score formula (transparent)

Today: opaque per-category deductions, weighted-sum overall, no documentation.

Target: **published, industry-aligned formula**.

```
Overall health score =
  Σ (category_score × category_weight) / Σ (category_weight)

Where:
  Performance.category_score = lighthouse.performance × 100
  Accessibility.category_score = lighthouse.accessibility × 100
     (fall back to deduction model if lighthouse a11y unavailable)
  SEO.category_score = lighthouse.seo × 100
  Best Practices.category_score = lighthouse.best-practices × 100
  Security.category_score = max(0, 100 - Σ security issue weight)
  UX Quality.category_score = max(0, 100 - Σ ux issue weight)

Category weights (tunable, documented):
  Accessibility    25
  Performance      20
  SEO              15
  Best Practices   15
  Security         15
  UX Quality       10
  Total            100
```

Publish this formula in `docs/scoring-methodology.md` and link from the report footer. Enterprise buyers demand a defensible scoring model.

### 8.6 Compliance tab — WCAG 2.2 AA matrix

For every WCAG 2.2 success criterion (87 total: 77 from 2.1 minus 1 obsolete, plus 9 new in 2.2 + 2 more), show:

| Column | Content |
|--------|---------|
| Criterion | `1.4.3 Contrast (Minimum)` |
| Level | AA |
| Status | **Pass** / **Fail** / **Needs manual review** / **Not applicable** |
| Evidence | Link to the rule that determined the status (e.g., axe `color-contrast`) |
| Affected elements | Count + link |
| Regulatory impact | EAA ✓ · ADA Title II ✓ · Section 508 ✓ · EN 301 549 ✓ |

Sources for automated pass/fail mapping: axe-core provides explicit WCAG tag mapping via `violation.tags` (e.g., `wcag2aa`, `wcag143`). We already store `wcagTags` in our issue details; we just need to surface it as a compliance view.

This is the feature that wins accessibility-conscious enterprise buyers.

### 8.7 UI polish standards

Concrete changes to the shadcn/Tailwind presentation layer:

| Area | Today | Target |
|------|-------|--------|
| Severity colors | `bg-red-100 text-red-800` full saturation | `bg-red-50 border-l-4 border-red-500`, subtler |
| Primary hue | `oklch(0.646 0.222 41.116)` (orange) | Reserved for CTA; move brand accent to blue/teal for enterprise feel |
| Density | Cards stacked tight (`gap-2`) | `gap-6` for sections, `gap-4` within |
| Typography scale | Mixed `text-sm` / `text-base` / `text-xs` | Define 4-level scale: Display, H1, H2, Body, Caption |
| Progress bar | 3 separate cards | 1 card, inline expandable detail |
| Tab content transition | `animate-in fade-in-0 duration-200` | Keep; good as-is |
| Data tables | `overflow-x-auto` on mobile | Card-layout fallback below `md:`; hide low-priority columns |
| Empty states | Plain text | Icon + title + description + primary CTA (already partially done in `EmptyState` — use consistently) |
| Confirmation modals | Native `confirm()` | shadcn `AlertDialog` with focus trap |
| Color contrast | Unverified | Audited by our own tool during CI |

### 8.8 Component refactoring targets

| Today | Split into |
|-------|------------|
| `crawl-tabs.tsx` (1,335 lines) | One file per tab: `all-pages-tab.tsx`, `response-codes-tab.tsx`, `titles-tab.tsx`, `meta-tab.tsx`, `headings-tab.tsx`, `images-tab.tsx`, `links-tab.tsx`, `duplicates-tab.tsx`, `site-tree-tab.tsx` |
| `lighthouse-report.tsx` (735 lines) | `lhr-view.tsx`, `audit-item.tsx`, `metric-card.tsx`, `score-gauge.tsx`, `passed-audit-item.tsx` |
| `category-detail.tsx` (219 lines) | Retain as container; extract `rule-group.tsx`, `element-row.tsx` |
| `issue-card.tsx` (180 lines) | Retain; extract `code-diff.tsx`, `annotation-badge.tsx` |

### 8.9 Implementation plan — Pack B

#### 8.9.1 Sprint B-1: Foundation (1-2 days)

1. Add `v_audit_issues_grouped` DB view mapping 13 → 6 categories
2. Add `SEVERITY_MAP` utility that normalizes tool-specific severities to the unified 5-level scale
3. Document the scoring formula in `docs/scoring-methodology.md`
4. Extract duplicated parse / card components into shared modules

#### 8.9.2 Sprint B-2: Executive view (2 days)

1. New `ExecutiveOverview` component — hero banner with single health score, trend, top issues
2. Wire into scan detail page above the existing tabs
3. Add a "Top 5 Issues to Fix" rolled up from all categories, ranked by `severity_weight × affected_count`
4. "Compare to last scan" — query the previous scan of the same URL, diff the scores

#### 8.9.3 Sprint B-3: Category consolidation UI (1-2 days)

1. Replace existing issues tab with 6-category tabs
2. Each tab uses Lighthouse-style layout: gauge + metrics (perf only) + opportunities + diagnostics + passed
3. Pull issue data through the v_audit_issues_grouped view

#### 8.9.4 Sprint B-4: Compliance tab (2 days)

1. Create the 87-row WCAG 2.2 matrix as static configuration
2. For each criterion, map the axe-core rule IDs that test it (source: axe-core's `wcag2aa`, `wcag143`, etc. tag mapping)
3. Aggregate: if any mapped rule failed, criterion = Fail; if all mapped rules pass, criterion = Pass; if no automated rule, criterion = Needs manual review
4. Add per-criterion regulatory badges (EAA, ADA Title II, Section 508, EN 301 549) — these are static maps from WCAG criterion to regulation

#### 8.9.5 Sprint B-5: Component refactoring (1-2 days)

1. Split `crawl-tabs.tsx` into 9 files
2. Split `lighthouse-report.tsx` into 5 files
3. Run the full UI through our own audit tool; capture baseline

#### 8.9.6 Sprint B-6: UI polish (1 day)

1. Replace all `confirm()` with shadcn `AlertDialog`
2. Soften severity color palette
3. Consolidate progress UI to one card
4. Verify contrast with our own a11y scanner

#### 8.9.7 Acceptance criteria

1. Executive view renders before the tabs; visible on mobile without scrolling past a fold
2. Category consolidation: 13 internal categories map to 6 visible tabs; existing scans still render correctly
3. WCAG 2.2 matrix: 87 rows; for a scan of the WebAIM Million sample, 60-80% of rows have automated status, remainder are "Needs manual review"
4. All large components are ≤ 300 lines each
5. Our tool scanning our UI: overall score ≥ 90, accessibility ≥ 95, no critical issues

---

## 9. Enterprise feature gap (tracked for later sprints)

The following are called out from `PROJECT_AUDIT_2026.md` §12 and confirmed against industry research. They belong in Sprints 4–7+.

### 9.1 Must-have for enterprise sale

1. **Multi-tenancy** — workspaces with isolated data
2. **SSO/SAML/OIDC** — at minimum OIDC (GitHub, Google, Microsoft)
3. **Role-based access** — Admin / Auditor / Viewer
4. **API tokens** — for CI and scripted usage
5. **Scheduled scans** — daily/weekly/monthly cron
6. **Webhooks out** — scan complete, issue threshold breached
7. **Jira / Linear integration** — issue-to-ticket with attribution
8. **CI integration** — GitHub Action, GitLab template that fails the build on regression
9. **Audit log** — who did what, when, for compliance
10. **Budget / cost controls** — per-workspace AI spend limits
11. **Historical baseline & trend** — "score over time" chart; "new vs fixed vs persistent" breakdown for crawls
12. **White-label PDF** — customer logo, colors, signature page
13. **Ignore / suppress rules** — mark a finding as accepted; it stops recurring
14. **Custom policies** — "we require all images to have alt text ≥ 5 characters" — user-authored rules

### 9.2 Strong differentiators (not must-haves but move the needle)

1. **Intelligent Guided Tests** (like Axe DevTools Pro) — step the user through criteria that automation cannot verify. Makes our a11y audits legally defensible.
2. **Crawl-aware issue aggregation** — "this missing-alt-text pattern appears on 340 of 500 pages; fix the template, not 340 tickets"
3. **AI-authored remediation PRs** — not just the code fix, but a pull request to the source repo via GitHub integration
4. **Field data integration** — pull CrUX (Chrome User Experience Report) data alongside lab results
5. **Mobile app auditing** — screenshot an app screen, submit to AI with same pipeline
6. **Visual regression baseline** — use Percy-style snapshot comparison for customer's own regression testing

### 9.3 Cut / defer

Features in current scope that should be re-evaluated or cut:

- `findDuplicateClusters` (simhash) — logic exists, no UI. Either surface as a Duplicates tab in crawl, or delete.
- 25+ device presets — 5-8 cover 95% of traffic per StatCounter. Trim the selector.
- Three browser engines (Chromium, Firefox, WebKit) — Lighthouse does not run on Firefox/WebKit; the UX silently degrades. Either make it a clear "expert mode" toggle or default-hide.
- Batch scan as a first-class UI concept — for enterprise, scheduled+crawl supersedes manual batch
- Settings page current implementation — replace with a real configuration UI once multi-tenancy exists

---

## 10. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-------------|
| CDP `captureBeyondViewport` fails on a class of sites (SPA with virtual scroll) | Medium | Medium | Maintain a tile-and-stitch fallback behind a flag; dogfood against a diverse test set |
| WCAG compliance mapping is contested by auditors (false positives marked as Pass) | Medium | High | Status = "Needs manual review" for anything not 100% deterministic; surface axe's "incomplete" results separately |
| AI provider pricing changes invalidate cost model | Low | Medium | Per-workspace budget caps; pluggable model selection; pre-flight cost estimate |
| Enterprise buyer requires on-prem deployment | High | Medium | Already use Docker Compose; formalize Helm chart; document air-gapped operation |
| Browser binary updates break Playwright integration | Medium | Low | Pin Playwright version; include browser binary in CI matrix |
| Concurrency fixes expose race conditions in DB writes | Medium | Medium | Add DB-level idempotency (unique constraints on `(scan_id, viewport_name)` in viewport_results); test scan retries |
| Screenshot pipeline rewrite regresses on sites that today work | Medium | High | Keep current implementation available behind feature flag; regression test against a curated site set |
| WCAG criterion mapping rots as WCAG 3.0 lands | Low | Low | Version the mapping; review quarterly |

---

## 11. Prioritized Roadmap

Total estimated runway to "enterprise-ready minimum viable product": **~10 weeks full-time single engineer**, or **~6 weeks with a second engineer on security and testing in parallel**.

### Sprint 0 — Emergency fixes (1 day)

Before anything else, unblock quick wins.

| Task | Files | Time |
|------|-------|------|
| Revoke OpenAI key in `.env:9`, rotate, set file mode to `0600` | `.env` | 5 min |
| Fix AI MIME type — detect from file extension | `src/lib/ai/claude.ts`, `openai.ts`, `provider.ts` | 30 min |
| Remove `lastLighthouseScores` module global; pass through function arguments | `src/lib/audit/engine.ts`, `src/lib/audit/scoring.ts` | 30 min |
| Delete dead code: `audit/rules/accessibility.ts`, `performance.ts`, `seo.ts`, unused `CrawlConfig` import in `crawl-queue.ts`, unused `runFormChecks` in `forms.ts` | Multiple | 15 min |
| Remove the negative-z-index filter in `detectContentHeight` | `src/lib/scanner/capture.ts:621-633` | 10 min |
| Add DB indexes on FK columns and `scans.created_at DESC` via new Drizzle migration | `drizzle/0007_indexes.sql` | 20 min |
| Unique-constraint on `(scan_id, viewport_name)` in viewport_results — protects against retry duplication | Same migration | 10 min |
| Fix `closeBrowser` double-call in `scan-worker.ts` | `src/lib/queue/scan-worker.ts` | 10 min |

### Sprint 1 — Pack A: Screenshot rewrite (3–5 days)

Detailed in §6.3. Acceptance criteria in §6.3.4.

Deliverables:
- New capture pipeline in `src/lib/scanner/capture.ts`
- Stabilization CSS
- Viewport-sized AI-ready screenshot alongside full-page WebP
- DB migration for new `viewport_screenshot_path` column
- Curated regression test suite (§6.3.5) with golden-image comparison

### Sprint 2 — Pack C: AI layer (2 days)

Detailed in §7.3. Acceptance criteria in §7.3.4.

Deliverables:
- Shared `zod` schema and parser
- Provider abstraction; both Claude and OpenAI use `tool_use` / `response_format`
- Model IDs from env vars
- `ai_usage` table and cost tracking
- Retry + timeout
- Batch remediation endpoint

### Sprint 3 — Pack B: Report IA (5–8 days)

Detailed in §8.9.

Deliverables:
- Category consolidation (13 → 6) via DB view
- Executive overview component
- Compliance tab with WCAG 2.2 matrix
- Refactored large components
- Polished UI palette

### Sprint 4 — Security and architecture foundation (1 week)

- Remove `--no-sandbox` from Chromium launch; Docker user-namespace sandbox
- URL validation + private-IP blocklist (SSRF defense)
- Rate limiting middleware (Redis-backed)
- API token auth (single tenant initially)
- Extract worker to separate process (`npm run worker:scan`, `npm run worker:crawl`)
- Redis pub/sub for SSE events
- Job timeout and idempotent retry
- Remove fixed Chromium debugging port; implement per-scan port assignment and parallelism

### Sprint 5 — Multi-tenancy and DB performance (1 week)

- `workspaces`, `users`, `workspace_members` tables
- `workspace_id` on all domain tables
- Row-level filtering in all queries
- Session-based auth (OIDC via NextAuth or Auth.js)
- Split large JSONB to separate tables / S3
- Data retention policy + nightly cleanup cron
- Stream CSV and PDF exports

### Sprint 6 — Observability and operations (1 week)

- `pino` structured logging, request IDs
- Prometheus metrics endpoint
- OpenTelemetry tracing
- Sentry error aggregation
- BullMQ dashboard
- Docker Compose healthchecks + restart policies
- Documented backup / restore runbook
- CI pipeline (GitHub Actions): lint, type-check, unit test, Playwright E2E

### Sprint 7 — Enterprise feature parity (2–3 weeks)

- Scheduled scans (cron-style)
- Webhooks out
- Jira integration (create issue from finding)
- GitHub Action template
- Email/Slack notifications
- Budget / cost caps
- Historical trend chart
- Ignore/suppress rules
- White-label PDF
- Public API documentation

### Sprint 8 — Quality and testing (continuous)

- Vitest unit tests (target: 80% coverage of `lib/`)
- Playwright E2E for core flows
- Visual regression tests using our own tool (dogfooding)
- Pre-commit hooks (husky + lint-staged)
- Dependabot / Renovate for security updates
- Regular self-audit with the tool we ship; publish the results

---

## 12. Success Criteria (Definition of Done for enterprise-ready MVP)

The product is enterprise-ready when the following are all true:

### Product

- [ ] A new user can sign up, create a workspace, run a scan, and share results with a teammate within 15 minutes of landing
- [ ] A scan of `americas.land` produces a screenshot where sticky header, background video, and reveal footer all render correctly
- [ ] A scan of the English Wikipedia main page completes in ≤ 90 seconds
- [ ] Score rationale is visible ("why is my site 72/100?") with a one-click drill-down to the contributing issues
- [ ] Compliance tab shows WCAG 2.2 AA status per criterion with EAA/ADA/Section 508/EN 301 549 mapping

### Engineering

- [ ] No secrets in `.env`; secrets come from environment or Vault
- [ ] All API endpoints require authentication
- [ ] Rate limiting is enforced on scan and crawl creation
- [ ] Workers run in dedicated processes; Next.js server can be restarted without losing in-flight scans
- [ ] Two concurrent scans produce independent correct results (proven by an integration test)
- [ ] Scan retry on worker failure does not duplicate viewport results (protected by unique constraint + idempotent worker)
- [ ] All queries have predictable latency (indexed)
- [ ] No `any`-cast in `src/lib/audit/` or `src/lib/ai/`
- [ ] 80%+ unit test coverage for `src/lib/`

### Observability

- [ ] Every API request has a correlatable log line (requestId)
- [ ] Scan duration, queue depth, and AI cost are exported as Prometheus metrics
- [ ] Sentry receives unhandled exceptions with scanId and userId tags

### Compliance

- [ ] Our own UI passes WCAG 2.2 AA when scanned by our tool (dogfooding)
- [ ] PDF reports are accessible (tagged PDF)
- [ ] Customer data can be exported and deleted on request (GDPR Article 17 support)
- [ ] Audit log records every user action; retained 1 year minimum

### Documentation

- [ ] `docs/scoring-methodology.md` — transparent formula
- [ ] `docs/api.md` — public REST reference
- [ ] `docs/integrations/ci-github.md` — GitHub Action usage
- [ ] `docs/integrations/jira.md` — how to connect Jira
- [ ] `docs/deployment-self-hosted.md` — Docker Compose & Helm

---

## 13. Appendix A — Code reference index

Quick lookup for where specific concerns live. Used by the roadmap tasks.

### Scanner / capture
- Browser launch: `src/lib/scanner/browser.ts`
- Viewport capture (screenshots, DOM snapshot, axe, headers, HTML/CSS): `src/lib/scanner/capture.ts`
- Device presets: `src/lib/scanner/devices.ts`
- Viewports legacy shim: `src/lib/scanner/viewports.ts`

### Audit engine
- Orchestrator: `src/lib/audit/engine.ts`
- Scoring: `src/lib/audit/scoring.ts`
- Runners (external tool wrappers):
  - axe: `src/lib/audit/runners/axe-runner.ts`
  - Lighthouse: `src/lib/audit/runners/lighthouse-runner.ts`
  - HTMLHint: `src/lib/audit/runners/html-runner.ts`
  - CSS analyzer: `src/lib/audit/runners/css-runner.ts`
  - Security headers: `src/lib/audit/runners/security-runner.ts`
- Custom cross-viewport rules:
  - Responsive: `src/lib/audit/rules/responsive.ts`
  - Visual consistency: `src/lib/audit/rules/visual.ts`
  - Typography: `src/lib/audit/rules/typography.ts`
  - Touch targets: `src/lib/audit/rules/touch-targets.ts`
- Dead / stub files (delete in Sprint 0):
  - `src/lib/audit/rules/accessibility.ts`
  - `src/lib/audit/rules/performance.ts`
  - `src/lib/audit/rules/seo.ts`
  - `src/lib/audit/rules/forms.ts` (unless `runFormChecks` is re-enabled)

### AI
- Provider dispatcher: `src/lib/ai/provider.ts`
- Claude client: `src/lib/ai/claude.ts`
- OpenAI client: `src/lib/ai/openai.ts`
- Prompts: `src/lib/ai/prompts.ts`
- Remediation endpoint: `src/app/api/remediate/route.ts`

### Queue
- Scan queue: `src/lib/queue/scan-queue.ts`
- Scan worker: `src/lib/queue/scan-worker.ts`
- Crawl queue: `src/lib/queue/crawl-queue.ts`
- Crawl worker: `src/lib/queue/crawl-worker.ts`
- SSE events: `src/lib/queue/scan-events.ts`
- Redis connection: `src/lib/queue/connection.ts`

### Crawler
- Orchestrator: `src/lib/crawler/crawler.ts`
- Page data extraction: `src/lib/crawler/extractor.ts`
- robots.txt: `src/lib/crawler/robots.ts`
- Sitemap parser: `src/lib/crawler/sitemap.ts`
- Simhash (duplicate detection): `src/lib/crawler/simhash.ts`
- Site tree: `src/lib/crawler/site-tree.ts`

### UI
- Report hub: `src/app/scan/[id]/page.tsx`
- Report tabs: `src/components/report/report-tabs.tsx`
- Overview: `src/components/report/report-overview.tsx`
- Lighthouse panel: `src/components/report/lighthouse-report.tsx` (needs split)
- Viewport split view: `src/components/report/viewport-tabs.tsx`
- Issues by category: `src/components/report/issues-by-category.tsx`, `category-detail.tsx`
- Issue card: `src/components/report/issue-card.tsx`
- Annotation overlay: `src/components/report/annotation-overlay.tsx`
- Element screenshot: `src/components/report/element-screenshot.tsx`
- Crawl tabs (needs split): `src/components/crawl/crawl-tabs.tsx`
- Shared constants: `src/lib/ui-constants.ts`

### DB
- Schema: `src/lib/db/schema.ts`
- Connection: `src/lib/db/index.ts`
- Migrations: `drizzle/`

---

## 14. Appendix B — Harmonization map (prior docs)

How this document relates to the four prior audit documents.

### From `docs/AUDIT_REPORT.md` (47 UI/UX findings)

| Prior finding | Status in this document |
|---------------|--------------------------|
| 1.1 Duplicated color/state logic across 11 files | Partially resolved via `src/lib/ui-constants.ts`; remaining work tracked in §8.7 |
| 1.2 Hardcoded SVG colors | Resolved in `ui-constants.ts` severity colors |
| 1.3-1.6 Spacing, radius, typography consistency | Tracked in §8.7 UI polish standards |
| 2.1 Missing skeleton loaders | Partially resolved (`loading.tsx` files added); in §8.7 |
| 2.2 Missing error recovery | Tracked in §9.1 (Retry UX) |
| 2.3 Missing toast notifications | Resolved; `sonner` now used |
| 2.4 Empty states lack CTAs | Partially resolved (`EmptyState` component) |
| 2.5 `crawl-tabs.tsx` too large | Unresolved, now 1,335 lines — tracked in §8.8 |
| 3.x Responsive / touch targets | Some resolved (icon sizes), rest in §8.7 |
| 4.x Accessibility a11y-labels | Partially resolved; ongoing |
| 5.x Modern design patterns | Mixed; transitions added, page transitions still missing |
| 6.x Information architecture | Major overhaul in §8 (new exec view, compliance tab) |

### From `docs/enterprise-upgrade-plan.md`

The v2 plan was substantially executed: axe-core, Lighthouse, HTMLHint, CSS analyzer, security runner, device presets, batch scan, SEO crawler, annotations, AI enhancements all shipped. This master document picks up from that foundation and addresses the gap to true enterprise-readiness.

### From `docs/research-v2-improvements.md`

- Split viewport view — shipped
- Dedicated Lighthouse tab — shipped
- SEO crawler tab structure — shipped
- AI prompt improvement (context injection) — partially (context exists but AI layer broken)
- Crawl comparison — shipped
- Multiple export formats — partial (CSV and PDF, not XLSX)
- Near-duplicate detection — logic shipped, no UI
- Full redirect chain tracking — shipped
- JS treemap visualization — not shipped
- Crawl visualization (site tree) — shipped
- AI auto-remediation — partial
- Scheduled crawls with alerts — not shipped, tracked in §11 Sprint 7

### From `docs/PROJECT_AUDIT_2026.md`

This master document incorporates all 15+ P0 findings from the fresh audit:
- Top 10 summary (§1.3) is preserved
- Security tracked in §5.1 (deferred per user direction)
- Database concerns tracked in §5.2
- Observability tracked in §5.3
- Testing tracked in §5.4
- Work packages A, B, C reorganized to match user's A → C → B priority

---

## 15. Appendix C — Sources

### Industry research (2025–2026)

- Chromatic — [Position sticky & fixed](https://www.chromatic.com/docs/position-sticky/) (sticky/fixed handling in visual testing)
- ScreenshotOne — [A complete guide on how to take full page screenshots with Puppeteer, Playwright or Selenium](https://screenshotone.com/blog/a-complete-guide-on-how-to-take-full-page-screenshots-with-puppeteer-playwright-or-selenium/)
- Urlbox — [Full page screenshots](https://urlbox.com/docs/screenshots/full-page-screenshots) (stitch vs native mode, `freeze_fixed`)
- Playwright docs — [Screenshots](https://playwright.dev/docs/screenshots) and [Page API](https://playwright.dev/docs/api/class-page) (screenshot options)
- Puppeteer — [page.screenshot v2.0.0 discussion](https://github.com/puppeteer/puppeteer/issues/5080) (captureBeyondViewport background)
- Playwright — [Full page screenshot issue #620](https://github.com/microsoft/playwright/issues/620) (known limitations)
- Programmable Browser — [Screenshot settings in Playwright](https://www.programmablebrowser.com/posts/screenshot-settings-playwright/)
- BrowserStack — [Percy SDK and screenshot capture workflow](https://www.browserstack.com/docs/percy/integrate/percy-sdk-workflow)
- Applitools — [Ultrafast Test Grid](https://applitools.com/platform/ultrafast-grid/) (DOM snapshot architecture)
- Google — [Lighthouse Understanding Results](https://github.com/GoogleChrome/lighthouse/blob/main/docs/understanding-results.md)
- Chrome for Developers — [Lighthouse moving to performance insight audits](https://developer.chrome.com/blog/moving-lighthouse-to-insights)
- Siteimprove — [Tracking Accessibility Regulations with the Compliance Pages](https://help.siteimprove.com/support/solutions/articles/80001176681-tracking-accessibility-regulations-with-the-compliance-pages)
- Siteimprove — [Accessibility Conformance Report](https://www.siteimprove.com/acr/)
- Sitebulb — [Prioritized Hints](https://sitebulb.com/features/prioritized-hints/) (300+ hints, 4 severity levels)
- Sitebulb — [Product](https://sitebulb.com/product/) (report categories)
- Deque — [Axe DevTools](https://www.deque.com/axe/devtools/) (enterprise a11y testing)
- SEMrush — [Site Audit Overview](https://www.semrush.com/kb/540-site-audit-overview) (errors/warnings/notices, Site Health %)
- Level Access — [WCAG 2.2 Checklist: Complete 2026 Compliance Guide](https://www.levelaccess.com/blog/wcag-2-2-aa-summary-and-checklist-for-website-owners/)
- WebAIM — [WCAG 2 Checklist](https://webaim.org/standards/wcag/checklist)

### AI vision documentation

- Anthropic — [Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision) (image limits, token calculation, best practices)
- Anthropic — [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- Price Per Token — [Claude Sonnet 4.5 Pricing](https://pricepertoken.com/pricing-page/model/anthropic-claude-sonnet-4.5) and [Claude Sonnet 4.6 Pricing](https://pricepertoken.com/pricing-page/model/anthropic-claude-sonnet-4.6)
- OpenAI — [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)
- OpenAI — [GPT-5.4 model docs](https://developers.openai.com/api/docs/models/gpt-5.4)
- OpenAI — [Introducing GPT-5.4](https://openai.com/index/introducing-gpt-5-4/)
- Finout — [Anthropic API Pricing in 2026](https://www.finout.io/blog/anthropic-api-pricing)

### Site analyzed (americas.land)

- HTML fetched directly (308 KB) on 2026-04-23
- CSS files fetched from `americasland.b-cdn.net` CDN:
  - `/wp-content/uploads/elementor/css/post-999.css` (header)
  - `/wp-content/uploads/elementor/css/post-1162.css` (footer — contains reveal CSS)
  - `/wp-content/uploads/elementor/css/post-101.css` (home)
  - `/wp-content/uploads/elementor/css/custom-frontend.min.css`
  - `/wp-content/plugins/elementor-pro/assets/css/modules/sticky.min.css`

---

**End of master audit document.** Subsequent revisions should update the version number in the header, add a revision-history section below this line, and preserve the section numbering for external references.
