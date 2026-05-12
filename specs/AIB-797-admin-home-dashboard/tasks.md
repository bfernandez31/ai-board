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

- [ ] T001 Add `CronRunLog` model (fields per data-model.md §Persisted entities: `id`, `workflowName VarChar(100)`, `ranAt DateTime @default(now())`, `durationMs Int?`, `runUrl VarChar(500)?`, `@@index([workflowName, ranAt])`, `@@index([ranAt])`) in `prisma/schema.prisma`
- [ ] T002 Generate Prisma migration `add_cron_run_log` (single `CREATE TABLE` + 2 indexes, no FK, no backfill) by running `bunx prisma migrate dev --name add_cron_run_log` — produces `prisma/migrations/<timestamp>_add_cron_run_log/migration.sql`
- [ ] T003 Regenerate Prisma client by running `bunx prisma generate` (updates `node_modules/.prisma/client` for the new `CronRunLog` model)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type contract, pure helpers, snapshot composer, API route, client hook, page shell — the structural skeleton that all three user stories plug into.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. Sub-aggregator files are created here as stubs that return zero-data shapes, then each story replaces its stub with real logic.

- [ ] T004 [P] Create `DashboardSnapshot` and all sub-DTO TypeScript interfaces (`AlertCard`, `AlertKind`, `KpiTile`, `KpiId`, `Delta`, `PlanDistribution`, `FunnelStep`, `FunnelStepId`, `ChurnPanel`, `DailyPoint`, `JobsDailyPoint`, `MonthlyPoint`, `PaidUserRow`, `CancellationRow`, `TopUserRow`, `TopProjectRow`) per data-model.md §Transient response DTOs in new file `app/lib/admin/home/types.ts`
- [ ] T005 [P] Create unit tests for formatters in new file `tests/unit/lib/admin/home/formatters.test.ts` — cover `formatPriceCents` (1500 → "€15.00"), `formatDelta` (signed `+12` / `−4%`), `formatPercent` ("—" on divide-by-zero per spec edge case), `formatCountWithSpacedThousands`
- [ ] T006 [P] Implement pure formatter helpers `formatPriceCents`, `formatDelta`, `formatPercent`, `formatCountWithSpacedThousands` (NO React imports) in new file `app/lib/admin/home/formatters.ts`
- [ ] T007 [P] Create stub aggregator `computePulse(): Promise<DashboardSnapshot['pulse']>` returning all-zero `KpiTile`s with 30-element zero sparklines in new file `app/lib/admin/home/pulse.ts` (real logic added in US1)
- [ ] T008 [P] Create stub aggregator `detectAlerts(): Promise<AlertCard[]>` returning `[]` plus exported `CRITICAL_CRONS = ['nightly-health', 'nightly-log-prune'] as const` in new file `app/lib/admin/home/alerts.ts` (real detection added in US1)
- [ ] T009 [P] Create stub aggregator `computeBusinessHealth(): Promise<DashboardSnapshot['businessHealth']>` returning zero-valued `PlanDistribution`, 4-step zero-count funnel, zero `ChurnPanel` in new file `app/lib/admin/home/business-health.ts` (real logic added in US2)
- [ ] T010 [P] Create stub aggregator `computeTrends(): Promise<DashboardSnapshot['trends']>` returning 30-day / 30-day / 12-month series filled with zero values + correctly-bucketed dates in new file `app/lib/admin/home/trends.ts` (real logic added in US2)
- [ ] T011 [P] Create stub aggregator `computeActionable(): Promise<{ tables: DashboardSnapshot['actionable']; totals: { newPayingUsersTotal: number; recentCancellationsTotal: number } }>` returning empty rows arrays and zero totals in new file `app/lib/admin/home/actionable.ts` (real logic added in US3)
- [ ] T012 Implement `computeDashboardSnapshot(): Promise<DashboardSnapshot>` that fans out to `computePulse`, `detectAlerts`, `computeBusinessHealth`, `computeTrends`, `computeActionable` via `Promise.all` (per plan §Phase B / research P6: errors propagate, NO partial 200), composes the full `DashboardSnapshot` (sets `generatedAt = new Date().toISOString()`, sorts alerts in fixed order job-success → stripe-webhook → cron(s)-asc-by-workflowName, attaches `meta.{newPayingUsersTotal, recentCancellationsTotal, currencyMinorUnit: 'cents'}`) in new file `app/lib/admin/home/dashboard-snapshot.ts`
- [ ] T013 Create integration test asserting byte-equivalent 404 from `GET /api/admin/home` for non-admin sessions — mirror `tests/integration/api/admin/insights/parity-404.test.ts:30-83` exactly (mock `requireAdminOrNotFound` to reject, assert status + headers + body bytes equal `adminNotFoundResponse()`) in new file `tests/integration/api/admin/home/parity-404.test.ts`
- [ ] T014 Implement `GET /api/admin/home` route handler — apply research P2 pattern exactly: `const auth = await requireAdminOrNotFound(request); if (!auth.ok) return auth.response; const snapshot = await computeDashboardSnapshot(); return NextResponse.json(snapshot)`. Add `export const dynamic = 'force-dynamic'` for `Cache-Control: no-store`. On thrown error from `computeDashboardSnapshot`, return 500 `{ error: 'Failed to compute dashboard snapshot', code: 'SNAPSHOT_FAILED' }`. New file `app/api/admin/home/route.ts`
- [ ] T015 [P] Create TanStack Query hook `useAdminHomeSnapshot(initialData: DashboardSnapshot)` — research P3 pattern: `queryKey: ['admin', 'home', 'snapshot'] as const`, `queryFn` fetches `/api/admin/home`, `refetchInterval: 30_000`, `staleTime: 30_000`, `placeholderData: keepPreviousData`, default `refetchIntervalInBackground: false` (FR-026, SC-011). New file `app/lib/hooks/queries/use-admin-home-snapshot.ts`

