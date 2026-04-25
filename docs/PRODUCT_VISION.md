# Product Vision — UI Audit (Working Doc)

> Living document. Captures the brainstorm-in-progress and decisions taken so far. **Last updated:** 2026-04-25.

---

## Resume point

Brainstorm ordering: **Vision → Name → Features → Monetization → Marketing**.

We started with vision and made the monetization call early because it constrains everything else (customer + price + license).

**Currently paused on: Scale ceiling decision (#4).** User has not yet picked between lifestyle / bootstrap-to-scale / VC-backed / hybrid. After that: 5-year horizon (#5), then product name, then feature roadmap, then marketing.

---

## Decisions taken

### Customer (#1) — confirmed
- **Primary:** A (solo dev / freelancer), B (web agency), C (in-house dev team at scaleup)
- **Secondary later:** D (compliance / legal at enterprise) via separate enterprise tier

### Distribution + license — closed-source SaaS

| Considered | Verdict | Reason |
|---|---|---|
| Open source (AGPL / BSL / MIT) | ❌ Rejected | Donations ≈ $0/mo for mortals (Plausible/Cal.com/Posthog all confirm). Community contributions take years. OSS is real work as marketing channel, not a shortcut. |
| Free tier | ❌ Rejected | Audit scans cost real money: $0.05–0.20/scan (Playwright + Chrome + Lighthouse + AI). Free tier = $200–500/mo bleed with $0 revenue. |
| Closed source SaaS, paid-only | ✅ Adopted | No license gymnastics, no AWS-clone risk, COGS-positive from day 1. |

**Optional later:** small marketing-only OSS library (`@uiaudit/checks`) — TypeScript wrapper around axe + Lighthouse + custom rules under MIT. Marketing amaçlı, ürünün kendisi değil. **Decision pending.**

### Monetization — paid-only with money-back

| Tier | Price | Limits | ICP |
|---|---|---|---|
| **Starter** | $19/mo | 1 site, 50 scans/mo, no AI | A (solo dev / freelancer) |
| **Pro** | $49/mo | 5 sites, 500 scans/mo, AI + scheduled + Slack/Jira | B (small agency) |
| **Agency** | $149/mo | unlimited sites, white-label PDF, 5 seats, API | B (large agency) + early C |
| **Enterprise** | $5–20k/yr | SSO, audit trail, compliance, dedicated support | D (later) |

- **30-day money-back, no questions asked** — industry standard for B/C SaaS; real refund rate 2–5%
- **Why not $5:** COGS on a 50-scan batch = $5–10. $5 plan is COGS-negative.
- **Why not $9 like Plausible:** Plausible is analytics (cheap to compute). We are scan-heavy (Playwright + AI). Different cost structure.

**Comparable tools (price reference):**

| Tool | Entry price | Type |
|---|---|---|
| Lighthouse | free | OSS / built into Chrome |
| GTmetrix Pro | $14.95/mo | limited scans |
| Sitebulb | $13.50/mo per user | desktop |
| Screaming Frog | $259/yr ($22/mo) | desktop, SEO crawler |
| DebugBear | $46/mo | entry |
| axe DevTools | $399/yr/seat | a11y only |
| Siteimprove | $20k+/yr | enterprise |

### Top-of-funnel — public 1-shot demo scan

No account required. URL → 60-sec scan → score + 5-issue preview → "see all 312 issues + AI fix code → sign up $19/mo". Pattern from GTmetrix / PageSpeed Insights / securityheaders.com.

**Why:** $19 paywall is real friction; users won't commit blind. Demo scan = ~$50–100/mo infra burn but generates SEO + viral sharing + trust. Reports auto-deleted 1h, no storage cost, no account.

---

## Vision sentence (draft)

> **"Modern dev ekipleri ve dijital ajanslar için AI-native unified web audit platformu — axe + Lighthouse + crawler + screenshot + AI prioritization + remediation tek panelde."**

## Wedge / positioning

**Position:** *"Middle market SaaS — solo dev'in karşılayabildiği fiyat, agency + scaleup'ın istediği güç, enterprise tool'ların eksik bıraktığı modern dev experience."*

| Axis | Us | axe DevTools | Lighthouse | Screaming Frog | Siteimprove |
|---|---|---|---|---|---|
| **AIO** (5 areas in 1 tool) | ✅ | a11y only | perf + a few | SEO crawler only | a11y + SEO, dated |
| **AI-native** (prioritization + fix) | ✅ | ❌ | ❌ | ❌ | adding, weak |
| **Modern UX** (Linear-grade) | ✅ | OK | OK | desktop, dated | enterprise hantal |
| **Developer-friendly** (API / CI / webhook) | ✅ | limited | CLI | CSV export | limited |
| **Price band** | $19–149 | $399/yr/seat | free | $259/yr | $20k+/yr |

---

## Open questions (in order)

### #4 — Scale ceiling — **RESUME HERE**

This decision shapes feature roadmap, hiring plan, marketing channels, even product naming tone (warm vs sharp).

| Mode | ARR target | Team | Style | Exit |
|---|---|---|---|---|
| **A. Lifestyle / indie** | $200–500k/yr | solo + 0–1 freelance | slow, sustainable, full control | none / small acquisition |
| **B. Bootstrap-to-scale** | $1–5M/yr | 5–15 people | profitable growth, no VC | strategic $10–30M |
| **C. VC-backed scale** | $20–100M/yr | 50–200 people | aggressive, churn pressure | exit or IPO |
| **D. Hybrid** | start A, decide B at $30–50k MRR | — | option open | — |

**Profile fit:** User is solo founder, enterprise-quality output, technical, has shipped 5 sprints solo. Mode **D (hybrid)** is the natural fit. C (VC-backed) is a separate-life decision.

### #5 — 5-year horizon (pending after #4)

If it works, what does it become?

Candidates to consider when we resume:
- *"Vercel for audits"* — scaleup default audit aracı
- CI/CD'ye default step (GitHub Action)
- Audit-as-a-Service marketplace plugins (Webflow, Shopify, WordPress)
- Compliance / legal vertical (D segment)
- Acquired by a hosting/devtool platform

### Product name — comes after vision is locked
### Feature roadmap — comes after vision
### Marketing channels (no/low-budget) — comes last

---

## Discussion log

### 2026-04-25 — Session 1
- Brainstorm started after Sprint 6 quick-wins paused for user travel
- Customer (#1) confirmed: A / B / C primary, D later
- **Open source rejected** after honest assessment:
  - Donation model unrealistic ($0/mo for mortals)
  - Community contributions = years before meaningful PRs
  - OSS work load = 5–10 hr/week real time, not "free marketing"
  - Hosted-paid conversion from self-host: 1–5%
- **Free tier rejected** — audit COGS too high
- **Pricing tiers drafted:** $19 / $49 / $149 / enterprise
- **30-day money-back** instead of 14-day (better signal, similar real cost)
- **Public 1-shot demo scan** as top-of-funnel substitute for free tier
- **Optional marketing OSS lib** (`@uiaudit/checks`) as parking-lot idea
- **Vision sentence drafted** — AI-native unified web audit for dev teams + agencies
- **Wedge defined** — AIO + AI-native + modern UX + developer-friendly, middle-market price band
- **Paused on scale ceiling decision (#4)**
