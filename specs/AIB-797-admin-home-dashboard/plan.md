# Implementation Plan: Admin home dashboard with business KPIs and trends

**Branch**: `AIB-797-admin-home-dashboard` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the `/admin → /admin/insights` redirect with a 5-stratum operator dashboard rendered inside the AIB-796 admin shell: (1) alerts strip, (2) four hero KPIs (Users, MAU, MRR estimé, Active payants), (3) business-health panels (plan distribution, 30-day activation funnel, churn), (4) trend charts (signups/day 30d, jobs/day 30d, MRR/month 12mo), (5) actionable 2×2 tables. Data is served by a single consolidated endpoint `GET /api/admin/home` that the page polls every 30s via TanStack Query with stale-while-revalidate. Auth reuses `requireAdminPageOrNotFound` / `requireAdminOrNotFound` (byte-equivalent 404 for non-admins). A new `CronRunLog` model + `POST /api/admin/cron-markers` callback enables the "cron not run in 36h" alert; the two nightly workflows gain a non-blocking marker step.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0  
**Primary Dependencies**: Next.js 16 (App Router, RSC), React 18, Prisma 6.x, TanStack Query v5.95.2, Recharts 3.x, TailwindCSS 3.4, shadcn/ui, lucide-react, NextAuth.js, Zod  
**Storage**: PostgreSQL 14+ via Prisma. One new table (`CronRunLog`); read-only access to `User`, `Project`, `Job`, `Subscription`, `StripeEvent`.  
**Testing**: Vitest (unit + integration), React Testing Library via `renderWithProviders` (`tests/utils/component-test-utils.tsx`); no Playwright E2E required for this feature.  
**Target Platform**: Vercel serverless functions + browser (admin desktop, 1366×768 minimum viewport).  
**Project Type**: web (Next.js App Router monolith).  
**Performance Goals**: First paint of dashboard ≤ 5s (SC-001); aggregator p95 ≤ 800 ms; ≤ 2 HTTP requests per poll (SC-010); polling cadence 30s (FR-025).  
**Constraints**: No raw SQL (FR-033); no hardcoded hex colors (CLAUDE.md); no new UI lib (CLAUDE.md); no per-section partial-200 responses (FR-028); non-admin requests return byte-equivalent 404 (SC-002); polling pauses on hidden tab (FR-026, SC-011).  
**Scale/Scope**: Internal admin tool — N admins ≤ ~10; one snapshot computed per request from DB state; payload ≤ 50 KB gzipped. Read load is bounded (N admins × 2 req/min × 1 endpoint).

No `NEEDS CLARIFICATION` items remain — every Technical Context dimension resolves to a concrete value already in the stack.

## Constitution Check

*Re-evaluated after Phase 1 design. All gates PASS — see post-design check below.*

### Pre-Phase-0 gate

| Principle | Status | Justification |
|-----------|--------|---------------|
| I. TypeScript-First | PASS | All new code is `.ts`/`.tsx`, strict mode, no `any`. Aggregator returns typed `DashboardSnapshot`. |
| II. Component-Driven | PASS | New components live under `components/admin/home/`; Server Component shell + Client subtree pattern from `/admin/insights` (P1). shadcn/ui Card/Badge/Skeleton only. |
| III. TDD (NON-NEGOTIABLE) | PASS | Test files inventoried in research.md; aggregator covered by `dashboard-snapshot.test.ts` against in-memory fixtures; integration tests cover the route, alerts, parity-404. |
| IV. Security-First | PASS | Admin-gate enforced server-side via `requireAdminOrNotFound` (existing helper); Zod schemas on the marker endpoint mirror DB column constraints; no raw SQL; secrets stay in `WORKFLOW_API_TOKEN`. |
| V. Database Integrity | PASS | One new model (`CronRunLog`) via Prisma migration; no FKs, no backfill; read-only access to existing tables. Append-only, lazy 7-day prune. |
| V (Spec Clarification Guardrails) | PASS | Spec's 10 Auto-Resolved Decisions are all `AUTO → CONSERVATIVE`, documented inline. No PRAGMATIC mode used; no decisions trim safeguards. |

### Project structure check

Single-project, web-app layout — already matches the repo. No new monorepo packages, no new build pipelines, no new dependencies in `package.json`. PASS.

### Post-Phase-1 re-evaluation

Re-checked after data-model.md, contracts/, workflows/ were drafted. **All gates still PASS.** Findings:

