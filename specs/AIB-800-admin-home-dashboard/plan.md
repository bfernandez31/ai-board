# Implementation Plan: Admin home dashboard with business KPIs and trends

**Branch**: `AIB-800-admin-home-dashboard` | **Date**: 2026-05-12 | **Spec**: [specs/AIB-800-admin-home-dashboard/spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-800-admin-home-dashboard/spec.md`

## Summary

Replace the current `/admin → /admin/insights` redirect with a real admin home page that, in one server-rendered + 30-second-polled view, shows: conditional alert banners (job success rate, Stripe webhook failures, stale critical crons), a four-tile Pulse strip (Users / MAU / MRR / Active Paying), a three-panel Santé Business row (plan donut, 30-day activation funnel, current-month churn), a three-chart Tendances row (signups/day, jobs/day stacked, MRR/month), and a 2×2 grid of actionable detail tables (new paying, cancellations, top users, top projects). Non-admins receive a byte-equivalent 404. The dashboard sits inside the existing AIB-796 admin shell with the `Accueil` sidebar item active. Implementation introduces two new persisted models (`WebhookOutcome` for the Stripe-error alert, `CronRun` for the stale-cron alert), one new admin API endpoint (`GET /api/admin/home`), one new workflow-token endpoint (`POST /api/maintenance/cron-heartbeat`), and a heartbeat step appended to each registered critical cron's workflow.

## Technical Context

**Language/Version**: TypeScript 5.9 strict, Node.js 22.20.0
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5, Recharts 3.x, shadcn/ui + Radix, TailwindCSS 3.4
**Storage**: PostgreSQL 14+ via Prisma. Two new tables (`WebhookOutcome`, `CronRun`); two new enums (`WebhookOutcomeStatus`, `CriticalCron`).
**Testing**: Vitest (unit + integration), React Testing Library, Playwright (one E2E spec only)
**Target Platform**: Vercel (Next.js server runtime); the cron-heartbeat endpoint is callable from GitHub Actions runners.
**Project Type**: Web application (single Next.js app — no separate backend).
**Performance Goals**: < 3 s first paint for `/admin` on broadband (SC-001); `GET /api/admin/home` p95 < 1.5 s (well under the 30-second polling interval).
**Constraints**: No new runtime dependencies. No hardcoded hex colors (CLAUDE.md). No skeleton flash on background refresh (FR-026). Byte-equivalent 404 for non-admins (FR-002, D-10).
**Scale/Scope**: Current user base in low thousands; one row per critical cron (3 today); `WebhookOutcome` grows at inbound-Stripe rate (small). All aggregation queries are bounded to ≤ 30 days lookback except `mrrMonthly` (12 months). Spark arrays = 30 points each.

## Constitution Check

Evaluated against `.ai-board/memory/constitution.md` v1.8.0. No violations identified; no entries in Complexity Tracking.

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. TypeScript-first | ✅ | All new files strict-typed; no `any`. Response shape `AdminHomeSnapshot` defined in `lib/admin/home/types.ts`. |
| II. Component-driven architecture | ✅ | Reuses shadcn `Card`, `Skeleton`, etc. New folder `components/admin/home/*` follows feature-based structure. Server Components for shell, Client Components only for the polling wrapper + interactive sparklines. No component exceeds 300 lines (extracted sub-components only when reused or stateful — R-1 / constitution §II). |
| III. TDD | ✅ | One new test file per aggregator (`tests/unit/lib/admin/home/`), one per component (`tests/unit/components/admin/home/`), two new integration files (`home-snapshot.test.ts`, `cron-heartbeat.test.ts`), one parity-404 sibling, one E2E golden path. Extends `admin-shell-isolation.test.ts` and existing Stripe webhook integration test rather than duplicating coverage (research.md "Existing Files"). |
| IV. Security-first | ✅ | All new endpoints guarded by `requireAdminOrNotFound` (admin) or workflow-token check (cron heartbeat). Zod validation on every input. No internal ids exposed in the snapshot payload — only emails and project keys, which are admin-only data. |
| V. Database integrity | ✅ | Single Prisma migration for both new tables. `WebhookOutcome` writes happen *after* the existing `StripeEvent` idempotency claim and are wrapped in a swallow-and-log try/catch so they cannot orphan the claim (research.md "Webhook outcome recording"). `CronRun.cron` is unique → one row per cron, upserted in place. |
| V. Clarification guardrails | ✅ | Spec's `Auto-Resolved Decisions` block lists 10 conservative-fallback decisions; this plan honors each (MRR formula, MAU definition, FREE→PAID ratio, cohort funnel, 20-job alert threshold, allowlisted crons, webhook outcome tracking, jobs counted regardless of status in rankings, no-flash refresh, byte-404 for non-admins). |

## Project Structure

### Documentation (this feature)

```
specs/AIB-800-admin-home-dashboard/
├── plan.md                            # This file
├── spec.md                            # Phase -1 (already authored)
├── research.md                        # Phase 0 output
├── data-model.md                      # Phase 1 output
├── contracts/
│   ├── admin-home-snapshot.md         # GET /api/admin/home
│   ├── cron-heartbeat.md              # POST /api/maintenance/cron-heartbeat
│   └── stripe-webhook-outcome.md      # Augmented behavior of existing /api/webhooks/stripe
├── workflows/
│   ├── cron-heartbeat-workflow.md     # Workflow YAML pattern + registered crons
│   └── stripe-webhook-outcome-process.md  # In-process side-effect spec
└── tasks.md                           # Phase 2 output (NOT created by this command)
```

### Source Code (repository root)

```
app/
├── admin/
│   ├── layout.tsx                                 # REUSE (AIB-796)
│   └── page.tsx                                   # REPLACE: redirect → dashboard SSR + hydrate
├── api/
│   ├── admin/home/route.ts                        # NEW: GET admin home snapshot
│   ├── maintenance/cron-heartbeat/route.ts        # NEW: POST workflow heartbeat
│   └── webhooks/stripe/route.ts                   # MODIFY: write WebhookOutcome rows
├── lib/auth/admin.ts                              # REUSE
└── lib/db/users.ts                                # REUSE

components/admin/
├── admin-shell.tsx                                # REUSE
├── admin-sidebar-items.ts                         # REUSE (Accueil entry already present)
└── home/                                          # NEW folder
    ├── admin-home-page.tsx                        # Client wrapper with useQuery({ refetchInterval: 30_000 })
    ├── alert-stack.tsx
    ├── pulse-strip.tsx
    ├── pulse-tile.tsx
    ├── business-row.tsx
    ├── plan-donut.tsx
    ├── activation-funnel.tsx
    ├── churn-panel.tsx
    ├── trends-row.tsx
    ├── signups-trend.tsx
    ├── jobs-trend.tsx
    ├── mrr-trend.tsx
    ├── details-grid.tsx
    ├── new-paying-table.tsx
    ├── cancellations-table.tsx
    ├── top-users-table.tsx
    └── top-projects-table.tsx

lib/admin/
├── home/
│   ├── alerts.ts                                  # NEW: computeAlerts
│   ├── kpis.ts                                    # NEW: computePulseKpis
│   ├── business.ts                                # NEW: plan-distribution, activation-funnel, churn
│   ├── trends.ts                                  # NEW: signups/jobs/MRR series
│   ├── tables.ts                                  # NEW: list helpers
│   ├── snapshot.ts                                # NEW: composes everything into AdminHomeSnapshot
│   └── types.ts                                   # NEW: shared response types
├── cron/registry.ts                               # NEW: CRITICAL_CRONS allowlist + threshold
└── webhooks/record-outcome.ts                     # NEW: recordWebhookOutcome helper

prisma/
├── schema.prisma                                  # MODIFY: add WebhookOutcome, CronRun, enums
└── migrations/<ts>_aib800_admin_home_dashboard/
    └── migration.sql                              # NEW

.github/workflows/
├── nightly-log-prune.yml                          # MODIFY: append heartbeat step
├── nightly-health.yml                             # MODIFY: append heartbeat step
└── billing-reconcile.yml                          # NEW (stub): registers BILLING_RECONCILE; functional work TBD

tests/
├── integration/
│   ├── admin-shell-isolation.test.ts              # EXTEND: dashboard render assertion
│   ├── admin/
│   │   ├── home-snapshot.test.ts                  # NEW
│   │   └── cron-heartbeat.test.ts                 # NEW
│   ├── api/admin/home/parity-404.test.ts          # NEW (sibling of insights parity test)
│   └── webhooks/stripe-outcome.test.ts            # NEW or EXTEND
├── unit/
│   ├── lib/admin/home/
│   │   ├── alerts.test.ts
│   │   ├── kpis.test.ts
│   │   ├── business.test.ts
│   │   ├── trends.test.ts
│   │   └── tables.test.ts
│   └── components/admin/home/
│       ├── admin-home-page.test.tsx
│       ├── pulse-tile.test.tsx
│       ├── activation-funnel.test.tsx
│       ├── churn-panel.test.tsx
│       ├── alert-stack.test.tsx
│       └── tables.test.tsx
└── e2e/admin/home-dashboard.spec.ts               # NEW (one golden path)
```

**Structure Decision**: Single Next.js app, App Router. The dashboard surface lives entirely under `/admin` (no new top-level routes). Data aggregation lives under `lib/admin/home/` so it can be unit-tested without booting the route handlers. The cron-heartbeat endpoint lives under `/api/maintenance/*` to match the existing `prune-logs` convention (workflow-token auth, not admin session auth).

## Implementation Phases

### Phase A — Persistence + webhook outcome recording

Goal: schema and webhook-side capture in place so live data is being collected from the moment the migration runs.

1. **A.1 Prisma schema** — Add `WebhookOutcome`, `CronRun`, `WebhookOutcomeStatus`, `CriticalCron` per `data-model.md`. Run `bunx prisma generate`. Create migration.
2. **A.2 `lib/admin/webhooks/record-outcome.ts`** — Implement `recordWebhookOutcome(eventId, type, status, errorMessage?)`. Inner try/catch swallows + logs (research.md "Webhook outcome recording").
3. **A.3 Modify `app/api/webhooks/stripe/route.ts`** — Insert SUCCESS call after the handler `switch` returns; insert FAILURE call inside the existing `catch (error)`. **Preserves** the existing idempotency-claim ordering (claim first, outcome second).
4. **A.4 Tests** — `tests/integration/webhooks/stripe-outcome.test.ts`: success / failure / duplicate / recording-itself-fails. Pattern reference: existing Stripe webhook tests (extend if present).

### Phase B — Cron heartbeat endpoint + workflow wiring

Goal: cron timestamps start being captured so the alert detector has data to read.

1. **B.1 `lib/admin/cron/registry.ts`** — `CRITICAL_CRONS` array `{ key: CriticalCron, label, thresholdHours: 36 }`. Mirrors the Prisma enum.
2. **B.2 `app/api/maintenance/cron-heartbeat/route.ts`** — Bearer-token auth (matches `prune-logs`), Zod `z.object({ cron: z.nativeEnum(CriticalCron) }).strict()`, `prisma.cronRun.upsert({ where: { cron }, create: { cron, lastSuccessAt: new Date() }, update: { lastSuccessAt: new Date() } })`.
3. **B.3 Workflows** — Append the heartbeat step (per `workflows/cron-heartbeat-workflow.md`) to `nightly-log-prune.yml` and `nightly-health.yml`. Create stub `billing-reconcile.yml` whose functional work is a no-op for this ticket (`echo "TBD"`) but whose schedule + heartbeat are real.
4. **B.4 Tests** — `tests/integration/admin/cron-heartbeat.test.ts`: missing token → 401; unknown cron → 400; valid → 200 with row; repeated calls advance `lastSuccessAt`.

### Phase C — Aggregation library

Goal: every value the dashboard will render exists as a unit-testable function.

1. **C.1 `lib/admin/home/types.ts`** — `AdminHomeSnapshot` and its sub-types per `contracts/admin-home-snapshot.md`.
2. **C.2 `lib/admin/home/alerts.ts`** — Per `data-model.md` Alert detectors. Returns `Alert[]` in deterministic order.
3. **C.3 `lib/admin/home/kpis.ts`** — `computePulseKpis()`. Builds users / MAU / MRR / active-paying tile shapes and their 30-day sparkline series. Reuses `PLANS` from `lib/billing/plans.ts`.
4. **C.4 `lib/admin/home/business.ts`** — `computePlanDistribution`, `computeActivationFunnel`, `computeChurn`. The downgrade approximation in `computeChurn` is documented in code per `data-model.md`.
5. **C.5 `lib/admin/home/trends.ts`** — `computeSignupsDaily(30)`, `computeJobsDaily(30)`, `computeMrrMonthly(12)`. Daily series use raw SQL via `prisma.$queryRaw` (Prisma `groupBy` does not support `DATE_TRUNC`).
6. **C.6 `lib/admin/home/tables.ts`** — `listNewPayingUsers`, `listRecentCancellations`, `listTopUsersThisMonth`, `listTopProjectsThisMonth`.
7. **C.7 `lib/admin/home/snapshot.ts`** — `buildSnapshot()`: orchestrates all aggregators via `Promise.all` so they run in parallel; wraps each in its own try/catch so a partial failure logs and degrades to an empty section rather than failing the whole response. (Per FR-029 + spec edge cases: empty blocks render without errors. The single-fail-everything behavior described in `contracts/admin-home-snapshot.md` 500 case is reserved for synthesis bugs, not per-aggregator data-shape issues.)
8. **C.8 Tests** — One Vitest unit file per aggregator under `tests/unit/lib/admin/home/`, seeding Prisma rows for each scenario (empty platform, single-user, partial data, full).

### Phase D — API endpoint

1. **D.1 `app/api/admin/home/route.ts`** — `export async function GET(request: NextRequest)`. Guard via `requireAdminOrNotFound`. Call `buildSnapshot()`. Return JSON with `Cache-Control: no-store`.
2. **D.2 Tests**
   - `tests/integration/admin/home-snapshot.test.ts` — Asserts schema shape, that emails come back verbatim, sparkline arrays are length 30, mrrMonthly ≤ 12, alerts in deterministic order.
   - `tests/integration/api/admin/home/parity-404.test.ts` — Byte-equivalent 404 for non-admin / unauthenticated / blocked override. Pattern reference: `tests/integration/api/admin/insights/parity-404.test.ts`.

### Phase E — UI

1. **E.1 `app/admin/page.tsx`** — Server Component. Calls `requireAdminPageOrNotFound` (defense-in-depth alongside the layout). Calls `buildSnapshot()` once for initial data. Renders `<AdminHomePage initialData={snapshot} />`.
2. **E.2 `components/admin/home/admin-home-page.tsx`** — `'use client'`. `useQuery({ queryKey: ['admin','home'], queryFn: fetchSnapshot, initialData: props.initialData, refetchInterval: 30_000, staleTime: 25_000, placeholderData: keepPreviousData })`. Renders 4 strata.
3. **E.3 Sub-components** — Each stratum into its own component (`alert-stack.tsx`, `pulse-strip.tsx`, `business-row.tsx`, `trends-row.tsx`, `details-grid.tsx`). Tile/panel components are extracted only when reused (per constitution §II — Pulse uses 4 instances of `pulse-tile.tsx`, so it qualifies).
4. **E.4 Charts** — Recharts patterns from `components/analytics/cost-over-time-chart.tsx`. `hsl(var(--chart-N))` colors only. `ResponsiveContainer` wrapping.
5. **E.5 Empty states** — Every sub-component handles its own empty array with a `text-muted-foreground` placeholder. Delta formatter `formatDelta` lives in `lib/admin/home/format.ts` and returns `—` for missing-prior cases (R-5).
6. **E.6 Tests** — `tests/unit/components/admin/home/*.test.tsx` — at minimum: empty-state rendering, delta formatting, no-skeleton-on-refresh (mutate cache mid-refetch, assert previous DOM stays mounted), alert links present.

### Phase F — E2E and acceptance

1. **F.1 Extend `tests/integration/admin-shell-isolation.test.ts`** — assert that admin GET `/admin` renders the dashboard headings/landmarks (Alertes, Pulse, Santé Business, Tendances, Détails actionnables).
2. **F.2 `tests/e2e/admin/home-dashboard.spec.ts`** — Playwright: sign in as `[e2e]` admin (via `x-test-user-id` or seeded session), load `/admin`, assert the four Pulse tiles are visible and one alert banner appears when a synthetic failure is seeded (golden path only).

## Testing Strategy

Per constitution §III decision tree:

| Coverage area | Test type | Location | Existing or new |
|---------------|-----------|----------|-----------------|
| Alert detectors / KPI math / table queries | Vitest unit (with seeded Prisma rows) | `tests/unit/lib/admin/home/*.test.ts` | NEW — one file per aggregator module; no existing file covers this domain. |
| Component behavior (empty states, delta formatting, no-skeleton refresh) | Vitest + RTL | `tests/unit/components/admin/home/*.test.tsx` | NEW folder. |
| `GET /api/admin/home` shape + 404 parity | Vitest integration | `tests/integration/admin/home-snapshot.test.ts`, `tests/integration/api/admin/home/parity-404.test.ts` | NEW — the parity test follows the existing insights parity pattern. |
| Cron heartbeat endpoint | Vitest integration | `tests/integration/admin/cron-heartbeat.test.ts` | NEW. |
| Webhook outcome capture | Vitest integration | `tests/integration/webhooks/stripe-outcome.test.ts` | NEW or extend existing Stripe webhook tests if they exist under `tests/integration/webhooks/`. |
| Admin shell + new dashboard render | Vitest integration | `tests/integration/admin-shell-isolation.test.ts` | EXTEND (already covers `/admin` access control). |
| One golden-path E2E | Playwright | `tests/e2e/admin/home-dashboard.spec.ts` | NEW. E2E is reserved for the SC-005 "no flicker over a real 30-second window" assertion that integration tests cannot make. |

All test files use `[e2e]` prefix for seeded project names, ticket titles, and tokens per CLAUDE.md.

## Complexity Tracking

No constitution violations identified. No entries.