**Checkpoint**: `GET /api/admin/home` returns a valid (all-zero) `DashboardSnapshot`; `parity-404.test.ts` passes; client hook compiles. Page still redirects until US1.

---

## Phase 3: User Story 1 — Admin operator gets a 5-second pulse on platform health (Priority: P1) 🎯 MVP

**Goal**: Replace `/admin → /admin/insights` redirect with a dashboard rendering the 4 hero KPI tiles (Users, MAU, MRR estimé, Active payants), the conditional alerts strip (job-success / stripe-webhook / cron-stale), and silent 30s polling with stale-while-revalidate.

**Independent Test**: As an admin, navigate to `/admin`. The page renders inside the admin shell with the "Accueil" sidebar item active, four KPI tiles are visible above the fold on 1366×768 with values+deltas+sparklines, and either no alerts strip (healthy) or a fixed-order alerts strip with action links is visible. After 30s, data refreshes in place with no skeleton flash. Non-admin visit returns byte-equivalent 404.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T016 [P] [US1] Create unit test for `pulse.ts` aggregator covering FR-012 MRR formula (`(active PRO × PLANS.PRO.priceMonthly) + (active TEAM × PLANS.TEAM.priceMonthly)` in cents), FR-011 MAU rule (distinct users with ≥1 `Job` in current UTC calendar month), Users tile Δ7d/Δ30d delta math, exactly-30-element sparkline length invariant, FREE→PAID conversion rate for `paying` tile — against in-memory fixture in new file `tests/unit/lib/admin/home/pulse.test.ts`
- [ ] T017 [P] [US1] Create unit test for `alerts.ts` covering: (a) job-success alert triggers when 7-day completed/(completed+failed+cancelled) < 0.90 with correct `successRatePct` payload, (b) stripe-webhook alert triggers only when paid-transition exists AND no matching `StripeEvent` in 24h, (c) one cron alert per `CRITICAL_CRONS` entry whose latest `CronRunLog.ranAt` > 36h (or no row at all), (d) healthy fixture returns empty array (FR-004, SC-003), (e) fixed order job-success → stripe-webhook → cron(sorted by workflowName) in new file `tests/unit/lib/admin/home/alerts.test.ts`
- [ ] T018 [P] [US1] Create integration test for `POST /api/admin/cron-markers`: (a) missing/invalid Bearer → 401, (b) valid token + valid body (`workflowName: 'nightly-health'`) → 201 with `{ id, ranAt }` + row written, (c) `workflowName` not in `CRITICAL_CRONS` (Zod enum reject) → 400 with `VALIDATION_FAILED`, (d) two consecutive successful writes within 1s produce two rows (append-only contract, FR-007 read side) in new file `tests/integration/api/admin/cron-markers/post.test.ts`
- [ ] T019 [P] [US1] Create integration test for `GET /api/admin/home` snapshot under three fixtures: (a) empty DB → all zeros, planDistribution sums to 0, alerts == [], (b) small DB (3 users / 1 PRO active / 2 jobs completed last week) → planDistribution sums to subscription count (SC-006), pulse.mrr.value === PRO priceMonthly, pulse.mau ≥ 1, alerts == [], (c) forced job-success-alert fixture (10 failed jobs / 1 completed in 7 days) → alerts[0].kind === 'job-success' with `successRatePct < 0.90` in new file `tests/integration/api/admin/home/snapshot.test.ts`
- [ ] T020 [P] [US1] Create unit test for `<KpiTile>` rendering all 4 IDs (users | mau | mrr | paying) from fixture: headline value formatted per `unit`, both deltas with correct sign + color tokens, sparkline rendered as Recharts element, tooltip text reachable on hover (MAU tile discloses "Users with ≥1 job this month" per spec FR-011 reviewer note) — uses `renderWithProviders` in new file `tests/unit/components/admin/home/kpi-tile.test.tsx`
- [ ] T021 [P] [US1] Create unit test for `<AlertsStrip>`: (a) component returns `null` and renders NO DOM container when `alerts.length === 0` (FR-004, SC-003 — silence-IS-success), (b) renders cards in fixed order job-success → stripe-webhook → cron when all three present, (c) uses theme/aurora tokens (no `text-[#...]` / `bg-[#...]` hex literals in className) in new file `tests/unit/components/admin/home/alerts-strip.test.tsx`
- [ ] T022 [P] [US1] Create unit test for `<AdminHomeDashboard>` client orchestrator with `renderWithProviders`: (a) on `useAdminHomeSnapshot` query error, page-level error banner with retry button renders (FR-028); (b) clicking retry triggers refetch; (c) subsequent successful poll updates values in place with NO Skeleton in DOM (FR-025); (d) initial render uses `initialData` (no fetch on first paint, SC-001) in new file `tests/unit/components/admin/home/admin-home-dashboard.test.tsx`