- The new `CronRunLog` model is the smallest persistence surface that satisfies the spec (one new table, two indexes, no FK, no backfill). Database Integrity gate unchanged.
- The contract for `POST /api/admin/cron-markers` uses Zod validation mirroring DB column types (Security gate § "Zod schema constraints MUST match corresponding database column constraints").
- The aggregator's `Promise.all` fan-out keeps error propagation atomic per §V (P6): any sub-query throw becomes a 5xx; no partial 200.
- The workflow edit is non-blocking (`continue-on-error: true`) per spec §Internal Processes, so a marker-write outage cannot fail the cron itself — TDD §III still has clean assertions because the marker write is tested independently of the cron workflow.

No `Complexity Tracking` row needed.

## Project Structure

### Documentation (this feature)

```
specs/AIB-797-admin-home-dashboard/
├── plan.md                              # This file
├── spec.md                              # Already exists
├── research.md                          # Phase 0 (created)
├── data-model.md                        # Phase 1 (created)
├── contracts/
│   └── admin-home-snapshot.md           # Phase 1 (created)
├── workflows/
│   └── cron-marker-callback.md          # Phase 1 (created)
├── checklists/                          # Pre-existing, untouched
└── tasks.md                             # NOT created by /plan
```

### Source code (repository root)

```
app/
├── admin/
│   └── page.tsx                         # MODIFY — remove redirect, render dashboard
└── api/
    └── admin/
        ├── home/
        │   └── route.ts                 # NEW — GET dashboard snapshot
        └── cron-markers/
            └── route.ts                 # NEW — POST workflow marker callback

components/
└── admin/
    └── home/                            # NEW directory
        ├── admin-home-dashboard.tsx     # Client orchestrator ('use client')
        ├── alerts-strip.tsx
        ├── kpi-tile.tsx
        ├── kpi-sparkline.tsx            # Recharts wrapper (~40px tall)
        ├── plan-distribution-donut.tsx  # Recharts PieChart
        ├── activation-funnel.tsx
        ├── churn-panel.tsx
        ├── trend-signups-chart.tsx      # 30d line/bar
        ├── trend-jobs-chart.tsx         # 30d stacked
        ├── trend-mrr-chart.tsx          # 12mo bar
        ├── actionable-table.tsx         # Generic compact table primitive
        └── empty-state.tsx              # Section-level neutral empty state

app/lib/
└── admin/
    └── home/                            # NEW directory
        ├── types.ts                     # All DashboardSnapshot DTOs (data-model.md §Transient response DTOs)
        ├── dashboard-snapshot.ts        # Aggregator: composes all sections via Promise.all
        ├── alerts.ts                    # Alert detection: job-success, stripe-webhook, cron(s)
        ├── pulse.ts                     # 4 KPI tiles
        ├── business-health.ts           # plan distribution, funnel cohort, churn
        ├── trends.ts                    # 3 trend series
        ├── actionable.ts                # 4 tables with tie-break order
        └── formatters.ts                # ALL pure formatting helpers (no React imports)

app/lib/hooks/queries/
└── use-admin-home-snapshot.ts           # NEW — TanStack Query hook, 30s polling, initialData prop

prisma/
├── schema.prisma                        # MODIFY — add CronRunLog model
└── migrations/
    └── <ts>_add_cron_run_log/
        └── migration.sql                # NEW — single CREATE TABLE + 2 indexes

.github/workflows/
├── nightly-health.yml                   # MODIFY — append marker step
└── nightly-log-prune.yml                # MODIFY — append marker step

tests/
├── unit/
│   ├── components/admin/home/
│   │   ├── admin-home-dashboard.test.tsx
│   │   ├── kpi-tile.test.tsx
│   │   ├── alerts-strip.test.tsx
│   │   ├── activation-funnel.test.tsx
│   │   └── top-tables.test.tsx
│   └── lib/admin/home/
│       ├── dashboard-snapshot.test.ts   # In-memory fixture
│       ├── alerts.test.ts
│       └── formatters.test.ts
└── integration/
    └── api/admin/
        ├── home/
        │   ├── snapshot.test.ts         # 5 DB fixtures: empty, small, large, 3 alert conditions
        │   └── parity-404.test.ts       # Byte-equivalent 404 — mirrors insights/parity-404
        └── cron-markers/
            └── post.test.ts             # Workflow-token auth, validation, idempotent log
```

**Structure Decision**: Web app (Option 2) — single Next.js App Router monolith. The repo already follows this layout; no structural reshape needed.

## Implementation Phases

### Phase A — Foundation (data model, types, formatters)

These tasks have no UI dependencies and unblock everything else.

