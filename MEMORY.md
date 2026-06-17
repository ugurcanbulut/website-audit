# Project Memory — UI Audit

> Persistent context for Claude Code, synced via git so any machine (laptop, desktop) gets the same picture. Loaded automatically through `CLAUDE.md`.

**Last updated:** 2026-06-17
**Repo:** github.com/ugurcanbulut/website-audit
**Branch:** main

---

## 1. Current state — where we left off

### 🎨 REALSTACK REDESIGN (2026-06-10) — Direction D implemented, committed & pushed
- Source: Claude Design handoff bundle (user iterated A/B/C/D prototypes; picked **D — Compact Bold**: B's top nav + orange hero, A's tables/summary, Urbanist 800 headings, brand `#fc492a`, **no dark mode**).
- **Implemented app-wide:** tokens rewritten in `globals.css` (light-only, bg `#f7f6f9`, ink `#1b1a1f`, primary `#fc492a`, extras `--brand-soft/--ink-2/--faint/--surface-2`; `.dark` block deleted, `dark:` classes inert); headings globally Urbanist 800 tight; **sidebar replaced by top nav** (`layout/top-nav.tsx` — logo, Dashboard, Website Audit + SEO Crawl dropdowns, New Scan btn, settings; `app-sidebar.tsx`/`theme-toggle.tsx`/`header.tsx` deleted, next-themes provider removed); REALSTACK `Logo`/`LogoMark` in `layout/logo.tsx`; `SiteHeader` is now a breadcrumb strip; metadata title "REALSTACK Audit".
- **Dashboard rebuilt** (`page.tsx` + `dashboard/hero|section-cards|recent-scans|latest-report|grade-chip`): orange hero with URL input (prefills `/scan/new?url=` — `ScanForm` takes `initialUrl`) + live-scan card (honest indeterminate bar, no fake %), 4 stat cards (added this-week + per-scan severity-count queries), recent-scans grid rows (grade chip + score bar + sev pills), latest-report card (score ring + category bars, worst-first).
- **Inner pages restyled** (3 parallel agents): scan form → numbered cards + segmented engine/provider + device chips + sticky run summary; report header (ring + grade chip + mono subline) + underline tabs (`issuesCount` chip) + scan-progress (icon tile, big %, viewport checklist, newest-first activity log — fixes punch-list #8); history/batch/settings/crawl pages → `layout/page-head.tsx` PageHead + breadcrumbs + grid-row tables. Punch-list **#7 done** (GPT-4o→GPT-5 labels), **#5 moot** (light-only).
- New helpers: `lib/relative-time.ts`, `getGradeFromScore`/`getScoreHexColor` in `ui-constants.ts`.
- **Deliberately omitted** (would be dead controls — no backing functionality): top-nav ⌘K search, bell, avatar; dashboard "Filter" button. Add when real features exist.
- Verified: `tsc` clean, `npm run build` clean, all routes 200, Playwright screenshots of dashboard/scan-new/history/settings/crawl-new/report checked visually.
- Design bundle (prototypes + chat) extracted at `~/.claude/projects/-home-ugurcan-Projects-website-audit/0dab3c16-9e5f-4a4e-8790-80c8132985e1/tool-results/design-bundle/` (session-local; re-fetch from the design link if needed).

### 🔑 PRODUCT PIVOT (2026-06-09 brainstorm) — INTERNAL AGENCY TOOL, not a SaaS
- Confirmed by user: the tool runs **inside the agency the user works at**, to audit **client websites at delivery / QA time** — catch issues before the client does + produce a report. NOT a commercial SaaS, no revenue model.
- PARKED (parked, not trashed): all SaaS thinking in [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) — pricing tiers, scale-ceiling A/B/C/D, public demo funnel, OSS-vs-closed, SaaS positioning. **That doc still shows the old SaaS framing and needs a rewrite to the internal-tool thesis (parked task).**
- New compass: **"make our team's audit-at-delivery faster + nothing slips."** Report serves TWO audiences: internal (raw/full — every element + fix) AND client-facing (clean + branded → white-label PDF matters).
- Pain it replaces (user's words): axe/a11y was **never** run; Lighthouse + Screaming Frog run **manually**; UI checked **by eyeball, page-by-page, sometimes BrowserStack across devices** → things slipped. ⇒ #1 leverage = multi-viewport/cross-device visual capture + objective UI-defect surface; a11y (axe/WCAG) is a 0→1 gap + compliance story.
- Re-prioritized roadmap: **Tier1** report quality + two-mode/white-label PDF + whole-site crawl + per-client workspace · **Tier1.5** ignore/suppress (also the internal→client filter) · **Tier2** before/after baseline · **Tier3** pino logging, Slack/email, Jira export. **Dropped (SaaS-only):** monetization, demo funnel, SSO, public API, budget caps, money-back, Prometheus/OTel, scheduled scans.

### ✅ Demo to management (2026-06-09/10) — DONE, went well
- Live end-to-end demo (URL → scan → report) to decision-makers, on a **fresh-clone machine** (had no node_modules / .env / Playwright browsers).
- Live scan on `americas.land` verified end-to-end (~60s, 1341 findings, 46/F) — **Playwright + Lighthouse confirmed working on the host (Arch)**.
- Ran as a **production build** for the demo (`npm run build && npm run start` on :3000; the `output: standalone` warning is non-fatal — `next start` renders fine).

### 🚢 Shipped this session — 3 demo fixes (committed)
1. **Radar chart** (`report-overview.tsx`) — `hsl(var(--x))` → `var(--x)`; tokens are `oklch()`, so `hsl(oklch())` was invalid CSS → chart was invisible. Now renders (Issues tab).
2. **`[object Object]` error** (`scan-form.tsx`) — 400s return an error OBJECT (Zod fieldErrors / UrlGuard); now flattened to a real message.
3. **SSE heartbeat + cancel** (`api/scans/[id]/events/route.ts`) — 15s `: ping` keeps the stream warm through the audit stall (kills "Connection lost"); `cancel()` releases the redis subscription (leak fix); `X-Accel-Buffering: no`.

### Demo punch-list — DONE (`29c683f`, 2026-06-17), verified live on americas.land
- **#9 DONE** — 4th Lighthouse gauge (Accessibility) now renders (was 3/4). Root cause was deeper than the note: Lighthouse was never *run* for accessibility — `engine.ts` passed `categories: ["performance","best-practices","seo"]` for both desktop+mobile, so `cats.accessibility` was always null. Fix: add `"accessibility"` to both runs **and** read `cats.accessibility` in `scan/[id]/page.tsx` (both dual + legacy blocks). Lighthouse a11y *issues* are dropped in the engine loop (`if (issue.category === "accessibility") continue;`) — axe-core stays the authoritative a11y source (category `"accessibility"`), no double-count. Verified: gauge=84, axe a11y issues=800 intact, 0 `lighthouse-*` rows in the accessibility category.
- **#6 DONE** — progress-creep. `use-scan-progress.ts` now trickles a `displayProgress` toward a soft ceiling (`min(progress+18, 92)`, ease 0.06, 600ms) and returns `Math.max(progress, displayProgress)` — real events always snap it up, never fakes 100. The 35→65 audit stall measured **~80s** on americas.land (was a frozen bar). Worker label (`scan-worker.ts:136`) now reads "Running audit engine (axe-core, Lighthouse, HTML/CSS)…".
- **#7 DONE** — "GPT-4o"→"GPT-5" in `scan-form.tsx` (the 2 spots; batch form + settings already said GPT-5).
- **#8** — already shipped in the redesign: `scan-progress.tsx` has newest-first activity log (`.slice().reverse()`) + "Waiting for events…" empty state. No change needed.
- **#5** moot — light-only theme since the redesign (no dark-mode score badge).
- **Not a bug:** Summary "Accessibility 0 / UX Quality 0" are **real rule-based scores** crushed by 707 axe contrast items (mostly axe "[Needs Review]" incompletes) + touch-target issues. Whether "needs-review" should floor a category = post-demo scoring-methodology question.

### Last shipped commits (origin/main)
- `29c683f` *(2026-06-17)* fix: demo punch-list — Lighthouse a11y gauge (#9), progress creep (#6), GPT-5 label (#7). Verified live on americas.land (gauge=84, ~80s audit stall now trickles, no a11y double-count). See punch-list section above for detail.
- `86b64aa` *(2026-06-16)* fix: viewport tabs crash — sanitize PhotoSwipe gallery id. **Root cause:** viewport names carry a `"` (e.g. `MacBook Pro 14"`); `viewport-tabs.tsx` built the gallery id with only `\s+`→`-`, so the `"` leaked into PhotoSwipe's `querySelectorAll("#"+id)` → invalid CSS selector → `SyntaxError` in lightbox `init()` → crashed the tab subtree ("This page couldn't load"). **Fix:** `toSafeId()` in `screenshot-gallery.tsx` slugifies the id (strip non-`[A-Za-z0-9_-]`, force non-digit start) for both the DOM `id` and the selector — protects all 3 call sites. Verified in prod build via Playwright (all device tabs switch, zero console errors).
- `29b8077` *(2026-06-10)* feat: REALSTACK redesign (Direction D) — top nav, orange brand, light-only theme
- *(2026-06-10)* `7ae1e84` fix: demo polish — radar `oklch`→`var`, scan-form `[object Object]`, SSE heartbeat+cancel
- `81f4a13` docs: capture product vision brainstorm session 1
- `158951d` fix: docker healthcheck — node http probe (wget/curl missing in node:22-slim)
- `c59c79f` fix: crawler — empty `Disallow:` is allow-all per RFC 9309 §2.2.2
- `5986508` fix: report IA — Summary tab, Compliance context, viewport SVG, design pass
- `1308846` fix: screenshot engine — hide reveal-footer, narrow sticky tagging, crop to content
- `e50cbbf` feat: **Sprint 5** — multi-tenancy foundation, blob relocation, retention
- `749fdc7` feat: **Sprint 4** — security foundation + worker process extraction
- `5ebf219` fix: Pack A hotfix — computed-style sticky tagging, local fonts, .dockerignore
- `afead58` feat: **Pack B** — report IA overhaul (executive view, WCAG 2.2, category consolidation)
- `106dfdf` feat: **Pack C** — AI layer rewrite (structured output, retries, cost tracking)
- `5105489` feat: **Pack A** — CDP native full-page capture screenshot engine

### Sprint 6 quick-wins (observability) — STILL NOT STARTED (deferred again; demo took priority)
Deps installed (`2eb7661`: pino, pino-pretty, @sentry/nextjs, @sentry/node, @bull-board/api+express, express). Resume order:
1. `src/lib/observability/logger.ts` (base pino + scope helper) → replace `console.*` in worker/queue/audit/scanner/ai/crawler.
2. Rename `src/middleware.ts` → `src/proxy.ts` (`middleware()`→`proxy()`, add `x-request-id` via crypto.randomUUID).
3. Sentry: `src/instrumentation.ts` (`register()` + `onRequestError()`), `@sentry/node` in worker with `Sentry.withScope()` for scanId/workspaceId; no-op when `SENTRY_DSN` unset.
4. bull-board: mini Express on :3002 in worker, scan/crawl/retention adapters, `API_TOKEN` bearer (timing-safe); add port to docker-compose.yml.

---

## 2. Project goal & deploy

**Goal:** **Internal agency tool** — audit client websites at delivery/QA (UI / UX / SEO / Security / Accessibility) so the team catches issues before the client does, and produce both an internal (raw) and a client-facing (branded) report. Enterprise-grade quality bar still applies (client-facing ⇒ no generic output, comparable to axe DevTools / Lighthouse / Screaming Frog / Siteimprove / Percy). **NOT a commercial SaaS** — see §1 pivot; old SaaS framing lives, parked, in `docs/PRODUCT_VISION.md` (pending rewrite).

**Deploy:** Docker Compose — `app:3001`, `postgres:5433`, `redis:6381`. Worker is a separate container since Sprint 4.

**Authoritative documents:**
- `docs/MASTER_AUDIT_2026.md` — engineering assessment + 7-sprint roadmap (canonical)
- `docs/scoring-methodology.md` — scoring formula
- `docs/PROJECT_AUDIT_2026.md` — Turkish full-project audit (companion)

---

## 3. Stack

**Runtime:** Next.js 16 (App Router) + Tailwind 4 + shadcn/ui v4 + @base-ui/react + React 19.

**Storage / queues:** PostgreSQL 16 + Drizzle ORM (postgres.js driver) + BullMQ + ioredis.

**Scanning / analysis:** Playwright + axe-core + Lighthouse 13 + HTMLHint + @projectwallace/css-analyzer + Sharp.

**AI:** Anthropic SDK + OpenAI SDK with structured output (zod schema in `src/lib/ai/schema.ts`). Hybrid toggle — rule-based always on, AI optional, both Claude and OpenAI selectable.

**UI extras:** PhotoSwipe, jsPDF, Sonner, next-themes. Urbanist font (local).

**Observability (Sprint 6 in progress):** pino, pino-pretty, @sentry/nextjs, @sentry/node, @bull-board/api + @bull-board/express + express.

### Stack conventions
- **No `asChild`** in @base-ui — use the `render` prop on primitives. Use `buttonVariants` from `@/lib/button-variants` for links in server components.
- **Heavy Node-only packages** — dynamic import with `/* webpackIgnore: true */` (playwright, sharp, lighthouse, htmlhint, css-analyzer).
- **Worker bundle** — esbuild with `--external` flags for the heavy packages.
- **Next.js 16 specifics** — middleware renamed to **proxy** (file: `proxy.ts`, fn: `proxy()`). Use `instrumentation.ts` with `register()` + `onRequestError()` for observability hooks. Read docs in `node_modules/next/dist/docs/` before writing — APIs differ from training data.
- **Dockerfile** — `node:22-slim` base, ships **neither wget nor curl**. Use `node -e "..."` for healthchecks.
- **Playwright in Docker** — `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`.
- **Centralized UI tokens** — `src/lib/ui-constants.ts`.

---

## 4. Sprint plan

### Done
| Sprint | Description | Commit |
|---|---|---|
| Sprint 0 | Emergency fixes (MIME, indexes, idempotency, dead code) | `036bf2f` |
| Pack A | Screenshot engine rewrite (CDP native full-page) | `5105489` |
| Pack C | AI layer rewrite (structured output, retries, cost) | `106dfdf` |
| Pack B | Report IA overhaul (executive view, WCAG 2.2, categories) | `afead58` |
| Sprint 4 | Security foundation + worker process extraction | `749fdc7` |
| Sprint 5 | Multi-tenancy foundation, blob relocation, retention | `e50cbbf` |

### In progress
- **Sprint 6 (3 quick wins)** — pino + request ID, Sentry, bull-board (see §1 above).

### Remaining (per `docs/MASTER_AUDIT_2026.md` §11)
- **Sprint 6 (rest)** — Prometheus metrics, OpenTelemetry, full Docker healthchecks, backup runbook.
- **Sprint 7 (parallel)** — enterprise feature parity: scheduled scans, webhooks, Jira integration, GitHub Action template, email/Slack, budget caps, historical trend chart, ignore/suppress rules, white-label PDF, public API docs.
- **Sprint 7+ (Testing)** — Vitest unit tests for `lib/`, Playwright E2E for scan/batch/crawl, CI pipeline, pre-commit hooks, self-dogfooding. **User said: "yazariz, oncelik degil, listede kalsin."**

### Open user-owned task
- Revoke OpenAI API key visible in `.env:9`. Generate new one. `chmod 600 .env`. (Code-side MIME fix already shipped — works as soon as key is rotated.)

---

## 5. User preferences

- **Hybrid AI** — rule-based checks always on, AI analysis optional, both Claude and OpenAI as selectable providers in the scan form.
- **Communication** — Reply in **English** (user switched from Turkish on 2026-06-10; English from now on, even if the user occasionally writes Turkish).
- **Email** — ugurcanbulut@gmail.com.

---

## 6. Feedback rules — must follow

### No co-author in commits
**Rule:** Never include `Co-Authored-By` or any AI attribution in git commit messages.
**Why:** User's explicit preference, also enforced in `CLAUDE.md`.
**How:** Plain commit message, nothing trailing.

### Quality bar — enterprise grade only, no bullshit
**Rule:** Zero tolerance for generic/useless output.
**Why:** This is a production tool, not a prototype. User compares output against axe DevTools / Lighthouse / Screaming Frog / Siteimprove / Percy.
**How:**
1. **No generic text.** "34 small touch targets found" with generic advice is useless. List EVERY element with selector, size, shortfall, fix code.
2. **Research first.** Before implementing, ask "would axe DevTools / Lighthouse / Screaming Frog do it this way?". If unsure, look up how they do it.
3. **Test on real sites.** `americas.land`, `hrcranch.com` — sticky headers, video backgrounds, reveal footers, lazy loading. Not `example.com`.
4. **Don't guess.** When something breaks, find the actual cause and the proven solution.
5. **No low-cost subagents for core work.** User wants the strong model on the critical path.

### Screenshots — never hide content
**Rule:** Do NOT hide, remove, or cap any page content in screenshots. Sticky headers/navbars MUST be visible. Full page captured regardless of length.
**Why:** "Who the fuck are you to decide what to hide?" — user's exact words. Screenshots must look exactly like the real website. Pack A (commit `5105489`) addressed this with CDP native full-page capture + stabilization CSS that normalizes `position: sticky/fixed → static` so each element appears once at its natural position.
**How:** Never shortcut screenshot capture. Visually verify on `americas.land` before claiming success.

---

## 7. Reference test sites

- **americas.land** — sticky-header / background-video / reveal-footer trifecta. Reveal footer pattern: `.footer-dustin { position: sticky; bottom: -400px; z-index: -999 }`. Pack A stabilization CSS handles this. Crawler regression test (RFC 9309 fix in `c59c79f` was caught here — americas.land has empty `Disallow:` which used to skip every URL).
- **hrcranch.com** — long page, mixed media, lazy loading.

---

## 8. Architecture quick map

- `src/app/` — Next.js App Router routes (pages + API).
- `src/middleware.ts` — Sprint 4 API token bearer auth (will be renamed to `proxy.ts` in Sprint 6 quick wins).
- `src/lib/scanner/` — Playwright capture + audit engine.
- `src/lib/audit/engine.ts` — orchestrates a single scan.
- `src/lib/crawler/` — site crawler (BFS), `robots.ts` (RFC 9309 — fixed `c59c79f`), `sitemap.ts` (with SSRF guard).
- `src/lib/queue/` — BullMQ workers: `scan-worker.ts`, `crawl-worker.ts`, `retention-worker.ts`.
- `src/lib/ai/` — `schema.ts` (zod + JSON Schema), `models.ts` (env-driven), `retry.ts` (timeout + retry).
- `src/lib/db/` — Drizzle schema + migrations (latest: `0009_ai_usage`).
- `src/worker/index.ts` — standalone worker entrypoint, dynamic imports.

### Sprint 4 highlights (security)
- API token bearer auth via `src/middleware.ts` (timing-safe compare; GET allowed; `/api/screenshots/*` and `/api/scans/*` GET exempt).
- Worker extracted to separate Docker service.
- SSRF defense: URL/IP/port allowlist + DNS resolution (`assertScanTargetUrl`).
- Job timeouts (`withTimeout` wrapper).

### Sprint 5 highlights (multi-tenancy)
- `workspaces`, `users`, `workspace_members` tables.
- `workspace_id` on all domain tables, row-level filtering.
- Blob relocation (screenshots) + retention worker.

---

## 9. Operational gotchas

- **Worker code change requires image rebuild:** `npm run worker:build && docker-compose build worker && docker-compose up -d worker`. A `restart` is not enough — worker uses Docker image, not mounted volume.
- **Healthcheck:** node:22-slim has no wget/curl. Use `node -e "require('http').get(...)"`.
- **Playwright browsers path:** `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` in container env.
- **Lighthouse port:** fixed `9222` currently (random port + concurrency > 1 still on backlog).
- **`.env` is gitignored** — secrets do not travel with the repo. After cloning on laptop, recreate `.env` from a secure source.
- **`db:migrate` is BROKEN on fresh clones:** `.gitignore` ignores `drizzle/meta`, so `drizzle/meta/_journal.json` is never committed → `npm run db:migrate` fails with "Can't find meta/_journal.json". **Workaround (used for the demo):** `npm run db:push` (pushes schema straight to the DB, no journal needed). Real fix (parked): un-ignore `drizzle/meta` and commit the journal.
- **Standalone node scripts don't auto-load `.env`:** `db:push`/`db:migrate` and the worker (`node dist/worker.cjs`) need env exported first — `set -a; . ./.env; set +a`. Only `next dev`/`next start` auto-load `.env`.

---

## 10. New machine bootstrap (verified 2026-06-09 on a fresh Arch clone)

**Fastest reliable local-dev run — HYBRID (db/redis in docker, app+worker on host):**

```bash
git clone <repo> && cd website-audit
npm install
npx playwright install chromium      # browsers → ~/.cache/ms-playwright (host run)
cp .env.example .env                 # then EDIT for local→docker HOST ports:
#   DATABASE_URL=postgresql://uiaudit:uiaudit@localhost:5433/uiaudit
#   REDIS_URL=redis://localhost:6381
#   (optional) ANTHROPIC_API_KEY=...    # rule-based works WITHOUT it
chmod 600 .env
docker-compose up -d postgres redis  # just the stores (fast prebuilt images)
set -a; . ./.env; set +a             # standalone scripts don't auto-load .env (§9)
npm run db:push                      # NOT db:migrate — see §9 drizzle/meta bug
npm run worker                       # esbuild bundle + node worker (needs env sourced)
npm run dev                          # app on :3000   (prod: npm run build && npm run start)
```

Full Docker (`docker-compose up -d`) also works but the app/worker image build (Next build + Playwright) is slow — skip it when iterating. **Worker on host launches Playwright/Lighthouse fine on Arch** (verified).

After clone, this `MEMORY.md` loads via `CLAUDE.md` — Claude picks up where we left off.