### Implementation for User Story 1

- [ ] T023 [P] [US1] Replace `app/lib/admin/home/pulse.ts` stub with real implementation: 4 functions (`computeUsersTile`, `computeMauTile`, `computeMrrTile`, `computePayingTile`) each returning `KpiTile`. Use Prisma aggregations only (FR-033 — no raw SQL). MRR reads `PLANS.PRO.priceMonthly` + `PLANS.TEAM.priceMonthly` from `lib/billing/plans.ts` (FR-012). MAU = `prisma.job.findMany({ where: { createdAt: { gte: startOfMonthUTC } } })` → distinct userIds (FR-011). Each tile computes its 30-element daily sparkline. Compose into `computePulse()` returning `{ users, mau, mrr, paying }`
- [ ] T024 [P] [US1] Replace `app/lib/admin/home/alerts.ts` stub with three detectors composed into `detectAlerts(): Promise<AlertCard[]>`:
  - `detectJobSuccessAlert` (FR-005): trigger when 7-day completed / (completed + failed + cancelled) < 0.90; payload `{ successRatePct, failedCount, windowDays: 7 }`; `actionHref: '/projects?jobStatus=FAILED&since=7d'`.
  - `detectStripeWebhookAlert` (FR-006): trigger when (≥1 `Subscription` row with `updatedAt` in last 24h that represents a PAID transition) AND (no `StripeEvent` matching types `checkout.session.*`, `customer.subscription.*`, `invoice.payment_*` in last 24h); `actionHref: '/admin/insights'` (placeholder until raw-deliveries view exists).
  - `detectCronStaleAlert` (FR-007): for each entry in `CRITICAL_CRONS`, `prisma.cronRunLog.findFirst({ where: { workflowName }, orderBy: { ranAt: 'desc' } })`; if `null` OR `Date.now() - ranAt.getTime() > 36 * 3_600_000` produce one `AlertCard` with `actionHref: \`https://github.com/${owner}/${repo}/actions/workflows/${workflowName}.yml\`` derived from `process.env.GITHUB_REPOSITORY` (research §Consolidated Decisions). Final ordering: job-success → stripe-webhook → cron sorted by `workflowName` ascending (FR-008) in `app/lib/admin/home/alerts.ts`