1. **Add `CronRunLog` model** — `prisma/schema.prisma`. Create the migration `prisma migrate dev --name add_cron_run_log`. Run `bunx prisma generate`.
2. **Define DTO types** — `app/lib/admin/home/types.ts`. All interfaces from data-model.md §Transient response DTOs. Export from a single barrel.
3. **Implement formatters** — `app/lib/admin/home/formatters.ts`. Pure functions: `formatPriceCents(n) → "€15.00"`, `formatDelta(d) → "+12"|"−4%"`, `formatPercent`, `formatCountWithSpacedThousands`. NO React imports. Covered by `formatters.test.ts`.

### Phase B — Aggregator (pure compute, fully unit-testable)

4. **Implement `pulse.ts`** — 4 functions returning `KpiTile`. No raw SQL: use Prisma aggregations. MRR uses `PLANS.PRO.priceMonthly`/`PLANS.TEAM.priceMonthly` (FR-012); MAU uses Job-this-month (FR-011). Each function fetches its window data and computes the sparkline array of exactly 30 numbers.
5. **Implement `business-health.ts`** — plan-distribution counts; 30-day activation funnel with chronological cohort rule (each step's set is users who reached the previous step before the current step's timestamp); churn panel for current calendar month (cancellations, downgrades, MRR lost via current `PLANS.*.priceMonthly`).
6. **Implement `trends.ts`** — three time-bucketed series, every day/month populated even if zero (FR-019, FR-021).
7. **Implement `actionable.ts`** — four tables with deterministic sort + tie-break (FR-022, SC-008). Cap 30-day tables at 25 rows, return `total` count separately.
8. **Implement `alerts.ts`** — three detectors: job-success (7-day rate < 0.90), stripe-webhook (transitions-without-events 24h), cron-stale (latest `CronRunLog` per name > 36h, OR none ever, for each entry in hard-coded `CRITICAL_CRONS`). Return `AlertCard[]` in fixed order (FR-008).
9. **Compose `dashboard-snapshot.ts`** — single `computeDashboardSnapshot(): Promise<DashboardSnapshot>` that fans out via `Promise.all`. Follow constitution §V (pattern P6): per-section errors propagate up; do NOT swallow.

### Phase C — API routes

10. **`GET /api/admin/home`** — `app/api/admin/home/route.ts`. Apply pattern **P2** from research.md exactly: `requireAdminOrNotFound → if (!auth.ok) return auth.response → computeDashboardSnapshot → NextResponse.json`. `export const dynamic = 'force-dynamic'`.
11. **`POST /api/admin/cron-markers`** — `app/api/admin/cron-markers/route.ts`. Apply pattern **P4** (`verifyWorkflowToken`). Validate body via Zod schema in data-model.md. Insert `CronRunLog` row; lazy `deleteMany` rows older than 7 days (wrap in try/catch — failure here MUST NOT fail the marker write per pattern **P5**).

### Phase D — UI (Server Component shell + Client subtree)

12. **TanStack Query hook** — `use-admin-home-snapshot.ts`. Apply pattern **P3** exactly: query key `['admin','home','snapshot'] as const`, `initialData` parameter, `refetchInterval: 30_000`, `staleTime: 30_000`, `placeholderData: keepPreviousData`. `refetchIntervalInBackground` defaults to `false` (FR-026, SC-011).
13. **`app/admin/page.tsx`** — DELETE the `redirect('/admin/insights')` (FR-001). Replace with Server Component that calls `computeDashboardSnapshot()` once and passes it as `initialData` to `<AdminHomeDashboard initialData={...} />`. Apply pattern **P1**.
14. **`AdminHomeDashboard`** (client) — orchestrates `useAdminHomeSnapshot`, renders the page-level error banner on query error (FR-028), composes the 5 strata. Includes the SC-001-critical first-paint structure (header → alerts → KPI grid → business panels → trends → actionable grid).
15. **Sub-components** — `AlertsStrip`, `KpiTile`, `KpiSparkline`, `PlanDistributionDonut`, `ActivationFunnel`, `ChurnPanel`, `TrendSignupsChart`, `TrendJobsChart`, `TrendMrrChart`, `ActionableTable`, `EmptyState`. Every chart uses `hsl(var(--chart-N))` (pattern **P8**); every section renders a typed empty state when its data is empty (pattern **P7**, FR-023).

### Phase E — Workflow edits

16. **Edit `nightly-health.yml`** — append the marker step from `workflows/cron-marker-callback.md` with `WORKFLOW_NAME: nightly-health`. Use `if: success()` and `continue-on-error: true`.
17. **Edit `nightly-log-prune.yml`** — same step with `WORKFLOW_NAME: nightly-log-prune`.

