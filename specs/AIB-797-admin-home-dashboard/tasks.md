---
description: "Task list for AIB-797 admin home dashboard"
---

# Tasks: Admin home dashboard with business KPIs and trends

**Input**: Design documents from `/specs/AIB-797-admin-home-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, workflows/

**Tests**: Test tasks are INCLUDED (constitution §III). Each implementation task in a user story phase has a matching test task that MUST be written first and MUST fail before the implementation task is completed.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps task to user story from spec.md (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app — single Next.js App Router monolith. All paths are relative to repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database persistence layer for the cron-marker signal that backs the "critical cron not run for 36h" alert.

- [X] T001 ✅ DONE Add `CronRunLog` model (fields per data-model.md §Persisted entities: `id`, `workflowName VarChar(100)`, `ranAt DateTime @default(now())`, `durationMs Int?`, `runUrl VarChar(500)?`, `@@index([workflowName, ranAt])`, `@@index([ranAt])`) in `prisma/schema.prisma`
- [X] T002 ✅ DONE Generate Prisma migration `add_cron_run_log` (single `CREATE TABLE` + 2 indexes, no FK, no backfill) by running `bunx prisma migrate dev --name add_cron_run_log` — produces `prisma/migrations/<timestamp>_add_cron_run_log/migration.sql`
- [X] T003 ✅ DONE Regenerate Prisma client by running `bunx prisma generate` (updates `node_modules/.prisma/client` for the new `CronRunLog` model)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type contract, pure helpers, snapshot composer, API route, client hook, page shell — the structural skeleton that all three user stories plug into.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. Sub-aggregator files are created here as stubs that return zero-data shapes, then each story replaces its stub with real logic.

- [X] T004 ✅ DONE [P] Create `DashboardSnapshot` and all sub-DTO TypeScript interfaces (`AlertCard`, `AlertKind`, `KpiTile`, `KpiId`, `Delta`, `PlanDistribution`, `FunnelStep`, `FunnelStepId`, `ChurnPanel`, `DailyPoint`, `JobsDailyPoint`, `MonthlyPoint`, `PaidUserRow`, `CancellationRow`, `TopUserRow`, `TopProjectRow`) per data-model.md §Transient response DTOs in new file `app/lib/admin/home/types.ts`
- [X] T005 ✅ DONE [P] Create unit tests for formatters in new file `tests/unit/lib/admin/home/formatters.test.ts` — cover `formatPriceCents` (1500 → "€15.00"), `formatDelta` (signed `+12` / `−4%`), `formatPercent` ("—" on divide-by-zero per spec edge case), `formatCountWithSpacedThousands`
- [X] T006 ✅ DONE [P] Implement pure formatter helpers `formatPriceCents`, `formatDelta`, `formatPercent`, `formatCountWithSpacedThousands` (NO React imports) in new file `app/lib/admin/home/formatters.ts`
- [X] T007 ✅ DONE [P] Create stub aggregator `computePulse(): Promise<DashboardSnapshot['pulse']>` returning all-zero `KpiTile`s with 30-element zero sparklines in new file `app/lib/admin/home/pulse.ts` (real logic added in US1)
- [X] T008 ✅ DONE [P] Create stub aggregator `detectAlerts(): Promise<AlertCard[]>` returning `[]` plus exported `CRITICAL_CRONS = ['nightly-health', 'nightly-log-prune'] as const` in new file `app/lib/admin/home/alerts.ts` (real detection added in US1)
- [X] T009 ✅ DONE [P] Create stub aggregator `computeBusinessHealth(): Promise<DashboardSnapshot['businessHealth']>` returning zero-valued `PlanDistribution`, 4-step zero-count funnel, zero `ChurnPanel` in new file `app/lib/admin/home/business-health.ts` (real logic added in US2)
- [X] T010 ✅ DONE [P] Create stub aggregator `computeTrends(): Promise<DashboardSnapshot['trends']>` returning 30-day / 30-day / 12-month series filled with zero values + correctly-bucketed dates in new file `app/lib/admin/home/trends.ts` (real logic added in US2)
- [X] T011 ✅ DONE [P] Create stub aggregator `computeActionable(): Promise<{ tables: DashboardSnapshot['actionable']; totals: { newPayingUsersTotal: number; recentCancellationsTotal: number } }>` returning empty rows arrays and zero totals in new file `app/lib/admin/home/actionable.ts` (real logic added in US3)
- [X] T012 ✅ DONE Implement `computeDashboardSnapshot(): Promise<DashboardSnapshot>` that fans out to `computePulse`, `detectAlerts`, `computeBusinessHealth`, `computeTrends`, `computeActionable` via `Promise.all` (per plan §Phase B / research P6: errors propagate, NO partial 200), composes the full `DashboardSnapshot` (sets `generatedAt = new Date().toISOString()`, sorts alerts in fixed order job-success → stripe-webhook → cron(s)-asc-by-workflowName, attaches `meta.{newPayingUsersTotal, recentCancellationsTotal, currencyMinorUnit: 'cents'}`) in new file `app/lib/admin/home/dashboard-snapshot.ts`
- [X] T013 ✅ DONE Create integration test asserting byte-equivalent 404 from `GET /api/admin/home` for non-admin sessions — mirror `tests/integration/api/admin/insights/parity-404.test.ts:30-83` exactly (mock `requireAdminOrNotFound` to reject, assert status + headers + body bytes equal `adminNotFoundResponse()`) in new file `tests/integration/api/admin/home/parity-404.test.ts`
- [X] T014 ✅ DONE Implement `GET /api/admin/home` route handler — apply research P2 pattern exactly: `const auth = await requireAdminOrNotFound(request); if (!auth.ok) return auth.response; const snapshot = await computeDashboardSnapshot(); return NextResponse.json(snapshot)`. Add `export const dynamic = 'force-dynamic'` for `Cache-Control: no-store`. On thrown error from `computeDashboardSnapshot`, return 500 `{ error: 'Failed to compute dashboard snapshot', code: 'SNAPSHOT_FAILED' }`. New file `app/api/admin/home/route.ts`
- [X] T015 ✅ DONE [P] Create TanStack Query hook `useAdminHomeSnapshot(initialData: DashboardSnapshot)` — research P3 pattern: `queryKey: ['admin', 'home', 'snapshot'] as const`, `queryFn` fetches `/api/admin/home`, `refetchInterval: 30_000`, `staleTime: 30_000`, `placeholderData: keepPreviousData`, default `refetchIntervalInBackground: false` (FR-026, SC-011). New file `app/lib/hooks/queries/use-admin-home-snapshot.ts`

**Checkpoint**: `GET /api/admin/home` returns a valid (all-zero) `DashboardSnapshot`; `parity-404.test.ts` passes; client hook compiles. Page still redirects until US1.

---

## Phase 3: User Story 1 — Admin operator gets a 5-second pulse on platform health (Priority: P1) 🎯 MVP

**Goal**: Replace `/admin → /admin/insights` redirect with a dashboard rendering the 4 hero KPI tiles (Users, MAU, MRR estimé, Active payants), the conditional alerts strip (job-success / stripe-webhook / cron-stale), and silent 30s polling with stale-while-revalidate.

**Independent Test**: As an admin, navigate to `/admin`. The page renders inside the admin shell with the "Accueil" sidebar item active, four KPI tiles are visible above the fold on 1366×768 with values+deltas+sparklines, and either no alerts strip (healthy) or a fixed-order alerts strip with action links is visible. After 30s, data refreshes in place with no skeleton flash. Non-admin visit returns byte-equivalent 404.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T016 ✅ DONE [P] [US1] Create unit test for `pulse.ts` aggregator covering FR-012 MRR formula (`(active PRO × PLANS.PRO.priceMonthly) + (active TEAM × PLANS.TEAM.priceMonthly)` in cents), FR-011 MAU rule (distinct users with ≥1 `Job` in current UTC calendar month), Users tile Δ7d/Δ30d delta math, exactly-30-element sparkline length invariant, FREE→PAID conversion rate for `paying` tile — against in-memory fixture in new file `tests/unit/lib/admin/home/pulse.test.ts`
- [X] T017 ✅ DONE [P] [US1] Create unit test for `alerts.ts` covering: (a) job-success alert triggers when 7-day completed/(completed+failed+cancelled) < 0.90 with correct `successRatePct` payload, (b) stripe-webhook alert triggers only when paid-transition exists AND no matching `StripeEvent` in 24h, (c) one cron alert per `CRITICAL_CRONS` entry whose latest `CronRunLog.ranAt` > 36h (or no row at all), (d) healthy fixture returns empty array (FR-004, SC-003), (e) fixed order job-success → stripe-webhook → cron(sorted by workflowName) in new file `tests/unit/lib/admin/home/alerts.test.ts`
- [X] T018 ✅ DONE [P] [US1] Create integration test for `POST /api/admin/cron-markers`: (a) missing/invalid Bearer → 401, (b) valid token + valid body (`workflowName: 'nightly-health'`) → 201 with `{ id, ranAt }` + row written, (c) `workflowName` not in `CRITICAL_CRONS` (Zod enum reject) → 400 with `VALIDATION_FAILED`, (d) two consecutive successful writes within 1s produce two rows (append-only contract, FR-007 read side) in new file `tests/integration/api/admin/cron-markers/post.test.ts`
- [X] T019 ✅ DONE [P] [US1] Create integration test for `GET /api/admin/home` snapshot under three fixtures: (a) empty DB → all zeros, planDistribution sums to 0, alerts == [], (b) small DB (3 users / 1 PRO active / 2 jobs completed last week) → planDistribution sums to subscription count (SC-006), pulse.mrr.value === PRO priceMonthly, pulse.mau ≥ 1, alerts == [], (c) forced job-success-alert fixture (10 failed jobs / 1 completed in 7 days) → alerts[0].kind === 'job-success' with `successRatePct < 0.90` in new file `tests/integration/api/admin/home/snapshot.test.ts`
- [X] T020 ✅ DONE [P] [US1] Create unit test for `<KpiTile>` rendering all 4 IDs (users | mau | mrr | paying) from fixture: headline value formatted per `unit`, both deltas with correct sign + color tokens, sparkline rendered as Recharts element, tooltip text reachable on hover (MAU tile discloses "Users with ≥1 job this month" per spec FR-011 reviewer note) — uses `renderWithProviders` in new file `tests/unit/components/admin/home/kpi-tile.test.tsx`
- [X] T021 ✅ DONE [P] [US1] Create unit test for `<AlertsStrip>`: (a) component returns `null` and renders NO DOM container when `alerts.length === 0` (FR-004, SC-003 — silence-IS-success), (b) renders cards in fixed order job-success → stripe-webhook → cron when all three present, (c) uses theme/aurora tokens (no `text-[#...]` / `bg-[#...]` hex literals in className) in new file `tests/unit/components/admin/home/alerts-strip.test.tsx`
- [X] T022 ✅ DONE [P] [US1] Create unit test for `<AdminHomeDashboard>` client orchestrator with `renderWithProviders`: (a) on `useAdminHomeSnapshot` query error, page-level error banner with retry button renders (FR-028); (b) clicking retry triggers refetch; (c) subsequent successful poll updates values in place with NO Skeleton in DOM (FR-025); (d) initial render uses `initialData` (no fetch on first paint, SC-001) in new file `tests/unit/components/admin/home/admin-home-dashboard.test.tsx`

### Implementation for User Story 1

- [X] T023 ✅ DONE [P] [US1] Replace `app/lib/admin/home/pulse.ts` stub with real implementation: 4 functions (`computeUsersTile`, `computeMauTile`, `computeMrrTile`, `computePayingTile`) each returning `KpiTile`. Use Prisma aggregations only (FR-033 — no raw SQL). MRR reads `PLANS.PRO.priceMonthly` + `PLANS.TEAM.priceMonthly` from `lib/billing/plans.ts` (FR-012). MAU = `prisma.job.findMany({ where: { createdAt: { gte: startOfMonthUTC } } })` → distinct userIds (FR-011). Each tile computes its 30-element daily sparkline. Compose into `computePulse()` returning `{ users, mau, mrr, paying }`
- [X] T024 ✅ DONE [P] [US1] Replace `app/lib/admin/home/alerts.ts` stub with three detectors composed into `detectAlerts(): Promise<AlertCard[]>`
- [X] T025 ✅ DONE [P] [US1] Implement `POST /api/admin/cron-markers` — research P4 pattern. New file `app/api/admin/cron-markers/route.ts`
- [X] T026 ✅ DONE [P] [US1] Create `<KpiSparkline>` component
- [X] T027 ✅ DONE [P] [US1] Create `<KpiTile>` component
- [X] T028 ✅ DONE [P] [US1] Create `<AlertsStrip>` component
- [X] T029 ✅ DONE [P] [US1] Create `<EmptyState>` shared section-level neutral empty-state primitive
- [X] T030 ✅ DONE [US1] Create `<AdminHomeDashboard>` client orchestrator
- [X] T031 ✅ DONE [US1] Modify `app/admin/page.tsx`: replace redirect with dashboard Server Component
- [X] T032 ✅ DONE [US1] Modify `.github/workflows/nightly-health.yml`: append "Record cron success marker" step
- [X] T033 ✅ DONE [US1] Modify `.github/workflows/nightly-log-prune.yml`: append marker step

**Checkpoint**: `/admin` renders dashboard with 4 KPI tiles + conditional alerts strip; 30s silent polling works; cron markers callback receives writes from both nightly workflows; non-admins get byte-equivalent 404. **MVP shippable.**

---

## Phase 4: User Story 2 — Admin operator inspects business health and trends (Priority: P1)

**Goal**: Add Stratum 3 (plan distribution donut, 30-day activation funnel with chronological cohort, current-month churn panel) and Stratum 4 (signups/day 30d, jobs/day 30d stacked completed+failed, MRR/month 12mo) below the KPI strip.

**Independent Test**: Scroll past the KPI strip. (1) donut slices sum to `Subscription.count()`; (2) funnel shows 4 ordered steps (Signups → 1st project → 1st job → PAID) with count + conversion-from-previous each, denominator equals sum of `signupsPerDay`; (3) churn panel for current calendar month shows cancellations / downgrades / MRR lost / net MRR delta; (4) signups chart has 30 daily points including zeros; (5) jobs chart is stacked completed-bottom / failed-top across 30 days; (6) MRR chart spans 12 months with current month equaling pulse.mrr.value.

### Tests for User Story 2

- [X] T034 ✅ DONE [P] [US2] Create unit test for `business-health.ts`
- [X] T035 ✅ DONE [P] [US2] Create unit test for `trends.ts`
- [X] T036 ✅ DONE [P] [US2] Extend `tests/integration/api/admin/home/snapshot.test.ts` with two additional fixtures
- [X] T037 ✅ DONE [P] [US2] Create unit test for `<ActivationFunnel>` component

### Implementation for User Story 2

- [X] T038 ✅ DONE [P] [US2] Replace `app/lib/admin/home/business-health.ts` stub with real implementation
- [X] T039 ✅ DONE [P] [US2] Replace `app/lib/admin/home/trends.ts` stub with real implementation
- [X] T040 ✅ DONE [P] [US2] Create `<PlanDistributionDonut>` component
- [X] T041 ✅ DONE [P] [US2] Create `<ActivationFunnel>` component
- [X] T042 ✅ DONE [P] [US2] Create `<ChurnPanel>` component
- [X] T043 ✅ DONE [P] [US2] Create `<TrendSignupsChart>` component
- [X] T044 ✅ DONE [P] [US2] Create `<TrendJobsChart>` component
- [X] T045 ✅ DONE [P] [US2] Create `<TrendMrrChart>` component
- [X] T046 ✅ DONE [US2] Wire US2 panels into `admin-home-dashboard.tsx`

**Checkpoint**: Plan distribution, activation funnel, churn panel, and three trend charts render with real DB-backed data. All invariants from SC-004/005/006 hold.

---

## Phase 5: User Story 3 — Admin operator drills into actionable lists (Priority: P2)

**Goal**: Render the bottom 2×2 grid of compact tables: new paying users (30d), recent cancellations (30d), top 5 active users this month, top 5 projects this month. Tables are sorted with deterministic tie-break (SC-008); 30-day tables cap at 25 rows with total badge.

**Independent Test**: Scroll to the actionable section. Confirm each of the 4 tables: (1) "Nouveaux utilisateurs payants" lists subscriptions PAID-activated in last 30 days (email, plan PRO|TEAM, ancienneté days), sorted by activation desc; (2) "Récentes cancellations" lists subscriptions cancelled last 30 days (email, lost plan, ancienneté), sorted by cancellation desc; (3) "Top 5 users" by job count this UTC month with tie-break (last job createdAt desc, then userId asc); (4) "Top 5 projets" same tie-break. Two polls 30s apart produce byte-identical row order for tied rows. 30-day tables show "X au total" badge when total > 25.

### Tests for User Story 3

- [X] T047 ✅ DONE [P] [US3] Create unit test for `actionable.ts`
- [X] T048 ✅ DONE [P] [US3] Create unit test for `<ActionableTable>` component

### Implementation for User Story 3

- [X] T049 ✅ DONE [P] [US3] Replace `app/lib/admin/home/actionable.ts` stub with real implementation
- [X] T050 ✅ DONE [P] [US3] Create generic `<ActionableTable>` primitive
- [X] T051 ✅ DONE [US3] Wire 2×2 actionable grid into `admin-home-dashboard.tsx`

**Checkpoint**: All four actionable tables render with deterministic ordering; 25-row cap + count badge visible on large fixtures; tie-break holds across polls.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story quality checks and conformance to project-wide standards.

- [X] T052 ✅ DONE [P] Hex/rgb color audit: zero matches under `components/admin/home/` and `app/lib/admin/home/`
- [X] T053 ✅ DONE [P] `bun run type-check` passes
- [X] T054 ✅ DONE [P] `bun run lint` passes (no new errors; pre-existing warnings unchanged)
- [X] T055 ✅ DONE Unit tests (`tests/unit/lib/admin/home/`, `tests/unit/components/admin/home/`) all green: 67 tests across 11 files. Integration tests verified locally: 12 tests across 3 files (`parity-404`, `cron-markers/post`, `home/snapshot`) pass against `TEST_MODE=true bun run dev` + Postgres.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → T003 strictly sequential (schema must exist before migration; migration must exist before client regen).
- **Foundational (Phase 2)**: Depends on Setup. T004–T011 can run in parallel after T003. T012 depends on T004 + T007–T011 (composer imports stubs). T013 depends on T012 (route depends on composer). T014 depends on T012 + T013 (route impl + parity-404 test). T015 depends on T004 (hook depends on types).
- **User Stories (Phase 3+)**: All depend on Foundational completing through T015.
  - US1 (P1) → MVP scope.
  - US2 (P1) → after Foundational (independent of US1 implementation, but shares `admin-home-dashboard.tsx`).
  - US3 (P2) → after Foundational (independent of US1/US2 implementation, shares `admin-home-dashboard.tsx`).
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1**: No dependencies on US2 or US3. Replacing the `pulse.ts` and `alerts.ts` stubs unblocks the MVP at `/admin`.
- **US2**: Replaces `business-health.ts` and `trends.ts` stubs; modifies `admin-home-dashboard.tsx` (created in US1 T030). Conflicts only with T030 — execute T046 after T030.
- **US3**: Replaces `actionable.ts` stub; modifies `admin-home-dashboard.tsx` (created in US1). T051 must execute after T030 (and ideally after T046 to avoid merge churn).

### Within Each User Story

- Tests are written BEFORE their corresponding implementation tasks within the same story phase and MUST fail before the implementation is marked complete (constitution §III).
- Aggregator sub-modules (e.g., `pulse.ts`) can be implemented in parallel with UI components since they live in different files.
- The shared `admin-home-dashboard.tsx` is the only file touched across multiple stories — handle as sequential edits in T030 (create) → T046 (US2 sections) → T051 (US3 sections).

### Parallel Opportunities

- All Setup tasks: strictly sequential (T001 → T002 → T003).
- Foundational stub creation (T004–T011): can ALL run in parallel as they are independent new files.
- US1 tests (T016–T022): all parallel (different new files).
- US1 implementation: T023, T024, T025, T026, T027, T028, T029 all parallel; T030 then depends on T026–T029 (assembles them); T031 depends on T030 and T012; T032 / T033 parallel.
- US2 tests (T034–T037): all parallel.
- US2 implementation: T038–T045 all parallel (different new files); T046 sequential after T045 and T030.
- US3 tests (T047, T048): parallel.
- US3 implementation: T049, T050 parallel; T051 sequential after T050 and T046.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 test files in parallel (write first, ensure they fail):
Task: "Create pulse.ts unit tests in tests/unit/lib/admin/home/pulse.test.ts"
Task: "Create alerts.ts unit tests in tests/unit/lib/admin/home/alerts.test.ts"
Task: "Create cron-markers POST integration test in tests/integration/api/admin/cron-markers/post.test.ts"
Task: "Create snapshot integration test (3 fixtures) in tests/integration/api/admin/home/snapshot.test.ts"
Task: "Create KpiTile unit test in tests/unit/components/admin/home/kpi-tile.test.tsx"
Task: "Create AlertsStrip unit test in tests/unit/components/admin/home/alerts-strip.test.tsx"
Task: "Create AdminHomeDashboard unit test in tests/unit/components/admin/home/admin-home-dashboard.test.tsx"

# Launch independent US1 implementation files in parallel:
Task: "Implement pulse.ts real logic"
Task: "Implement alerts.ts real detectors"
Task: "Implement POST /api/admin/cron-markers route"
Task: "Create KpiSparkline component"
Task: "Create KpiTile component"
Task: "Create AlertsStrip component"
Task: "Create EmptyState primitive"

# Then sequentially (depends on prior components existing):
Task: "Create AdminHomeDashboard orchestrator (composes KpiTile/AlertsStrip)"
Task: "Modify app/admin/page.tsx — remove redirect, render <AdminHomeDashboard>"

# Workflow edits in parallel:
Task: "Edit .github/workflows/nightly-health.yml — append marker step"
Task: "Edit .github/workflows/nightly-log-prune.yml — append marker step"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup (DB migration for `CronRunLog`).
2. Complete Phase 2: Foundational (types, formatters, all sub-aggregator stubs, composer, route, hook, parity-404 test).
3. Complete Phase 3: User Story 1 (real pulse + alerts + cron markers + workflow edits + KPI/alerts UI + page wiring).
4. **STOP and VALIDATE**: Visit `/admin` as admin (Stratum 1+2 visible), as non-admin (404), confirm polling cadence + cron-marker writes on next nightly run.
5. Deploy/demo: dashboard is shippable with KPI strip + alerts only; business panels and actionable tables show as empty sections (US2/US3 stubs return zeros — `<EmptyState>` renders neutrally).

### Incremental Delivery

1. **MVP**: Setup + Foundational + US1 → `/admin` shows KPIs + alerts; rest empty.
2. **Business health & trends**: + US2 → Stratum 3+4 fill in; donut, funnel, churn, 3 charts render.
3. **Actionable depth**: + US3 → bottom 2×2 grid of tables.
4. **Polish**: type-check / lint / full test pass.

### Parallel Execution Strategy

Because US2 and US3 only replace stub files and touch one shared component (`admin-home-dashboard.tsx`), they can be implemented in parallel branches if needed — merge conflict surface is limited to T046 vs T051. Recommended order: T030 → T046 → T051 (sequential edits on the orchestrator) with everything else parallelizable.

---

## Notes

- [P] tasks = different files, no incomplete dependencies.
- [Story] label maps task to specific user story for traceability; Setup, Foundational, and Polish phase tasks deliberately have NO story label.
- Each user story is independently completable: replacing its sub-aggregator stub with real logic + adding its UI sections makes the corresponding strata "real" while other strata remain visible (as empty states from stubs).
- Tests use `tests/utils/component-test-utils.tsx::renderWithProviders` and seeded admin/non-admin users per CLAUDE.md test conventions (`[e2e]` prefix not required — these are unit/integration, not E2E).
- No E2E required per plan.md §Testing Strategy (constitution §III rule "Does it REQUIRE a browser? → No").
- Commit after each task or each completed `[P]` parallel group. Verify `bun run type-check` + `bun run lint` pass before each commit (CLAUDE.md commit rules).
- The `runUrl` column on `CronRunLog` is captured per marker write (T025) but is observational — the alert deep link is constructed from `process.env.GITHUB_REPOSITORY` + `workflowName` at render time (T024).