- [ ] T025 [P] [US1] Implement `POST /api/admin/cron-markers` — research P4 pattern: `verifyWorkflowToken(request)` → 401 on reject; Zod-validate body with `z.object({ workflowName: z.enum(['nightly-health', 'nightly-log-prune']), durationMs: z.number().int().min(0).max(86_400_000).optional(), runUrl: z.string().url().max(500).optional() })`; on validation failure return 400 `{ error: 'Invalid request body', code: 'VALIDATION_FAILED', details }`; `await prisma.cronRunLog.create({ data })` → 201 `{ id, ranAt }`; fire-and-forget lazy prune wrapped in try/catch: `prisma.cronRunLog.deleteMany({ where: { ranAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } })` (research P5). New file `app/api/admin/cron-markers/route.ts`
- [ ] T026 [P] [US1] Create `<KpiSparkline>` component — Recharts `LineChart` inside `ResponsiveContainer` (height 40px), single `Line` with `stroke="hsl(var(--chart-1))"` (research P8, FR-031), `dot={false}`, no axes/legend/grid, accepts `number[]` of length 30. Reuse pattern from `components/health/sparkline.tsx`. New file `components/admin/home/kpi-sparkline.tsx`
- [ ] T027 [P] [US1] Create `<KpiTile>` component — shadcn `Card` with `aurora-bg-card-{color}` utility (FR-029), renders `label`, formatted `value` (via formatters per `unit`), two `<DeltaBadge>` chips (signed value, theme token color based on sign × `goodDirection`), `<KpiSparkline>`, tooltip on hover containing `tooltip` field. New file `components/admin/home/kpi-tile.tsx`
- [ ] T028 [P] [US1] Create `<AlertsStrip>` component — accepts `alerts: AlertCard[]`; returns `null` when `alerts.length === 0` (FR-004 — NO empty container); otherwise renders a Card with stacked alert rows using existing warning theme tokens (`text-destructive`, `border-destructive/40` or equivalent Aurora utility), each row showing kind-specific copy + action link (`<Button asChild>` with `<a href={actionHref}>` for internal, `<a target="_blank" rel="noreferrer">` for cron alert GitHub URLs). New file `components/admin/home/alerts-strip.tsx`
- [ ] T029 [P] [US1] Create `<EmptyState>` shared section-level neutral empty-state primitive (centered `text-muted-foreground` copy inside a Card) used by every dashboard section per research P7. New file `components/admin/home/empty-state.tsx`
- [ ] T030 [US1] Create `<AdminHomeDashboard>` client orchestrator (`'use client'` at top): accepts `initialData: DashboardSnapshot` prop, calls `useAdminHomeSnapshot(initialData)`. On `query.isError`, renders page-level error banner Card with retry `<Button onClick={() => query.refetch()}>` (FR-028, US1 reviewer note); cached `query.data` from `placeholderData` may remain visible underneath. Composes vertical layout: `<AlertsStrip>` → 4-tile KPI grid (`<KpiTile>` × 4) → placeholder slots for US2/US3 sections. New file `components/admin/home/admin-home-dashboard.tsx`
- [ ] T031 [US1] Modify `app/admin/page.tsx`: remove `redirect('/admin/insights')` line (FR-001); replace with default-exported async Server Component that calls `await computeDashboardSnapshot()` and renders `<AdminHomeDashboard initialData={snapshot} />` (research P1). The page inherits `requireAdminPageOrNotFound` from `app/admin/layout.tsx` (FR-002) — no per-page admin check needed
- [ ] T032 [US1] Modify `.github/workflows/nightly-health.yml`: append final step "Record cron success marker" per `specs/AIB-797-admin-home-dashboard/workflows/cron-marker-callback.md` Phase B (with `WORKFLOW_NAME: nightly-health`, `if: success()`, `continue-on-error: true`, curl POST to `$APP_URL/api/admin/cron-markers` with Bearer `$WORKFLOW_API_TOKEN`)
- [ ] T033 [US1] Modify `.github/workflows/nightly-log-prune.yml`: append the same marker step with `WORKFLOW_NAME: nightly-log-prune` per `specs/AIB-797-admin-home-dashboard/workflows/cron-marker-callback.md` Phase B