### Phase F — Tests (alongside implementation per TDD §III)

See §Testing Strategy below. Tests are written **before or alongside** each implementation task; no implementation task is "done" until its accompanying test passes.

## Testing Strategy

Aligned with constitution §III decision tree. Inventory from research.md §Existing Files drove every "extend vs. new" call.

### Unit (Vitest, no DB)

- `tests/unit/lib/admin/home/dashboard-snapshot.test.ts` — **NEW**. Drives the entire aggregator from an in-memory Prisma mock or hand-crafted fixture. Covers: MRR formula (FR-012), MAU rule (FR-011), funnel chronological order, churn formula, tie-break order, deltas signs. Reuses no existing test file because no existing aggregator covers admin-home data.
- `tests/unit/lib/admin/home/alerts.test.ts` — **NEW**. Three alert conditions independently + ordering + healthy-silence (FR-004, SC-003).
- `tests/unit/lib/admin/home/formatters.test.ts` — **NEW**. Pure formatters: cents-to-euro, signed deltas, percentage with "—" for divide-by-zero (edge case in spec).
- `tests/unit/components/admin/home/admin-home-dashboard.test.tsx` — **NEW**. Wraps with `renderWithProviders`; mocks fetch; asserts skeleton on first load, empty state when initial data has zero rows, page-level error banner on 5xx, retry button works, no skeleton on subsequent poll (FR-025).
- `tests/unit/components/admin/home/kpi-tile.test.tsx` — **NEW**. Renders the 4 IDs with fixture data; asserts headline + 2 deltas + sparkline element + tooltip exposes definition (MAU tooltip per spec).
- `tests/unit/components/admin/home/alerts-strip.test.tsx` — **NEW**. Conditional render (FR-004 — no DOM at all when empty); fixed order; theme tokens for warning surface (no hex literals).
- `tests/unit/components/admin/home/activation-funnel.test.tsx` — **NEW**. Renders 4 steps; "—" not "NaN%" on zero cohort (spec edge case); conversion-rate math vs. previous step.
- `tests/unit/components/admin/home/top-tables.test.tsx` — **NEW**. Tie-break determinism (SC-008): two adjacent renders of same fixture produce identical row order; 25-row cap + count badge.

### Integration (Vitest with TEST_MODE server)

- `tests/integration/api/admin/home/snapshot.test.ts` — **NEW**. Five DB fixtures: (a) empty DB; (b) small DB with 3 users / 1 paid / no jobs; (c) large DB with > 50 entities (validates 25-row cap, SC-007); (d) forced job-success alert condition; (e) forced cron-stale alert condition. Each fixture asserts the snapshot's invariants (planDistribution sum === Subscription.count, signups 30-day sum === funnel signup count).
- `tests/integration/api/admin/home/parity-404.test.ts` — **NEW**. Mirrors `tests/integration/api/admin/insights/parity-404.test.ts` exactly. Mocks `requireAdminOrNotFound` rejection; asserts byte-equivalent 404 (status, headers, body) against control from `adminNotFoundResponse()` (SC-002).
- `tests/integration/api/admin/cron-markers/post.test.ts` — **NEW**. Three scenarios: (a) missing Bearer → 401; (b) valid token + valid body → 201 + row written; (c) invalid `workflowName` (not in CRITICAL_CRONS) → 400; (d) two consecutive successful writes within 1s produce two rows (idempotency-by-append documented).

### E2E (Playwright)

**None required.** Justification: the existing AIB-796 e2e test already covers sidebar navigation to `/admin`; the byte-equivalent 404 contract is fully testable in integration via `parity-404.test.ts`; no OAuth, drag-drop, or viewport-only behavior is involved. Constitution §III #4: "Does it REQUIRE a browser?" → No. Per CLAUDE.md, E2E is expensive (~5s each) and defaults to integration when unsure.

### Test files we do NOT touch

- `tests/unit/components/admin/admin-shell.test.tsx` — sidebar items unchanged; AIB-796 coverage stands.
- `tests/integration/admin-shell-isolation.test.ts` — header isolation unchanged.
- `tests/integration/api/admin/insights/*.test.ts` — out of scope.

## Complexity Tracking

No constitution violations. No exception entries required.

---

## Phase 2 (next command)

The `/ai-board.tasks` command will consume this plan + data-model.md + contracts/ + workflows/ and produce `tasks.md` — a dependency-ordered task list mapped to the 17 implementation tasks above. This is NOT the responsibility of `/plan`.
