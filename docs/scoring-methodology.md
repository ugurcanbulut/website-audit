# Scoring Methodology

**Status**: Published — the formula below is the authoritative scoring model. Any change requires a pull request that updates this document alongside the code.

## What we score

Each completed scan yields a single **Site Health Score** from 0 to 100, and a corresponding letter **Grade** (A–F). The Site Health Score is a weighted average of per-category scores.

## Categories

The scoring model operates on six **presentation categories**, which aggregate the thirteen internal categories stored in the `audit_issues.category` column:

| Presentation category | Internal categories aggregated | Data sources |
|-----------------------|-------------------------------|--------------|
| Performance | `performance` | Google Lighthouse |
| Accessibility | `accessibility` | axe-core (`@axe-core/playwright`), optional Lighthouse accessibility category |
| SEO | `seo` | Google Lighthouse |
| Best Practices | `best-practices`, `html-quality`, `css-quality` | Lighthouse best-practices + HTMLHint + `@projectwallace/css-analyzer` |
| Security | `security` | HTTP response-header analyzer |
| UX Quality | `responsive`, `typography`, `touch-targets`, `visual`, `forms` | Custom cross-viewport and per-viewport rules |

The `ai-analysis` category is **informational only**; it is surfaced in the report but does not contribute to the Site Health Score, because its severity calibration varies between models and runs.

## Per-category score

For categories whose data comes from Lighthouse (Performance, SEO, Best Practices, and Accessibility when the Lighthouse accessibility run is available), the category score is the Lighthouse category score rounded to the nearest integer (0–100).

For categories whose data comes from deduction-based rules (Security, UX Quality, and Accessibility when only axe-core data is available), the category score is:

```
category_score = clamp(100 - Σ severity_weight × count, 0, 100)
```

where `severity_weight` is:

| Severity | Weight |
|----------|--------|
| Critical | 15 |
| High     | 8  |
| Medium   | 3  |
| Low      | 1  |
| Pass     | 0  |

The severity of each issue is computed from the tool that produced it:

- **axe-core** — `critical`/`serious` → Critical; `moderate` → High; `minor` → Low
- **Lighthouse** — audit score `0` → Critical; `< 0.5` → High; `0.5 ≤ x < 0.9` → Medium; `0.9 ≤ x < 1` → Low; `= 1` → Pass
- **Custom rules** — each rule declares one of Critical, Warning (mapped to High or Medium based on secondary signals), or Info (mapped to Low)

## Overall Site Health Score

```
overall_score = Σ (category_score × category_weight) / Σ category_weight
```

Category weights are:

| Category        | Weight |
|-----------------|--------|
| Accessibility   | 25     |
| Performance     | 20     |
| SEO             | 15     |
| Best Practices  | 15     |
| Security        | 15     |
| UX Quality      | 10     |
| **Total**       | **100** |

The numerator is rounded to the nearest integer. Categories with no data are excluded from both numerator and denominator, so a scan that runs on a non-Chromium engine (and thus has no Lighthouse data) still produces a valid overall score from the remaining categories.

## Grade

| Score  | Grade |
|--------|-------|
| ≥ 90   | A     |
| 80–89  | B     |
| 70–79  | C     |
| 60–69  | D     |
| < 60   | F     |

## Why these numbers

The weights reflect the priorities most enterprise buyers express in procurement conversations: accessibility and performance dominate because they carry regulatory and revenue-impact risk; SEO, best practices, and security are equal mid-tier concerns; UX quality is the smallest weight because it overlaps heavily with accessibility and because its severity calibration is the least standardized industry-wide.

The severity weights compress into a manageable 1-to-15 range so a single Critical issue moves a category score by more than five Low issues — reflecting engineering reality that Critical issues block users while Low issues are hygiene.

## What this does not score

- **Visual aesthetics beyond heuristic checks** — typography scale consistency and color palette breadth are captured as Low-severity UX issues; subjective taste is not.
- **Real-world field performance** — the current implementation runs Lighthouse in lab mode. CrUX / real-user field data would be a separate future score.
- **Content quality** — we do not grade copywriting.
- **Business outcomes** — conversion rate, revenue per visitor, and similar metrics are outside the scope of an automated audit.

## Changing this model

Any change to category weights, severity weights, or category mappings requires:

1. A pull request updating this document and `src/lib/audit/scoring.ts` + `src/lib/audit/severity.ts` in the same commit.
2. A migration test against the last ten scans in the development database that demonstrates the direction of the change (scores go up, down, or stay per the intent).
3. A one-line note in `CHANGELOG.md` if the change could affect customer-facing historical trends.