**Checkpoint**: `/admin` renders dashboard with 4 KPI tiles + conditional alerts strip; 30s silent polling works; cron markers callback receives writes from both nightly workflows; non-admins get byte-equivalent 404. **MVP shippable.**

---

## Phase 4: User Story 2 — Admin operator inspects business health and trends (Priority: P1)

**Goal**: Add Stratum 3 (plan distribution donut, 30-day activation funnel with chronological cohort, current-month churn panel) and Stratum 4 (signups/day 30d, jobs/day 30d stacked completed+failed, MRR/month 12mo) below the KPI strip.

**Independent Test**: Scroll past the KPI strip. (1) donut slices sum to `Subscription.count()`; (2) funnel shows 4 ordered steps (Signups → 1st project → 1st job → PAID) with count + conversion-from-previous each, denominator equals sum of `signupsPerDay`; (3) churn panel for current calendar month shows cancellations / downgrades / MRR lost / net MRR delta; (4) signups chart has 30 daily points including zeros; (5) jobs chart is stacked completed-bottom / failed-top across 30 days; (6) MRR chart spans 12 months with current month equaling pulse.mrr.value.

### Tests for User Story 2

- [ ] T034 [P] [US2] Create unit test for `business-health.ts` against in-memory fixture: (a) plan distribution counts match input (SC-006 — `free + pro + team === subscription.count()`), (b) funnel **chronological cohort rule** (user paid before creating a project must NOT appear in step 4 — spec auto-resolved decision §Activation funnel reviewer note), (c) funnel step counts monotone non-increasing, (d) `conversionFromPrevious === null` on step 1, (e) zero-cohort → counts all 0, conversion rates `null` (not NaN — spec edge case), (f) churn formula: `mrrLostCents === sum(plan.priceMonthly for each cancelled+downgraded subscription this UTC month)` in new file `tests/unit/lib/admin/home/business-health.test.ts`
- [ ] T035 [P] [US2] Create unit test for `trends.ts` against in-memory fixture: (a) `signupsPerDay.length === 30`, (b) every day in 30-day window present with `value: 0` when no signups (FR-019), (c) sum of `signupsPerDay[*].value` equals funnel signup denominator (SC-005), (d) `jobsPerDay.length === 30` with `completed`/`failed` split (FAILED + CANCELLED → failed, FR-020), (e) `mrrPerMonth.length === 12` oldest-first, (f) date ordering ascending (oldest left, current right) in new file `tests/unit/lib/admin/home/trends.test.ts`
- [ ] T036 [P] [US2] Extend `tests/integration/api/admin/home/snapshot.test.ts` (created in T019) with two additional fixtures: (d) large DB (≥50 users, ≥5 each FREE/PRO/TEAM, ≥30 days of signups) → asserts planDistribution donut invariant, trends array lengths, current-month MRR chart bar equals `pulse.mrr.value` (SC-004 spirit); (e) forced cron-stale fixture (`CronRunLog` row with `ranAt` 48h ago for `nightly-health`) → `alerts` contains a `cron` kind entry with `workflowName: 'nightly-health'`
- [ ] T037 [P] [US2] Create unit test for `<ActivationFunnel>` component: 4 ordered step boxes rendered with count + conversion-rate label; renders "—" (not "NaN%") when cohort denominator is zero (spec edge case); uses `renderWithProviders` in new file `tests/unit/components/admin/home/activation-funnel.test.tsx`

