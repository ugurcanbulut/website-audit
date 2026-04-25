# Project Memory — UI Audit

> Persistent context for Claude Code, synced via git so any machine (laptop, desktop) gets the same picture. Loaded automatically through `CLAUDE.md`.

**Last updated:** 2026-04-25
**Repo:** github.com/ugurcanbulut/website-audit
**Branch:** main

---

## 1. Current state — where we left off

### Last shipped commits (origin/main)
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

### Sprint 6 quick wins — IN PROGRESS (paused for travel)
User approved 3 quick wins out of full Sprint 6 (observability):
1. **pino + request ID** — base logger module, `middleware.ts` → `proxy.ts` rename (Next.js 16 convention), `x-request-id` header injection, replace `console.*` in worker/queue/audit/scanner/ai/crawler.
2. **Sentry** — `src/instrumentation.ts` with `register()` + `onRequestError()`, `@sentry/node` init in worker with `Sentry.withScope()` for scanId/workspaceId tags. Graceful no-op when `SENTRY_DSN` unset.
3. **bull-board** — mini Express on port 3002 inside worker container, mount adapters for scan/crawl/retention queues, protect with `API_TOKEN` bearer (timing-safe). Add port mapping to docker-compose.yml.

**Status:** Dependencies installed, no code written yet. Ready to resume from "create logger module" step.

```
npm install (already done):
  pino  pino-pretty  @bull-board/api  @bull-board/express
  express  @sentry/nextjs  @sentry/node
```

### Resume point
First concrete step on resume:
1. Create `src/lib/observability/logger.ts` (base pino + scope helper).
2. Replace `console.*` in: `src/worker/index.ts`, `src/lib/queue/scan-worker.ts`, `src/lib/queue/crawl-worker.ts`, `src/lib/queue/retention-worker.ts`, `src/lib/audit/engine.ts`, `src/lib/scanner/capture.ts`, `src/lib/ai/*`, `src/lib/crawler/crawler.ts`.
3. Rename `src/middleware.ts` → `src/proxy.ts`, function `middleware()` → `proxy()`, add `x-request-id` (crypto.randomUUID).
4. Then Sentry, then bull-board.

---

## 2. Project goal & deploy

**Goal:** Enterprise-grade All-in-One web audit tool (UI / UX / SEO / Security / Accessibility) — comparable in quality to axe DevTools, Lighthouse, Screaming Frog, Siteimprove, Percy.

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
- **Communication** — User writes in Turkish. Reply in Turkish unless code/docs.
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

---

## 10. New machine bootstrap (laptop)

```bash
git clone <repo>
cd ui-audit
npm install                       # installs Sprint 6 deps already in package.json
cp .env.example .env              # then fill in secrets
chmod 600 .env
npx playwright install chromium   # if running outside Docker
docker-compose up -d              # full stack
```

After clone, this `MEMORY.md` is loaded automatically via `CLAUDE.md` — Claude picks up where we left off.
