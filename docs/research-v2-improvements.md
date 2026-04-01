# V2 Improvement Research Findings

## Key Takeaways for Implementation

---

## 1. Issues/Findings UX (Enterprise Pattern)

**The universal pattern across Lighthouse, Siteimprove, axe DevTools, SEMrush, Screaming Frog:**

### Three-Tier Severity
- **Errors** (red) -- must fix, blocks user/SEO
- **Warnings** (orange) -- should fix, impacts quality
- **Notices** (blue) -- informational, optimization opportunity

### Issue Layout (Lighthouse Pattern)
```
[Category Gauge] Performance: 82/100
├── Opportunities (with savings estimates)
│   ├── Eliminate render-blocking resources (-1.2s)
│   │   └── [Expand] → table of CSS/JS files with sizes + savings
│   ├── Serve images in next-gen formats (-340KB)
│   │   └── [Expand] → table of images with current/optimal sizes
│   └── Reduce unused JavaScript (-180KB)
│       └── [Expand] → treemap of JS bundles with unused bytes
├── Diagnostics
│   ├── DOM size: 1,847 elements (warning)
│   ├── Largest Contentful Paint element
│   │   └── [Expand] → element screenshot + code snippet
│   └── Critical request chain (3 chains found)
│       └── [Expand] → tree visualization of request dependencies
└── Passed Audits (42) [Collapsed]
```

### Detail View Per Issue
1. Severity icon + title
2. "Why it matters" explanation
3. Affected elements (code snippet + selector)
4. Element screenshot (cropped, highlighted)
5. Fix recommendation (concrete code diff when possible)
6. WCAG reference (for accessibility)
7. "Learn more" link

---

## 2. Lighthouse Tab (Dedicated)

### What to show:
- **Circular gauges** for Performance, Accessibility, Best Practices, SEO (already have this)
- **Performance metrics strip**: LCP, TBT, CLS, FCP, SI with values + color
- **Opportunities section**: Each with title + estimated savings bar
  - Expand shows table of specific files (URL, size, potential savings)
- **Diagnostics section**: Flagged items with element screenshots
- **Render-blocking resources**: List of CSS/JS files blocking first paint
- **Image optimization**: Table of images with current vs optimal format/size
- **JS treemap**: Visual breakdown of JavaScript bundle sizes + unused bytes
- **Two runs**: Desktop + Mobile, shown in tabs

### Data we already have in `lighthouseJson`:
- `lhr.audits` -- every individual audit with details
- `lhr.audits['render-blocking-resources'].details.items` -- specific files
- `lhr.audits['uses-optimized-images'].details.items` -- image opportunities
- `lhr.audits['unused-javascript'].details.items` -- JS waste
- `lhr.categories` -- scores

---

## 3. AI Analysis Improvements

### Current problem: Generic observations, not actionable

### How to fix (from research):

1. **Context injection**: Instead of just sending screenshots, also send:
   - The axe-core violation data for the page
   - The DOM structure of problematic elements
   - The CSS properties causing issues
   - The Lighthouse audit failures

2. **Specific code fixes**: Prompt AI to generate before/after code diffs:
   ```
   BEFORE: <img src="hero.jpg">
   AFTER:  <img src="hero.jpg" alt="Mountain landscape at sunset">
   ```

3. **Impact-based prioritization**: Ask AI to rank findings by user impact

4. **Validation loop**: After AI generates fix, conceptually verify against WCAG

5. **Hybrid approach**: Use AI for:
   - Contextual alt text generation (multimodal)
   - Color contrast alternatives
   - Navigation pattern assessment
   - Content readability analysis
   - UX flow critique
   NOT for: accessibility rule checking (axe-core does this better)

---

## 4. By Viewport Split Layout

### Recommended pattern (from axe DevTools + Figma):

```
┌─────────────────────────────────────────────────────┐
│ Viewport: iPhone 15 Pro (393x659)    [Toggle Annotations] │
├────────────────────────┬────────────────────────────┤
│                        │ Issues (12)                 │
│  [Annotated           │ ┌─ [1] ● Missing alt text  │
│   Screenshot]          │ │   <img src="hero.jpg">   │
│                        │ │   Severity: Critical      │
│  [Numbered markers    │ └─────────────────────────  │
│   on screenshot]       │ ┌─ [2] ● Low contrast      │
│                        │ │   <p class="subtitle">    │
│  Click marker →        │ │   Ratio: 2.8:1 (need 4.5)│
│  highlights issue      │ └─────────────────────────  │
│                        │ ┌─ [3] ○ Missing label      │
│  Hover issue →         │ │   <input type="email">    │
│  highlights marker     │ │   Severity: Warning        │
│                        │ └─────────────────────────  │
└────────────────────────┴────────────────────────────┘
```

### Bidirectional linking:
- Click annotation marker → scroll issue list to that item + highlight
- Click/hover issue → highlight annotation on screenshot + scroll to it

---

## 5. SEO Crawler (Screaming Frog Level)

### Missing data points to add:
- HTTP protocol version (h2 vs http/1.1)
- Full redirect chains (every hop)
- Crawl depth from seed URL
- Inlinks/outlinks count per page
- Near-duplicate content detection
- Orphan pages (in sitemap but not linked)
- Indexability status + reason
- Text-to-HTML ratio
- Link position (nav/content/footer)
- Mixed content detection
- Content encoding (gzip/brotli)

### Tab structure (Screaming Frog pattern):
- **All Pages** -- main data table
- **Response Codes** -- grouped by 2xx/3xx/4xx/5xx
- **Page Titles** -- missing/duplicate/too long/too short
- **Meta Descriptions** -- same pattern
- **Headings** -- H1/H2 issues
- **Images** -- missing alt, oversized
- **Links** -- broken, redirected, nofollow
- **Canonicals** -- issues
- **Structured Data** -- types + validation

### Export per tab (Screaming Frog pattern):
- CSV export per tab (not just one global CSV)
- Bulk export option for all data
- PDF summary report

### Historical crawls:
- Store all crawls (already do)
- Crawl comparison: show new/fixed/persisting issues
- Trend chart: health score over time
- Delta badges: "+5 new errors", "-12 fixed"

---

## 6. Priority Implementation Order

### Immediate (high impact, moderate effort):
1. Split viewport view (50/50 annotated screenshot + issues)
2. Dedicated Lighthouse tab with detailed data
3. SEO crawler tab structure + additional data points
4. AI prompt improvement (context injection + code diffs)

### Next (medium impact, higher effort):
5. Crawl comparison/history UI
6. Multiple export formats per entity
7. Near-duplicate content detection
8. Full redirect chain tracking

### Future:
9. JS treemap visualization
10. Crawl visualization (site tree)
11. AI auto-remediation (code fix generation)
12. Scheduled crawls with alerts