### Implementation for User Story 2

- [ ] T038 [P] [US2] Replace `app/lib/admin/home/business-health.ts` stub with real implementation:
  - `computePlanDistribution`: `prisma.subscription.groupBy({ by: ['plan'], _count: true })` mapped to `{ free, pro, team }`.
  - `computeActivationFunnel` (FR-017): build cohort = `prisma.user.findMany({ where: { createdAt: { gte: thirtyDaysAgoUTC } } })`. For each cohort user, compute earliest qualifying timestamp at each step; ensure step `N` count only includes users who reached step `N-1` *chronologically before* their step `N` event (auto-resolved decision §Activation funnel). Return 4 `FunnelStep` rows with `conversionFromPrevious = step.count / prev.count` (null on step 1).
  - `computeChurn` (FR-018): cancellations = `prisma.subscription.count({ where: { canceledAt: { gte: startOfMonthUTC } } })`; downgrades = subscriptions whose `plan === 'FREE'` and `updatedAt` in month and previously had a paid plan; mrrLostCents = sum of `PLANS[plan].priceMonthly` for the cancelled/downgraded set; netMrrDeltaCents = gained (new paid in month × price) − lost.
- [ ] T039 [P] [US2] Replace `app/lib/admin/home/trends.ts` stub with real implementation:
  - `computeSignupsPerDay`: `prisma.user.findMany({ where: { createdAt: { gte: thirtyDaysAgoUTC } } })` → bucket by UTC day → 30-element `DailyPoint[]` zero-filled.
  - `computeJobsPerDay`: `prisma.job.findMany({ where: { createdAt: { gte: thirtyDaysAgoUTC } }, select: { createdAt: true, status: true } })` → bucket by UTC day → 30-element `JobsDailyPoint[]` with `completed` (status `COMPLETED`) and `failed` (status `FAILED` or `CANCELLED`, per FR-020).
  - `computeMrrPerMonth`: for each of the 12 trailing UTC months, compute `(active PRO at end-of-month × PLANS.PRO.priceMonthly) + (active TEAM at end-of-month × PLANS.TEAM.priceMonthly)` (FR-021 documented limitation: current plan prices applied retroactively). Return 12-element `MonthlyPoint[]` oldest-first; `mrrPerMonth[11].mrrCents === pulse.mrr.value`.
