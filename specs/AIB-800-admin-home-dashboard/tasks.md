# Tasks: Admin home dashboard with business KPIs and trends

**Input**: Design documents from `/specs/AIB-800-admin-home-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution §III). Search-existing-first applied — see research.md "Existing Files" / "Test files".

**Organization**: Tasks are grouped by user story (US1 P1 → US5 P2 → US2 P2 → US3 P3 → US4 P3) to enable independent implementation and testing. Each phase ends in an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps task to user story (US1, US2, US3, US4, US5)
- Include exact file paths in every task

## Path Conventions

Single Next.js app (App Router) at repository root. Source under `app/`, `components/`, `lib/`, `prisma/`. Tests under `tests/unit/`, `tests/integration/`, `tests/e2e/`. Workflows under `.github/workflows/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the AIB-796 admin shell scaffolding is in place; no new code in this phase.

- [x] T001 Verify the AIB-796 admin shell prerequisites exist: `app/admin/layout.tsx` already calls `requireAdminPageOrNotFound`, `components/admin/admin-shell.tsx` renders the sidebar, and `components/admin/admin-sidebar-items.ts` already registers the `Accueil` entry (`{ id: 'accueil', label: 'Accueil', href: '/admin', icon: Home }`). No code changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, types, registries, and helpers that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Modify `prisma/schema.prisma`: add `WebhookOutcome` model, `CronRun` model, `WebhookOutcomeStatus` enum, `CriticalCron` enum (NIGHTLY_LOG_PRUNE | NIGHTLY_HEALTH_SCANS | BILLING_RECONCILE), plus the indexes specified in data-model.md (`@@index([status, receivedAt])`, `@@index([provider, receivedAt])`, `@unique` on `CronRun.cron`).
- [x] T003 Generate Prisma migration `prisma/migrations/<timestamp>_aib800_admin_home_dashboard/migration.sql` and run `bunx prisma generate` to refresh the client (no seed of `CronRun` rows — first heartbeat upserts).
- [x] T004 [P] Create `lib/admin/cron/registry.ts` exporting `CRITICAL_CRONS = [{ key: CriticalCron.NIGHTLY_LOG_PRUNE, label: 'Nightly log prune', thresholdHours: 36 }, ...]` mirroring the Prisma `CriticalCron` enum.
- [x] T005 [P] Create `lib/admin/home/types.ts` defining `AdminHomeSnapshot` and every sub-type (`Alert`, `PulseTile`, `PlanDistributionRow`, `ActivationFunnel`, `Churn`, `TrendDaily`, `TrendMonthly`, `TableRow`, etc.) per `contracts/admin-home-snapshot.md`.
- [x] T006 [P] Create `lib/admin/home/format.ts` exporting `formatDelta(current, prior)` returning `'—'` when both zero (R-5), an absolute `+N` when prior is zero and current non-zero, and a percentage string otherwise. Include `formatUsdCents` helper using `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.
- [x] T007 [P] Create `lib/admin/webhooks/record-outcome.ts` exporting `recordWebhookOutcome(eventId, eventType, status, errorMessage?)`. Wrap the Prisma insert in its own try/catch that `console.error`s with `{ provider, eventId, eventType }` and swallows so caller errors never propagate (per `workflows/stripe-webhook-outcome-process.md` §Error behavior).
- [x] T008 [P] Create `lib/admin/home/snapshot.ts` skeleton exporting `async function buildSnapshot(): Promise<AdminHomeSnapshot>` that runs aggregators via `Promise.all`, each wrapped in its own try/catch that logs and yields the empty section. Aggregator calls are stubs at this stage — story phases fill them in.

**Checkpoint**: Schema is migrated, types are defined, helpers exist. User stories can now proceed.

---

## Phase 3: User Story 1 - 5-second health glance with KPIs and conditional alerts (Priority: P1) 🎯 MVP

**Goal**: Land on `/admin` and immediately see (a) conditional alert banners and (b) four Pulse KPI tiles populated with real data. Includes wiring `WebhookOutcome` capture and cron heartbeats so the alert detectors have real signal.

**Independent Test**: Sign in as an allowlisted admin, visit `/admin`, observe four Pulse tiles populated (Users / MAU / MRR / Active Paying). Drop the 7-day job success rate below 90% with ≥ 20 jobs, refresh, observe the low-success-rate alert appear with an action link.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation. Search-existing-first applied below.**

- [x] T009 [P] [US1] Create unit tests for alert detectors in `tests/unit/lib/admin/home/alerts.test.ts` covering: low-success-rate fires only when denominator ≥ 20 and ratio < 0.9; Stripe-error fires on any FAILURE in 24 h; stale-cron fires when `lastSuccessAt < now()-36h` OR no row; alerts returned in deterministic order. No existing file covers this domain.
- [x] T010 [P] [US1] Create unit tests for KPI math in `tests/unit/lib/admin/home/kpis.test.ts` covering total users + 7d/30d deltas, MAU (distinct project owners with jobs in 30d) + share-of-base, MRR (sum of PRO+TEAM `priceMonthly` for ACTIVE/TRIALING subs), active-paying + FREE→PAID conversion, and 30-day sparkline length=30 padding for young platforms.
- [x] T011 [P] [US1] Create integration test for `GET /api/admin/home` in `tests/integration/admin/home-snapshot.test.ts` asserting response schema shape, `generatedAt` ISO timestamp, emails returned verbatim, spark arrays length=30, alert array in deterministic order, `Cache-Control: no-store`.
- [x] T012 [P] [US1] Create integration test for `POST /api/maintenance/cron-heartbeat` in `tests/integration/admin/cron-heartbeat.test.ts` covering: missing bearer token → 401; valid token + unknown enum → 400 with `UNKNOWN_CRON` code; valid → 200 with row created on first call; repeated calls advance `lastSuccessAt`; extra body fields rejected by strict Zod.
- [x] T013 [P] [US1] Extend `tests/integration/billing/webhook.test.ts` (existing Stripe webhook integration coverage) with `WebhookOutcome` capture cases: successful delivery → exactly one SUCCESS row; failing handler → exactly one FAILURE row with truncated `errorMessage`; duplicate redelivery → 0 new rows (short-circuited at idempotency claim); `recordWebhookOutcome` itself throwing → response code preserved and `console.error` emitted. Extends rather than duplicating per constitution §III.
- [x] T014 [P] [US1] Create unit tests for `components/admin/home/pulse-tile.tsx` in `tests/unit/components/admin/home/pulse-tile.test.tsx`: empty sparkline renders `text-muted-foreground` placeholder; deltas render `—` when prior is zero; primary value + two deltas + sparkline are all present when data exists.
- [x] T015 [P] [US1] Create unit tests for `components/admin/home/alert-stack.tsx` in `tests/unit/components/admin/home/alert-stack.test.tsx`: zero alerts renders nothing (no empty wrapper); one banner per alert with action link; banner order matches input order.

### Implementation for User Story 1

- [x] T016 [P] [US1] Implement `lib/admin/home/alerts.ts` exporting `computeAlerts(): Promise<Alert[]>` with three detectors (low-success-rate, Stripe webhook errors, stale critical cron) per the canonical conditions in `data-model.md` §Alert detectors. Returns deterministic order: LOW_SUCCESS_RATE → STRIPE_WEBHOOK_ERRORS → STALE_CRITICAL_CRON.
- [x] T017 [P] [US1] Implement `lib/admin/home/kpis.ts` exporting `computePulseKpis(): Promise<PulseSnapshot>` building Users / MAU / MRR / Active Paying tile shapes and their 30-day sparkline series. Reuse `PLANS` from `lib/billing/plans.ts` for MRR price points. Use raw SQL via `prisma.$queryRaw` for the daily sparkline series (Prisma `groupBy` does not support `DATE_TRUNC`).
- [x] T018 [US1] Modify `app/api/webhooks/stripe/route.ts`: after the existing handler `switch` returns, call `recordWebhookOutcome(event.id, event.type, 'SUCCESS')`; inside the existing `catch (error)` block, before the 500 response, call `recordWebhookOutcome(event.id, event.type, 'FAILURE', String(error).slice(0, 1000))`. Preserve the existing idempotency claim ordering (claim first, outcome second).
- [x] T019 [US1] Wire `computeAlerts` and `computePulseKpis` into `lib/admin/home/snapshot.ts` `buildSnapshot()`. Other sections (business / trends / tables) remain stubbed empty for this story.
- [x] T020 [US1] Create `app/api/admin/home/route.ts`: `export async function GET(request: NextRequest)` guarded by `requireAdminOrNotFound` from `app/lib/auth/admin.ts`; calls `buildSnapshot()`; returns JSON with `Cache-Control: no-store`. Wrap aggregation in a top-level try/catch returning `{ error: 'Internal server error' }` 500 on synthesis failures.
- [x] T021 [US1] Create `app/api/maintenance/cron-heartbeat/route.ts`: `export async function POST(request: NextRequest)` with `Authorization: Bearer ${process.env.WORKFLOW_API_TOKEN}` check (401 on mismatch), Zod schema `z.object({ cron: z.nativeEnum(CriticalCron) }).strict()` (400 on invalid), `prisma.cronRun.upsert({ where: { cron }, create: { cron, lastSuccessAt: new Date() }, update: { lastSuccessAt: new Date() } })`, response `{ cron, lastSuccessAt }`.
- [x] T022 [P] [US1] Create `components/admin/home/pulse-tile.tsx` rendering primary value + two deltas + Recharts sparkline. Use `ResponsiveContainer` and `hsl(var(--chart-N))` color tokens only (no hex). Empty array → `text-muted-foreground` placeholder.
- [x] T023 [US1] Create `components/admin/home/pulse-strip.tsx` rendering four `<PulseTile />` instances side by side (Users / MAU / MRR / Active Paying) — receives `pulse: PulseSnapshot` as props.
- [x] T024 [P] [US1] Create `components/admin/home/alert-stack.tsx` rendering 0..N banners with `aurora-*` card utility, banner color tokens (not hex), and contextual `<Link>` to `alert.href`.
- [x] T025 [US1] Create `components/admin/home/admin-home-page.tsx` (`'use client'`): wraps `useQuery({ queryKey: ['admin','home'], queryFn: fetchSnapshot, initialData: props.initialData, refetchInterval: 30_000, staleTime: 25_000, placeholderData: keepPreviousData })`. Renders `<AlertStack />` + `<PulseStrip />`. Business / trends / details areas render placeholder empty regions for this story.
- [x] T026 [US1] Replace `app/admin/page.tsx` (currently `redirect('/admin/insights')`): Server Component calls `requireAdminPageOrNotFound(request)`, calls `buildSnapshot()` for initial data, renders `<AdminHomePage initialData={snapshot} />`.
- [x] T027 [US1] Modify `.github/workflows/nightly-log-prune.yml`: append a final `Cron heartbeat` step that posts `{ cron: 'NIGHTLY_LOG_PRUNE' }` to `${{ vars.APP_URL }}/api/maintenance/cron-heartbeat` with `Authorization: Bearer ${{ secrets.WORKFLOW_API_TOKEN }}` (pattern in `workflows/cron-heartbeat-workflow.md`). Step must fail if HTTP code ≠ 200.
- [x] T028 [US1] Modify `.github/workflows/nightly-health.yml`: append the heartbeat step posting `{ cron: 'NIGHTLY_HEALTH_SCANS' }` after the SCAN dispatch loop succeeds.
- [x] T029 [US1] Create `.github/workflows/billing-reconcile.yml` (stub workflow): cron schedule `0 2 * * *`, runs a no-op `echo "TBD"` functional step, then appends the heartbeat step posting `{ cron: 'BILLING_RECONCILE' }`. Registers the cron so the alert can detect first-deploy staleness (spec edge case "cron just deployed and never ran").

**Checkpoint**: User Story 1 is fully functional. An admin lands on `/admin`, sees four Pulse tiles and any active alerts. Webhook outcomes are captured; cron heartbeats start populating `CronRun`. MVP shippable.

---

## Phase 4: User Story 5 - Auto-refresh and admin gating (Priority: P2)

**Goal**: Validate the platform-wide rules: 30-second auto-refresh without skeleton flash, byte-equivalent 404 for non-admins. These behaviors are implemented in US1 via TanStack Query + `requireAdmin*` guards — this story locks them in with tests.

**Independent Test**: Leave `/admin` open in a tab and observe values update on a 30-second cadence with no global loading skeleton between refreshes. Sign in as a non-admin and GET `/admin` — response is byte-equivalent to a missing route (empty body, `Content-Type: text/html`).

### Tests for User Story 5

- [ ] T030 [P] [US5] Create `tests/integration/api/admin/home/parity-404.test.ts` (sibling of `tests/integration/api/admin/insights/parity-404.test.ts`). Cover: non-admin authenticated GET → 404 empty body `text/html`; unauthenticated GET → identical 404; admin GET with test-override blocked → identical 404. Bytes-for-bytes equivalent.
- [ ] T031 [P] [US5] Extend `tests/integration/admin-shell-isolation.test.ts` (existing) with: admin GET `/admin` renders the dashboard markers (headings/landmarks: `Alertes`, `Pulse`, `Santé Business`, `Tendances`, `Détails actionnables`); non-admin GET `/admin` returns the byte-equivalent 404.
- [ ] T032 [US5] Create `tests/unit/components/admin/home/admin-home-page.test.tsx` asserting no skeleton flash on background refresh: render under `QueryClientProvider`, seed the cache, simulate a refetch in flight via the query client, assert previous Pulse tiles remain mounted with previous values. Also assert the `aria-live="polite"` failed-refresh indicator appears when `useQuery` reports `isError` while still showing stale data.

**Checkpoint**: 404 parity is enforced, refresh-without-flash is asserted at the component layer.

---

## Phase 5: User Story 2 - Business health overview (Priority: P2)

**Goal**: Add the three Santé Business panels (plan donut, 30-day activation funnel, current-month churn).

**Independent Test**: Scroll past the Pulse strip and observe a donut with three plan segments (FREE/PRO/TEAM) + counts, a 4-step funnel with conversion percentages between steps, and a churn panel showing cancellations / downgrades / MRR lost / net MRR delta.

### Tests for User Story 2

- [ ] T033 [P] [US2] Create unit tests for business aggregators in `tests/unit/lib/admin/home/business.test.ts` covering: `computePlanDistribution` returns FREE/PRO/TEAM each with absolute counts (zero-count segments still present); `computeActivationFunnel` 30-day cohort denominator, step counts, `stepRate=null` when prior step is zero; `computeChurn` cancellations/downgrades/mrrLostUsd/netMrrDeltaUsd for current calendar month, including the downgrade approximation documented in data-model.md.
- [ ] T034 [P] [US2] Create unit tests for `components/admin/home/plan-donut.tsx` in `tests/unit/components/admin/home/plan-donut.test.tsx`: 3 segments rendered; zero-count plan still shown in legend per spec edge case; uses `hsl(var(--chart-N))` not hex.
- [ ] T035 [P] [US2] Create unit tests for `components/admin/home/activation-funnel.tsx` in `tests/unit/components/admin/home/activation-funnel.test.tsx`: 4 steps in order (SIGNUP → FIRST_PROJECT → FIRST_JOB → FIRST_PAID); `stepRate=null` renders as `—` not `NaN%`; cohort size of 0 renders empty-state per FR-029.
- [ ] T036 [P] [US2] Create unit tests for `components/admin/home/churn-panel.tsx` in `tests/unit/components/admin/home/churn-panel.test.tsx`: counts/MRR lost/net delta render; net delta shows correct sign; zero cancellations → renders zeros without errors.

### Implementation for User Story 2

- [ ] T037 [US2] Implement `lib/admin/home/business.ts` exporting `computePlanDistribution`, `computeActivationFunnel`, `computeChurn`. Document the downgrade approximation inline (per data-model.md §Subscription: catalog-price comparison via `stripePriceId`). MRR math uses `PLANS` from `lib/billing/plans.ts`.
- [ ] T038 [US2] Wire `computePlanDistribution`, `computeActivationFunnel`, `computeChurn` into `lib/admin/home/snapshot.ts` `buildSnapshot()` so the `business` section of the response is populated.
- [ ] T039 [P] [US2] Create `components/admin/home/plan-donut.tsx`: Recharts `PieChart` + `ResponsiveContainer`, `hsl(var(--chart-1..3))` for FREE/PRO/TEAM, absolute count shown next to each segment.
- [ ] T040 [P] [US2] Create `components/admin/home/activation-funnel.tsx`: 4 stacked rows or stepped bars (SIGNUP → FIRST_PROJECT → FIRST_JOB → FIRST_PAID) with cohort count and inter-step `stepRate` percentage (or `—` when null).
- [ ] T041 [P] [US2] Create `components/admin/home/churn-panel.tsx`: 4-stat block (cancellations / downgrades / `mrrLostUsd` formatted USD / `netMrrDeltaUsd` formatted USD with +/− sign).
- [ ] T042 [US2] Create `components/admin/home/business-row.tsx` composing the three panels in a 3-column responsive grid; integrate into `components/admin/home/admin-home-page.tsx` (replace the empty placeholder).

**Checkpoint**: Business health overview rendering with real data.

---

## Phase 6: User Story 3 - Trend lines over 30 days and 12 months (Priority: P3)

**Goal**: Add the three Tendances charts: signups/day (30d), jobs/day stacked success vs fail (30d), MRR/month (12 months).

**Independent Test**: Scroll to the Tendances row and observe three charts populated with real values across the right windows.

### Tests for User Story 3

- [ ] T043 [P] [US3] Create unit tests for trend aggregators in `tests/unit/lib/admin/home/trends.test.ts` covering: `computeSignupsDaily(30)` returns exactly 30 points oldest-first with `{d, v}` shape (missing days = 0); `computeJobsDaily(30)` returns 30 points with `{d, completed, failed}` shape; `computeMrrMonthly(12)` returns ≤ 12 points with `{m, v}` shape, fewer if the platform is younger.

### Implementation for User Story 3

- [ ] T044 [US3] Implement `lib/admin/home/trends.ts` exporting `computeSignupsDaily(days=30)`, `computeJobsDaily(days=30)`, `computeMrrMonthly(months=12)`. Daily series use raw SQL via `prisma.$queryRaw` (Prisma `groupBy` does not support `DATE_TRUNC`). MRR monthly replays acquisitions/cancellations against the catalog at each month boundary.
- [ ] T045 [US3] Wire the three trend aggregators into `lib/admin/home/snapshot.ts` `buildSnapshot()` so the `trends` section is populated.
- [ ] T046 [P] [US3] Create `components/admin/home/signups-trend.tsx`: Recharts `LineChart` with `ResponsiveContainer`, `hsl(var(--chart-1))` line color, empty-state placeholder when array is all zeros.
- [ ] T047 [P] [US3] Create `components/admin/home/jobs-trend.tsx`: Recharts stacked `BarChart` with two stacks (completed / failed) using `hsl(var(--chart-2))` and `hsl(var(--chart-3))`.
- [ ] T048 [P] [US3] Create `components/admin/home/mrr-trend.tsx`: Recharts `LineChart` (or `AreaChart`) over up to 12 months, USD formatting via `formatUsdCents` from `lib/admin/home/format.ts`.
- [ ] T049 [US3] Create `components/admin/home/trends-row.tsx` composing the three charts in a 3-column responsive grid; integrate into `components/admin/home/admin-home-page.tsx`.

**Checkpoint**: Trend charts rendering 30-day and 12-month windows.

---

## Phase 7: User Story 4 - Actionable detail tables (Priority: P3)

**Goal**: Add the 2×2 grid of detail tables: new paying users, recent cancellations, top users this month, top projects this month.

**Independent Test**: Scroll to the Détails actionnables grid and verify each table renders the correct rows in the correct order (most-recent-first for recency tables; job count descending for top-N tables).

### Tests for User Story 4

- [ ] T050 [P] [US4] Create unit tests for table aggregators in `tests/unit/lib/admin/home/tables.test.ts` covering: `listNewPayingUsers(30, 50)` returns paying users (PRO+TEAM, ACTIVE/TRIALING) with `createdAt >= now()-30d`, ordered most-recent-first, capped at 50; `listRecentCancellations(30, 50)` returns subs with `canceledAt >= now()-30d`, ordered by `canceledAt desc`, capped at 50; `listTopUsersThisMonth(5)` aggregates jobs by `project.userId` (with `ticketId IS NULL` fallback via `Job.projectId`), order desc by count, limit 5; `listTopProjectsThisMonth(5)` groups by `projectId`, order desc by count, limit 5.
- [ ] T051 [P] [US4] Create unit tests for the four table components in `tests/unit/components/admin/home/tables.test.tsx`: empty arrays render `text-muted-foreground` "no data yet" placeholder; rows render expected columns (`email`/`plan`/`accountAgeDays` for new paying; `email`/`lostPlan`/`accountAgeDays` for cancellations; `email`/`plan`/`jobsThisMonth` for top users; `projectKey`/`ownerEmail`/`jobsThisMonth` for top projects); top-N tables enforce max 5 rows.

### Implementation for User Story 4

- [ ] T052 [US4] Implement `lib/admin/home/tables.ts` exporting `listNewPayingUsers`, `listRecentCancellations`, `listTopUsersThisMonth`, `listTopProjectsThisMonth`. Top users use raw SQL via `$queryRaw` (groupBy across relations not supported). Top projects use `prisma.job.groupBy({ by: ['projectId'], ... })` then enrich with project key + owner email.
- [ ] T053 [US4] Wire the four list helpers into `lib/admin/home/snapshot.ts` `buildSnapshot()` so the `tables` section is populated.
- [ ] T054 [P] [US4] Create `components/admin/home/new-paying-table.tsx` rendering email / plan / accountAgeDays columns, most-recent-first.
- [ ] T055 [P] [US4] Create `components/admin/home/cancellations-table.tsx` rendering email / lostPlan / accountAgeDays columns, ordered by `canceledAt desc`.
- [ ] T056 [P] [US4] Create `components/admin/home/top-users-table.tsx` rendering email / plan / jobsThisMonth columns, max 5 rows ordered desc.
- [ ] T057 [P] [US4] Create `components/admin/home/top-projects-table.tsx` rendering projectKey / ownerEmail / jobsThisMonth columns, max 5 rows ordered desc.
- [ ] T058 [US4] Create `components/admin/home/details-grid.tsx` arranging the four tables in a 2×2 responsive grid; integrate into `components/admin/home/admin-home-page.tsx`.

**Checkpoint**: All four detail tables render. Dashboard is feature-complete per spec.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: One golden-path E2E, type/lint hygiene, performance check.

- [ ] T059 [P] Create `tests/e2e/admin/home-dashboard.spec.ts` (Playwright, golden path only): sign in as `[e2e]` admin via `x-test-user-id` header, navigate to `/admin`, assert the four Pulse tile headings are visible, seed a synthetic Stripe `WebhookOutcome` FAILURE row in the last 24 h and assert the Stripe-error alert banner appears on the next 30-second refresh without a global skeleton flash (SC-005).
- [ ] T060 [P] Run `bun run type-check` and `bun run lint` from repo root; fix any reported issues introduced by this feature (including any pre-existing errors uncovered, per CLAUDE.md commit rules).
- [ ] T061 Manual smoke check (recorded in PR description): start dev server, sign in as a seeded admin, load `/admin`, confirm first paint < 3 s (SC-001) and no visible global skeleton during a 30-second refresh cycle (SC-005). Note any deviations.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup (T001)**: No dependencies.
- **Phase 2 Foundational (T002–T008)**: Depends on Phase 1. **BLOCKS all user stories** — schema, types, helpers, snapshot skeleton must exist.
- **Phase 3 US1 (P1, T009–T029)**: Depends on Phase 2. Delivers MVP.
- **Phase 4 US5 (P2, T030–T032)**: Depends on Phase 3 (`/admin` route + polling client must exist to test against).
- **Phase 5 US2 (P2, T033–T042)**: Depends on Phase 2; can run in parallel with Phase 4 and Phase 6/7 once Phase 3 has shipped the page skeleton.
- **Phase 6 US3 (P3, T043–T049)**: Depends on Phase 2; can run in parallel with Phase 5 and Phase 7.
- **Phase 7 US4 (P3, T050–T058)**: Depends on Phase 2; can run in parallel with Phase 5 and Phase 6.
- **Phase 8 Polish (T059–T061)**: Depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: Foundational only. The page wrapper renders placeholder regions for US2/US3/US4 areas, so US1 is independently testable.
- **US5 (P2)**: Builds on US1's polling wrapper and admin gate — tests assert behavior already present in US1. Independently testable.
- **US2 (P2)**: Foundational only. Replaces the business-row placeholder; does not depend on US3/US4.
- **US3 (P3)**: Foundational only. Replaces the trends-row placeholder.
- **US4 (P3)**: Foundational only. Replaces the details-grid placeholder.

### Within Each User Story

- Tests (T009–T015 / T030–T032 / T033–T036 / T043 / T050–T051) MUST be written FIRST and observed FAILING before implementation begins (constitution §III TDD).
- Aggregators (`lib/admin/home/*.ts`) before snapshot wiring before route handler.
- Models / aggregators before components.
- Components before page integration.
- Page integration before E2E.

### Parallel Opportunities

- **Phase 2 Foundational**: T004–T008 are all `[P]` (different files, only depend on T002–T003 schema work).
- **Phase 3 US1 tests** (T009–T015): all `[P]` — separate test files.
- **Phase 3 US1 components**: T022 (pulse-tile) and T024 (alert-stack) are `[P]`; T023 depends on T022, T025 depends on T023+T024.
- **Phase 3 US1 workflows**: T027/T028/T029 touch separate YAML files but build on T021 (heartbeat endpoint must exist).
- **Phase 5/6/7 (US2/US3/US4)** can run as three parallel tracks once Phase 3 ships, since each owns its own sub-row and its own aggregator file.

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 test files together (different files, no dependencies):
Task: "Unit tests for alert detectors in tests/unit/lib/admin/home/alerts.test.ts"
Task: "Unit tests for KPI math in tests/unit/lib/admin/home/kpis.test.ts"
Task: "Integration test for GET /api/admin/home in tests/integration/admin/home-snapshot.test.ts"
Task: "Integration test for POST /api/maintenance/cron-heartbeat in tests/integration/admin/cron-heartbeat.test.ts"
Task: "Extend tests/integration/billing/webhook.test.ts with WebhookOutcome capture cases"
Task: "Unit tests for pulse-tile in tests/unit/components/admin/home/pulse-tile.test.tsx"
Task: "Unit tests for alert-stack in tests/unit/components/admin/home/alert-stack.test.tsx"
```

## Parallel Example: US2/US3/US4 Component Files

```bash
# Once each story's aggregator is wired into the snapshot, sub-components can be built in parallel:
Task: "Create components/admin/home/plan-donut.tsx"
Task: "Create components/admin/home/activation-funnel.tsx"
Task: "Create components/admin/home/churn-panel.tsx"
Task: "Create components/admin/home/signups-trend.tsx"
Task: "Create components/admin/home/jobs-trend.tsx"
Task: "Create components/admin/home/mrr-trend.tsx"
Task: "Create components/admin/home/new-paying-table.tsx"
Task: "Create components/admin/home/cancellations-table.tsx"
Task: "Create components/admin/home/top-users-table.tsx"
Task: "Create components/admin/home/top-projects-table.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup (T001).
2. Complete Phase 2 Foundational (T002–T008) — schema + types + helpers + snapshot skeleton.
3. Complete Phase 3 US1 (T009–T029) — alerts + Pulse + page + webhooks + cron workflows.
4. **STOP and VALIDATE**: An admin can sign in, load `/admin`, see four Pulse tiles, and see any active alerts. Webhook outcomes are being recorded; cron heartbeats are being captured.
5. This is the MVP — ship it.

### Incremental Delivery

1. Phase 1 + Phase 2 → foundation ready.
2. Add Phase 3 (US1) → Test → Ship MVP. Pulse + alerts visible.
3. Add Phase 4 (US5) → Lock in 404 parity + no-flash polling with tests.
4. Add Phase 5 (US2) → Business panels rendered.
5. Add Phase 6 (US3) → Trend charts rendered.
6. Add Phase 7 (US4) → Detail tables rendered.
7. Phase 8 → E2E + polish.

Each story adds a visible row to the page without altering previous rows.

### Parallel Execution Strategy

ai-board can run US2 / US3 / US4 in parallel once US1 (the MVP) is merged:

1. Phases 1–4 complete sequentially (foundation + MVP + parity hardening).
2. Then dispatch three parallel tickets: US2, US3, US4. Each touches its own aggregator file and its own sub-component folder, with the only shared edit being `components/admin/home/admin-home-page.tsx` (one section import per story).
3. Phase 8 polish runs after all three stories merge.

---

## Notes

- `[P]` tasks = different files, no incomplete dependencies.
- `[Story]` label maps task to a specific user story for traceability against spec.md acceptance scenarios.
- Each user story has an independent test gate (the `Checkpoint` line ending each phase).
- All test files use the `[e2e]` prefix on seeded project names, ticket titles, and tokens per CLAUDE.md.
- Search-existing-first was applied: `tests/integration/admin-shell-isolation.test.ts` and `tests/integration/billing/webhook.test.ts` are EXTENDED, not duplicated. All other test files are new because no existing file covers the domain (verified against `tests/integration/admin/`, `tests/integration/api/admin/insights/`, `tests/unit/lib/admin/`, `tests/unit/components/admin/`).
- No `--no-verify` on commits; run `bun run type-check` and `bun run lint` before each commit (CLAUDE.md).
- Run `bunx prisma generate` after T002–T003 so the client picks up the new models/enums.