- [ ] T040 [P] [US2] Create `<PlanDistributionDonut>` — Recharts `PieChart` with three slices (FREE / PRO / TEAM), each `fill="hsl(var(--chart-N))"` (research P8), `Legend` showing plan name + absolute count, donut variant with inner radius. Falls back to `<EmptyState>` when `free + pro + team === 0`. New file `components/admin/home/plan-distribution-donut.tsx`
- [ ] T041 [P] [US2] Create `<ActivationFunnel>` — 4 horizontal/vertical step boxes (Card with grid layout), each shows label + absolute count + conversion-rate-from-previous. Render `"—"` for `conversionFromPrevious === null` (step 1) AND when denominator is zero (spec edge case). New file `components/admin/home/activation-funnel.tsx`
- [ ] T042 [P] [US2] Create `<ChurnPanel>` — Card with 4 metric rows: Cancellations (count), Downgrades (count), MRR perdu (formatted via `formatPriceCents`), Net MRR (signed, color-coded with theme tokens — gained > lost is green, lost > gained is red). New file `components/admin/home/churn-panel.tsx`
- [ ] T043 [P] [US2] Create `<TrendSignupsChart>` — Recharts `BarChart` (or `LineChart`) over `DailyPoint[]`, x-axis = UTC date label, y-axis = count, single series `hsl(var(--chart-2))`. Renders `<EmptyState>` when all values are 0. New file `components/admin/home/trend-signups-chart.tsx`
- [ ] T044 [P] [US2] Create `<TrendJobsChart>` — Recharts stacked `BarChart` with two series: `completed` (bottom, `hsl(var(--chart-3))`) and `failed` (top, `hsl(var(--chart-4))`), FR-020. Pattern reference `components/analytics/cost-by-stage-chart.tsx`. New file `components/admin/home/trend-jobs-chart.tsx`
- [ ] T045 [P] [US2] Create `<TrendMrrChart>` — Recharts `BarChart` over `MonthlyPoint[]` (12 months oldest-left), y-axis formatted via `formatPriceCents`, single series `hsl(var(--chart-5))`. New file `components/admin/home/trend-mrr-chart.tsx`
- [ ] T046 [US2] Modify `components/admin/home/admin-home-dashboard.tsx` (from T030) to add the US2 panels into the layout: Business Health row (`<PlanDistributionDonut>` + `<ActivationFunnel>` + `<ChurnPanel>` side-by-side in a grid) below KPI strip, and Trends row (`<TrendSignupsChart>` + `<TrendJobsChart>` + `<TrendMrrChart>`) below that, reading from `snapshot.businessHealth` and `snapshot.trends` respectively

**Checkpoint**: Plan distribution, activation funnel, churn panel, and three trend charts render with real DB-backed data. All invariants from SC-004/005/006 hold.

---

## Phase 5: User Story 3 — Admin operator drills into actionable lists (Priority: P2)

**Goal**: Render the bottom 2×2 grid of compact tables: new paying users (30d), recent cancellations (30d), top 5 active users this month, top 5 projects this month. Tables are sorted with deterministic tie-break (SC-008); 30-day tables cap at 25 rows with total badge.

**Independent Test**: Scroll to the actionable section. Confirm each of the 4 tables: (1) "Nouveaux utilisateurs payants" lists subscriptions PAID-activated in last 30 days (email, plan PRO|TEAM, ancienneté days), sorted by activation desc; (2) "Récentes cancellations" lists subscriptions cancelled last 30 days (email, lost plan, ancienneté), sorted by cancellation desc; (3) "Top 5 users" by job count this UTC month with tie-break (last job createdAt desc, then userId asc); (4) "Top 5 projets" same tie-break. Two polls 30s apart produce byte-identical row order for tied rows. 30-day tables show "X au total" badge when total > 25.

### Tests for User Story 3

- [ ] T047 [P] [US3] Create unit test for `actionable.ts`: (a) `newPayingUsers` sorted by `activatedAt DESC` then `userId ASC`, capped at 25 rows, `totals.newPayingUsersTotal` returns uncapped count; (b) `recentCancellations` sorted by `canceledAt DESC` then `userId ASC`, capped at 25; (c) `topActiveUsers` length ≤ 5, sorted `jobCount DESC` → `lastJobAt DESC` → `userId ASC` (FR-022, SC-008); (d) `topProjects` length ≤ 5, same tie-break with `projectId ASC` tertiary; (e) empty fixture returns empty arrays + zero totals (FR-023) in new file `tests/unit/lib/admin/home/actionable.test.ts`
- [ ] T048 [P] [US3] Create unit test for `<ActionableTable>` component covering tie-break determinism (SC-008 — two adjacent renders of same tied-rows fixture produce identical DOM row order), 25-row cap with "X au total" badge for `total > 25` (FR-024), empty-state row when rows array is empty (FR-023) in new file `tests/unit/components/admin/home/top-tables.test.tsx`

### Implementation for User Story 3

- [ ] T049 [P] [US3] Replace `app/lib/admin/home/actionable.ts` stub with real implementation:
  - `computeNewPayingUsers`: `prisma.subscription.findMany({ where: { plan: { in: ['PRO', 'TEAM'] }, status: { in: ['ACTIVE', 'TRIALING'] }, createdAt: { gte: thirtyDaysAgoUTC } }, include: { user: { select: { id: true, email: true } } }, orderBy: [{ createdAt: 'desc' }, { userId: 'asc' }] })` → map to `PaidUserRow` with `daysSinceActivation`; cap at 25 rows; capture `totals.newPayingUsersTotal` via separate `count()`.
  - `computeRecentCancellations`: `prisma.subscription.findMany({ where: { canceledAt: { gte: thirtyDaysAgoUTC } }, orderBy: [{ canceledAt: 'desc' }, { userId: 'asc' }], include: { user: ... } })` → `CancellationRow[]`; cap at 25; capture `totals.recentCancellationsTotal`.
  - `computeTopActiveUsers`: `prisma.job.groupBy({ by: ['userId'], where: { createdAt: { gte: startOfMonthUTC } }, _count: { id: true }, _max: { createdAt: true }, orderBy: [{ _count: { id: 'desc' } }, { _max: { createdAt: 'desc' } }, { userId: 'asc' }], take: 5 })` → enrich with `user.email` and effective plan via `getEffectivePlan` (research §Existing Files `lib/billing/subscription.ts`).
  - `computeTopProjects`: same shape `groupBy: ['projectId']`, enrich with project key/name and owner email; tertiary tie-break by `projectId ASC`.
  Compose into `computeActionable(): Promise<{ tables, totals }>` returning all four arrays + totals.
- [ ] T050 [P] [US3] Create generic `<ActionableTable>` primitive — accepts `title`, `columns`, `rows` (typed generic), optional `total` for "X au total" badge when `total > rows.length` (FR-024). Renders shadcn `Card` + simple HTML `<table>` (or `<div role="table">` for compactness) with theme tokens for borders. Empty-state row rendered when `rows.length === 0` (FR-023). New file `components/admin/home/actionable-table.tsx`
- [ ] T051 [US3] Modify `components/admin/home/admin-home-dashboard.tsx` (from T030/T046) to add the actionable 2×2 grid as the final section: 4 instances of `<ActionableTable>` configured for `snapshot.actionable.newPayingUsers` (with `snapshot.meta.newPayingUsersTotal`), `snapshot.actionable.recentCancellations` (with `snapshot.meta.recentCancellationsTotal`), `snapshot.actionable.topActiveUsers`, `snapshot.actionable.topProjects` — each with appropriate columns per data-model.md actionable row types

**Checkpoint**: All four actionable tables render with deterministic ordering; 25-row cap + count badge visible on large fixtures; tie-break holds across polls.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story quality checks and conformance to project-wide standards.

- [ ] T052 [P] Audit all new files under `components/admin/home/` and `app/lib/admin/home/` for hardcoded hex/rgb colors (`text-[#...]`, `bg-[#...]`, `style={{ color: '#...' }}`) — must be zero matches per CLAUDE.md and FR-029; replace any with theme tokens or `hsl(var(--chart-N))`
- [ ] T053 [P] Run `bun run type-check` and resolve all TypeScript errors introduced by AIB-797 files (per CLAUDE.md commit rules — fix all errors before commit, even pre-existing)
- [ ] T054 [P] Run `bun run lint` and resolve all ESLint errors introduced by AIB-797 files
- [ ] T055 Run the full new test set (`bun run test:unit tests/unit/lib/admin/home/`, `bun run test:unit tests/unit/components/admin/home/`, `bun run test:integration tests/integration/api/admin/home/`, `bun run test:integration tests/integration/api/admin/cron-markers/`) and confirm all pass

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
