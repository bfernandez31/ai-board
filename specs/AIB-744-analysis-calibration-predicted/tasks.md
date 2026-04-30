---
description: "Task list for AIB-744 — Analysis Calibration: Predicted vs Actual + Drift Dashboard"
---

# Tasks: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Input**: Design documents from `/specs/AIB-744-analysis-calibration-predicted/`
**Branch**: `AIB-744-analysis-calibration-predicted`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/calibration-api.md`, `workflows/pair-on-outcome.md`

**Tests**: Test tasks INCLUDED (constitution §III). The repo's existing test patterns (`tests/integration/outcomes/`, `tests/integration/analytics/`) are imitated. Pre-existing path mismatch resolved during generation: the plan referenced `tests/integration/ticket-transition.test.ts` (does not exist); the actual existing file owning SHIP→capture resilience is `tests/integration/outcomes/ship-transition-capture-resilience.test.ts` — that file is **extended**, not replaced.

**Organization**: Tasks grouped by user story per spec.md. Within each story, tests precede implementation per constitution §III.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable — different files, no dependencies on incomplete tasks
- **[Story]**: Required for User-Story phase tasks (`[US1]` … `[US6]`); omitted for Setup / Foundational / Polish

## Path Conventions

Single Next.js project (Option 1 per `plan.md` §"Project Structure"). All paths absolute under repository root `/home/runner/work/ai-board/ai-board/target/` (shown as relative).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema change + Prisma client regeneration. Required by every phase that follows.

- [X] ✅ DONE T001 Add `AnalysisCalibration` model (per `data-model.md` §"Prisma model") plus back-pointer relations on `Ticket` (`calibration AnalysisCalibration?`), `Project` (`calibrations AnalysisCalibration[]`), `TicketAnalysis` (`calibration AnalysisCalibration?`), `TicketOutcome` (`calibration AnalysisCalibration?`) in `prisma/schema.prisma`
- [X] ✅ DONE T002 Generate migration `bunx prisma migrate dev --name add_analysis_calibration` — creates `prisma/migrations/<timestamp>_add_analysis_calibration/migration.sql` with the new table, three unique constraints (`ticketId`, `analysisId`, `outcomeId`), three composite indexes (`projectId+shippedAt desc`, `projectId+partial`, `projectId+frictionCell`), four cascade FKs
- [X] ✅ DONE T003 Run `bunx prisma generate` to regenerate the Prisma client; verify `Prisma.AnalysisCalibrationCreateInput` and friends are available to TypeScript

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure types, pure derivation helpers, validated persistence layer. Every user story depends on these.

**⚠️ CRITICAL**: No user-story task can begin until this phase is complete.

- [X] ✅ DONE T004 [P] Create `lib/calibration/types.ts` exporting `CALIBRATION_RULE_SET_VERSION = 1`, `FrictionCell` const tuple + type, `Verdict` const tuple + type, `PartialReason` type union (mirrored from `lib/outcomes/persist.ts` PARTIAL_REASONS — type-only import to avoid drift), `PairedCalibration` interface, `CalibrationDashboardData` interface, `VerdictDistribution` interface (per `contracts/calibration-api.md` §"Response — 200 OK")
- [X] ✅ DONE T005 [P] Create `lib/calibration/derive.ts` exporting pure helpers: `binariseFriction(rating)`, `classifyFrictionCell(predictedClean, actualFree)`, `quantifyQualityVerdict(actual, lower, upper)`, `quantifyCostVerdict(actual, summedLower, summedUpper)`, `computeRecommendationAxes(predictedChoice, actualWorkflowType, frictionFree)`, `sumCostRange({baselineLower, baselineUpper, marginalLower, marginalUpper})` — semantics per `workflows/pair-on-outcome.md` §"Phase 5–8"
- [X] ✅ DONE T006 [P] Create unit tests for all `derive.ts` helpers in `tests/unit/calibration/derive.test.ts` — table-driven tests covering: friction binarisation (low → clean, medium/high → friction); all four confusion cells (TP/TN/FP/FN); quality verdict (n_a when null, hit on inclusive bounds incl. exact-upper edge per spec edge case, miss otherwise); cost verdict (same shape against summed range); recommendation axes (matched + friction-aligned for QUICK/FULL × frictionFree true/false × predicted-vs-actual workflowType — including CLEAN actual edge case from `workflows/pair-on-outcome.md` §"Phase 8")
- [X] ✅ DONE T007 Create `lib/calibration/persist.ts` exporting `persistCalibration(input): Promise<{created: boolean; reason?: 'duplicate'}>` — Zod schema with `superRefine` enforcing all 10 invariants from `data-model.md` §"Validation invariants"; calls `prisma.analysisCalibration.create({ data })` inside try/catch; treats `P2002` as `{created: false, reason: 'duplicate'}` (mirrors `lib/outcomes/persist.ts:24-152` per `research.md` P1)

**Checkpoint**: Foundation ready — user-story implementation can now begin.

---

## Phase 3: User Story 2 — Pairing happens within minutes of SHIP, persisted as immutable snapshot (Priority: P1) 🎯 MVP DATA BACKBONE

**Goal**: Every shipped+analyzed ticket produces exactly one immutable `AnalysisCalibration` row within minutes of SHIP. Re-pairing is a no-op. SHIP and AIB-742 capture remain unaffected by pairing failures.

**Independent Test**: Ship a ticket with one successful analysis end-to-end on `[e2e]` project. Within minutes, query `AnalysisCalibration` for that `ticketId` and confirm exactly one row with all paired fields populated and FK references to the source `TicketAnalysis` and `TicketOutcome`. Re-trigger the pairing path — confirm no duplicate row, no mutation.

### Tests for User Story 2

**RULE (constitution §III)**: Search existing tests FIRST. The capture-resilience pattern lives at `tests/integration/outcomes/ship-transition-capture-resilience.test.ts` — extend it for the calibration-resilience assertion (same domain: SHIP-side fire-and-forget chain unaffected by downstream failures).

- [X] ✅ DONE T008 [P] [US2] Create `tests/integration/calibration/pair-on-outcome.test.ts` — happy path: seed `[e2e]` ticket + `success` analysis with valid `output` matching `AnalysisOutputSchema` + outcome row; call `pairCalibrationOnOutcome({ticketId, projectId})`; assert exactly one calibration row with all paired fields populated (predicted/actual friction, quality range vs actual, cost summed range vs actual, recommendation axes); assert FK references point at the seeded analysis and outcome rows
- [X] ✅ DONE T009 [P] [US2] Create `tests/integration/calibration/immutability.test.ts` — call `pairCalibrationOnOutcome` twice for the same ticket; assert second call returns `{status: 'duplicate'}` (Phase-1 short-circuit) and the row is byte-identical via `toEqual` (FR-005 / SC-002)
- [X] ✅ DONE T010 [P] [US2] Extend `tests/integration/outcomes/ship-transition-capture-resilience.test.ts` with three new `it()` blocks: (a) full SHIP→capture→pair runs end-to-end with all required seeds → calibration row present; (b) SHIP returns 200 even when `pairCalibrationOnOutcome` rejects (vi.spyOn on the calibration module mockRejectedValueOnce); (c) SHIP returns 200 with no calibration row when ticket has no `success` analysis. Assertions mirror the existing capture-resilience block at lines 25–60 of that file

### Implementation for User Story 2

- [X] ✅ DONE T011 [US2] Create `lib/calibration/pair.ts` exporting `pairCalibrationOnOutcome({ticketId, projectId}): Promise<PairResult>` implementing the 9 phases from `workflows/pair-on-outcome.md`: (1) `findUnique` idempotency check; (2) fetch outcome by `ticketId`; (3) fetch latest `success` analysis; (4) parse `analysis.output` via `AnalysisOutputSchema` from `@/lib/analysis/output-schema`; (5–8) call derive helpers from T005; (9) call `persistCalibration` from T007. Logging matches `[calibration] phase=N ticketId=M` format from `lib/outcomes/capture.ts:42-47`
- [X] ✅ DONE T012 [US2] Modify `lib/tickets/transition.ts` lines 355–364: replace the existing `void captureOutcomeOnShip(...)` block with the async-IIFE chain shown verbatim in `workflows/pair-on-outcome.md` §"Trigger surface" — capture first, then `pairCalibrationOnOutcome` only when `captureResult.status === 'created' || 'duplicate'`. Outer try/catch logs `[ship-post-commit] unhandled` per `research.md` P2

**Checkpoint**: Pairing produces immutable calibration rows; SHIP path unaffected. US2 acceptance scenarios 1–4 pass.

---

## Phase 4: User Story 1 — Owner views the drift dashboard with confusion matrix and distributions (Priority: P1) 🎯 HEADLINE MVP

**Goal**: Owner navigates to `/projects/:projectId/calibration` and sees confusion matrix (TP/TN/FP/FN + precision + recall on low-risk class), quality distribution (hit/miss/n_a), cost distribution (hit/miss/n_a), recommendation panel (matched-rate + friction-aligned-rate), all with text labels and tabular fallbacks (WCAG AA). Data refreshes via 15s polling.

**Independent Test**: Seed an `[e2e]` project with ≥30 calibration rows directly via Prisma (mix of friction outcomes, mix of QUICK/FULL workflowType, some `n_a` quality/cost). Authenticate as project owner; navigate to `/projects/:projectId/calibration`; verify the confusion matrix shows non-zero counts in ≥3 of 4 cells, both distribution panels render with three buckets, recommendation panel surfaces both rates, every signal carries a text label or tabular row.

### Tests for User Story 1

- [X] ✅ DONE T013 [P] [US1] Create `tests/integration/calibration/dashboard-window.test.ts` — seed 35 calibration rows on an `[e2e]` project; call `getCalibrationDashboard(projectId)`; assert `windowSize=30`, `totalRows=35`, `warmingUp=false`; seed a fresh project with 5 rows; assert `windowSize=5`, `totalRows=5`, `warmingUp=true` (FR-015)
- [X] ✅ DONE T014 [P] [US1] Create `tests/unit/components/calibration-dashboard.test.tsx` — RTL render with fixture `CalibrationDashboardData`; assert presence of confusion-matrix table, both verdict-distribution panels, recommendation panel; assert "still warming up" indicator renders when `warmingUp=true`; assert tabular fallback for chart elements (FR-018)
- [X] ✅ DONE T015 [P] [US1] Create `tests/unit/components/confusion-matrix-table.test.tsx` — RTL render with fixture confusion-matrix counts; assert `role="table"`; assert TP/TN/FP/FN cells with both count and percentage; assert axis labels `"Predicted: low risk"` and `"Actual: friction-free"`; assert precision and recall computations match input ratios; assert null-safe rendering when total=0

### Implementation for User Story 1

- [X] ✅ DONE T016 [P] [US1] Create `lib/calibration/queries.ts` exporting `getCalibrationDashboard(projectId): Promise<CalibrationDashboardData>` — runs `findMany({where:{projectId},orderBy:{shippedAt:'desc'},take:30})` + `count({where:{projectId}})` in parallel; (adoption query added in US5/T031); composes the two results with `serialize.ts` helpers
- [X] ✅ DONE T017 [P] [US1] Create `lib/calibration/serialize.ts` exporting pure aggregators: `aggregateConfusionMatrix(rows)` (counts + precision + recall, null when denominator=0 per `contracts/calibration-api.md` §"Response"); `aggregateVerdictDistribution(rows, signal)` for quality and cost; `aggregateRecommendation(rows)`; `composeDashboardData({rows, totalRows, adoption, generatedAt})`
- [X] ✅ DONE T018 [P] [US1] Modify `app/lib/query-keys.ts` to add `calibration: { dashboard: (projectId: number) => ['calibration', 'dashboard', projectId] as const }` to the existing `queryKeys` object
- [X] ✅ DONE T019 [P] [US1] Create `app/lib/hooks/queries/useCalibration.ts` exporting `useCalibrationDashboard(projectId, initialData)` using `useQuery` with `queryKey: queryKeys.calibration.dashboard(projectId)`, `queryFn` fetching `/api/projects/${projectId}/calibration`, `refetchInterval: 15000`, `staleTime: 10000`, `initialData` — mirrors `components/analytics/analytics-dashboard.tsx:86-101` (`research.md` P4)
- [X] ✅ DONE T020 [P] [US1] Create `components/calibration/empty-state.tsx` — small Card rendering "Still warming up: X of 30 shipped+analyzed tickets" indicator; renders when `warmingUp=true`
- [X] ✅ DONE T021 [P] [US1] Create `components/calibration/confusion-matrix-table.tsx` — labelled HTML `<table>` with explicit row/column headers (`"Predicted: low risk"`, `"Actual: friction-free"`); 2x2 cells display count + percentage; precision and recall on the low-risk class displayed below the table; uses Tailwind semantic tokens per CLAUDE.md (no hardcoded hex)
- [X] ✅ DONE T022 [P] [US1] Create `components/calibration/verdict-distribution-chart.tsx` — reusable component (used for both quality and cost) rendering Recharts `BarChart` with three bars (`hit`, `miss`, `n_a`) plus a sibling sortable `<table>` fallback; props include `title`, `distribution: VerdictDistribution`, `naTooltip` (string explaining when n_a applies); mirrors `components/analytics/dimension-comparison-chart.tsx` chart-plus-table pattern
- [X] ✅ DONE T023 [P] [US1] Create `components/calibration/recommendation-panel.tsx` — two stat Cards (matched-rate, friction-aligned-rate) with explanatory copy; sortable `<table>` fallback listing both rates and their numerator/denominator counts
- [X] ✅ DONE T024 [US1] Create `components/calibration/calibration-dashboard.tsx` — `'use client'` Client Component; calls `useCalibrationDashboard(projectId, initialData)`; composes `<EmptyState>` (when `warmingUp`), `<ConfusionMatrixTable>`, two `<VerdictDistributionChart>` instances (quality, cost), `<RecommendationPanel>`; "X of N" caption from `windowSize`/`totalRows` (depends on T020-T023)
- [X] ✅ DONE T025 [US1] Create `app/api/projects/[projectId]/calibration/route.ts` — `GET` handler: parse `projectId` (return 400 on `Number.isNaN || <=0`); `verifyProjectOwnership(projectId)`; map `'Project not found'` → 404, `'Unauthorized'` (from `requireAuth`) → 401, all other errors logged with `[calibration-api]` prefix → 500; on success call `getCalibrationDashboard(projectId)` and return via `NextResponse.json(data, {status:200})`. Implementation contract per `contracts/calibration-api.md` §"Implementation contract"
- [X] ✅ DONE T026 [US1] Create `app/projects/[projectId]/calibration/page.tsx` — Server Component: parse `projectId`; call `verifyProjectOwnership(projectId)` inside try/catch; on `'Project not found'` call `notFound()`; on success call `getCalibrationDashboard(projectId)` to seed `initialData`; render `<CalibrationDashboard projectId={projectId} initialData={data} />`. Mirrors `app/projects/[projectId]/analytics/page.tsx`

**Checkpoint**: Owner can view the dashboard at `/projects/:projectId/calibration`. US1 acceptance scenarios 1–4 pass. (Adoption counter still pending — US5.)

---

## Phase 5: User Story 3 — Tickets analyzed multiple times pair only the latest successful analysis (Priority: P2)

**Goal**: When a ticket has multiple `success` analyses, pairing references the most recent one. Older `TicketAnalysis` rows remain unmodified and are not referenced by any calibration row.

**Independent Test**: Seed a ticket with two `success` analyses created at different times plus one `failed` analysis between them. Run the pairing. Assert exactly one calibration row exists, its `analysisId` matches the most recent `success` row, the older `success` row is unchanged, and the `failed` row is ignored.

### Tests for User Story 3

- [ ] T027 [P] [US3] Create `tests/integration/calibration/multi-analysis.test.ts` — three sub-tests: (a) two `success` analyses → calibration references the later one; (b) latest analysis is `failed` while a prior `success` exists → calibration references the prior `success`; (c) older `success` row is unmodified after pairing (`updatedAt` and `output` byte-equal pre/post). Asserts `pair.ts` Phase 3's `orderBy: { createdAt: 'desc' }` clause works (FR-003 / SC-012)

**Checkpoint**: Multi-analysis tickets pair correctly; older analyses untouched.

---

## Phase 6: User Story 4 — Cold-start and partial-outcome tickets are handled honestly (Priority: P2)

**Goal**: Cold-start latest-analysis tickets produce no calibration row but count in adoption. Partial outcomes produce a row with `n_a` verdicts where data is missing and populated verdicts where telemetry survives. Tickets with no `success` analysis produce no row.

**Independent Test**: Seed three tickets on an `[e2e]` project: (a) latest analysis `cold_start`; (b) outcome `partial=true` with `qualityScore=null`, `totalCostUsd=42.5`, `frictionFree=false`, `partialReason='diff_truncated'`; (c) only `failed` analyses. Assert (a) and (c) produce no calibration row; (b) produces a row with `qualityVerdict='n_a'`, `costVerdict='hit'/'miss'`, friction cell populated, `partial=true`, `partialReason='diff_truncated'`.

### Tests for User Story 4

- [ ] T028 [P] [US4] Create `tests/integration/calibration/cold-start.test.ts` — seed ticket whose latest `TicketAnalysis.status='cold_start'`; run pairing; assert no calibration row written; assert the ticket still counts in adoption (verified by querying `getCalibrationDashboard().adoption.analyzed` once US5/T031 lands — until then, assert directly via Prisma that `analysisId` for ticket exists with status `cold_start`)
- [ ] T029 [P] [US4] Create `tests/integration/calibration/partial-outcome.test.ts` — seed ticket + `success` analysis + outcome with `partial=true`, `partialReason='diff_truncated'`, `qualityScore=null`, `totalCostUsd=12.5`, `frictionFree=false`; run pairing; assert calibration row exists with `partial=true`, `partialReason='diff_truncated'`, `qualityVerdict='n_a'`, `costVerdict='hit'|'miss'` per the predicted summed range, `frictionCell ∈ {TN, FN}` per `frictionPredictedClean`/`frictionActualFree=false` (FR-011 / SC-011)
- [ ] T030 [P] [US4] Create `tests/integration/calibration/no-success-analysis.test.ts` — seed ticket with only `failed` and `running` analyses + outcome row; run pairing; assert no calibration row written (FR-004); assert adoption still counts the ticket (verified once T031 lands; until then assert via Prisma)

**Checkpoint**: Degraded-input handling matches spec policy.

---

## Phase 7: User Story 5 — Adoption counter visibility (Priority: P2)

**Goal**: Dashboard shows adoption counter alongside drift metrics: numerator = distinct tickets with ≥1 `TicketAnalysis` of any status; denominator = tickets created on/after `MIN(TicketAnalysis.createdAt)` for the project. Counter is independent of the 30-row drift window.

**Independent Test**: On an `[e2e]` project where the analysis feature has been "available" (≥1 analysis row in some ticket), seed: (a) tickets predating `MIN(analysis.createdAt)` — must be excluded from denominator; (b) tickets created after — must count in denominator; (c) of those, some with ≥1 analysis (any status, including `failed`/`cold_start`) — must count in numerator. Call `getCalibrationDashboard(projectId)`; assert `adoption.analyzed`, `adoption.sinceFeatureAvailable`, `adoption.ratio` match expected counts.

### Tests for User Story 5

- [ ] T031 [P] [US5] Create `tests/integration/calibration/adoption-counter.test.ts` — seed mixed cohort across the feature-availability boundary; assert numerator includes `failed`/`cold_start` analyses, denominator excludes pre-feature tickets, ratio is null when `sinceFeatureAvailable=0` (FR-016 / SC-008)

### Implementation for User Story 5

- [ ] T032 [US5] Extend `lib/calibration/queries.ts` with `computeAdoption(projectId): Promise<{analyzed: number; sinceFeatureAvailable: number; ratio: number | null}>` — runs in parallel: (a) `prisma.ticketAnalysis.aggregate({_min: {createdAt}, where: {projectId}})` to derive feature-availability moment; (b) `findMany` distinct `ticketId`s with ≥1 analysis row of any status (numerator); (c) count distinct tickets with `createdAt >= featureAvailableAt` (denominator). Wire into `getCalibrationDashboard` (research.md D6)
- [ ] T033 [US5] Create `components/calibration/adoption-counter.tsx` — single stat Card showing "X of Y tickets analysed since feature available" + ratio percentage; null-safe when `sinceFeatureAvailable=0` ("No tickets since feature became available")
- [ ] T034 [US5] Modify `components/calibration/calibration-dashboard.tsx` to render `<AdoptionCounter adoption={data.adoption} />` alongside the four drift panels; AdoptionCounter is independent of `warmingUp` (still rendered when drift dataset is empty)

**Checkpoint**: Adoption counter visible on the dashboard; numerator/denominator semantics verified.

---

## Phase 8: User Story 6 — Owner-only access enforced server-side (Priority: P2)

**Goal**: `GET /api/projects/:projectId/calibration` returns 200 to the project owner, 404 (indistinguishable) to project members and non-members. The route is closed to non-owners with no data leakage.

**Independent Test**: Create three users for one `[e2e]` project: owner, member, non-member. Hit the calibration route as each. Assert: owner → 200 with `CalibrationDashboardData`; member → 404 `{ "error": "Not found" }`; non-member → 404 `{ "error": "Not found" }` (byte-identical to member response).

### Tests for User Story 6

- [ ] T035 [P] [US6] Create `tests/integration/calibration/api-calibration.test.ts` — three test cases via `vi.mock('@/lib/db/auth-helpers')` controlling `verifyProjectOwnership` outcome: (1) owner → 200 + payload shape matching `CalibrationDashboardData` interface; (2) member (helper throws `'Project not found'`) → 404 with `{error: 'Not found'}`; (3) non-member (same throw) → response byte-identical to (2); also: (4) unauthenticated (`requireAuth` throws `'Unauthorized'`) → 401 `{error: 'Unauthorized'}`; (5) invalid `projectId` path parameter → 400 (FR-013, SC-007, `contracts/calibration-api.md` §"Authorization")

**Checkpoint**: Owner-only gate verified; no data leak.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Repository-wide validation before tasks.md is closed (per `plan.md` §"Phase 2.7"). No new features.

- [ ] T036 Run `bun run type-check` from repo root — must pass clean (CLAUDE.md commit rule)
- [ ] T037 Run `bun run lint` from repo root — must pass clean (CLAUDE.md commit rule)
- [ ] T038 [P] Run `bun run test:integration -- tests/integration/outcomes` — confirm zero regressions on AIB-742 outcome capture (FR-020, SC-009)
- [ ] T039 [P] Run `bun run test:integration -- tests/integration/analysis` — confirm zero regressions on AIB-743 inbox analysis (FR-020, SC-009)
- [ ] T040 [P] Run `bun run test -- tests/integration/calibration tests/unit/calibration tests/unit/components/calibration-dashboard tests/unit/components/confusion-matrix-table` — full calibration suite green
- [ ] T041 Manual visual pass: `bun run dev`, navigate to `/projects/<id>/calibration` as owner / member / non-member, verify 200 / 404 / 404; verify confusion matrix, both distributions, recommendation panel, adoption counter render with seeded data; verify "still warming up" indicator on a fresh project; verify 15s polling refreshes data (open browser devtools network tab)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 → T002 → T003 sequentially (migration depends on schema; client regen depends on migration)
- **Phase 2 (Foundational)**: Depends on Phase 1. T004/T005 parallel; T006 depends on T005; T007 depends on T004 + T005. **Blocks all user-story phases.**
- **Phase 3 (US2)**: Depends on Phase 2 complete. Tests T008/T009/T010 parallel; T011 depends on T004+T005+T007; T012 depends on T011.
- **Phase 4 (US1)**: Depends on Phase 2 complete. T013–T015 (tests) parallel; T016/T017/T018/T019/T020/T021/T022/T023 parallel; T024 depends on T020–T023; T025 depends on T016+T017; T026 depends on T025+T024. **Independent of Phase 3 implementation** — US1 tests seed calibration rows directly via Prisma, so US1 phase can proceed in parallel with US2 phase once Phase 2 lands.
- **Phase 5 (US3)**: Depends on Phase 3 (T011 must exist for the test to drive `pairCalibrationOnOutcome`).
- **Phase 6 (US4)**: Depends on Phase 3 (same reason). T028/T029/T030 parallel.
- **Phase 7 (US5)**: Depends on Phase 4 (extends `queries.ts` and `calibration-dashboard.tsx`). T031 parallel with T032; T032 depends on T016; T033 parallel; T034 depends on T032+T033.
- **Phase 8 (US6)**: Depends on Phase 4 (T025 route must exist).
- **Phase 9 (Polish)**: Depends on all desired user stories complete.

### User Story Dependencies (within feature)

- **US2 (Pairing)** is a hard runtime precondition for US1's dashboard to display real data; for **task ordering**, US1 and US2 can proceed in parallel since US1 tests use seeded calibration rows.
- **US3 / US4** are correctness rules layered on US2's pair.ts. Bugs surfaced by these tests may require small fixes inside `pair.ts` (T011) — flag as `pair.ts` revisions, not new files.
- **US5** extends US1's `queries.ts`, `serialize.ts`, and `calibration-dashboard.tsx` — three edits on existing files.
- **US6** is a test-only verification of US1's route gate (T025) and authorization (`lib/db/auth-helpers.ts`, unchanged).

### Within Each Story

- Tests precede implementation per constitution §III.
- Pure helpers (derive) before orchestrator (pair).
- Persist before the caller that uses it.
- Queries + serialize before route.
- Sub-components before composing component.
- Composing component before the page that mounts it.

---

## Parallel Opportunities

- **Phase 2 burst**: T004 + T005 + T006 in parallel (3 files, 3 concerns).
- **Phase 3 tests**: T008 + T009 + T010 in parallel (3 separate test files; T010 extends an existing file but the existing file is independent of the new ones).
- **Phase 4 implementation burst** — once foundations land, six implementation files can land in parallel: T016 (`queries.ts`), T017 (`serialize.ts`), T018 (`query-keys.ts`), T019 (`useCalibration.ts`), T020 (`empty-state.tsx`), T021 (`confusion-matrix-table.tsx`), T022 (`verdict-distribution-chart.tsx`), T023 (`recommendation-panel.tsx`). Plus T013 + T014 + T015 (tests) all in parallel.
- **Phases 3 and 4 in parallel**: Two separate agent threads — one drives US2 (T008–T012); the other drives US1 (T013–T026). Joint dependencies are confined to Phase 2 (already done).
- **Phase 6 burst**: T028 + T029 + T030 in parallel (three independent integration test files).
- **Phase 9 burst**: T038 + T039 + T040 in parallel (three independent test runs against different directories).

### Parallel Example: After Phase 2 lands

```bash
# Agent A: Drive US2 to completion
Task: "T008 [US2] Create tests/integration/calibration/pair-on-outcome.test.ts"
Task: "T009 [US2] Create tests/integration/calibration/immutability.test.ts"
Task: "T010 [US2] Extend tests/integration/outcomes/ship-transition-capture-resilience.test.ts"
# (then T011 → T012 sequentially)

# Agent B: Drive US1 to completion in parallel
Task: "T013 [US1] Create tests/integration/calibration/dashboard-window.test.ts"
Task: "T014 [US1] Create tests/unit/components/calibration-dashboard.test.tsx"
Task: "T015 [US1] Create tests/unit/components/confusion-matrix-table.test.tsx"
Task: "T016 [US1] Create lib/calibration/queries.ts"
Task: "T017 [US1] Create lib/calibration/serialize.ts"
Task: "T018 [US1] Modify app/lib/query-keys.ts"
Task: "T019 [US1] Create app/lib/hooks/queries/useCalibration.ts"
Task: "T020 [US1] Create components/calibration/empty-state.tsx"
Task: "T021 [US1] Create components/calibration/confusion-matrix-table.tsx"
Task: "T022 [US1] Create components/calibration/verdict-distribution-chart.tsx"
Task: "T023 [US1] Create components/calibration/recommendation-panel.tsx"
# (then T024 → T025 → T026 sequentially)
```

---

## Implementation Strategy

### MVP (User Story 1 + User Story 2)

Both P1 stories are required for a usable MVP — US2 produces the data, US1 renders it. The order:

1. **Phase 1: Setup** (T001–T003) — schema and Prisma client.
2. **Phase 2: Foundational** (T004–T007) — types, derive, persist (CRITICAL — blocks everything else).
3. **Phase 3: User Story 2** (T008–T012) — pairing live in production. Manual smoke: ship one `[e2e]` ticket, observe calibration row.
4. **Phase 4: User Story 1** (T013–T026) — dashboard live for project owners. Validate via T041's manual visual pass.
5. **STOP and VALIDATE**: SHIP+pair+dashboard end-to-end on `[e2e]` project. Deploy / demo.

### Incremental Delivery (post-MVP)

6. **Phase 5: User Story 3** (T027) — multi-analysis correctness verified.
7. **Phase 6: User Story 4** (T028–T030) — cold-start, partial, no-success-analysis paths verified.
8. **Phase 7: User Story 5** (T031–T034) — adoption counter visible.
9. **Phase 8: User Story 6** (T035) — owner-only gate test in CI.
10. **Phase 9: Polish** (T036–T041) — type-check, lint, full test suites, manual visual pass.

### Parallel Strategy

After Phase 2 lands, US1 and US2 phases can run on separate agent threads with **no shared file edits** until Phase 7's `queries.ts`/`calibration-dashboard.tsx` extensions. Phases 5, 6, 8 are test-only and parallelizable across agents once their respective dependencies (Phase 3 for US3/US4; Phase 4 for US6) land.

---

## Notes

- **[P] tasks** = different files, no dependencies on incomplete tasks.
- **[Story] label** maps task to spec.md user story for traceability.
- **Tests precede implementation** within each user story (constitution §III, NON-NEGOTIABLE).
- **Commit cadence**: One commit per task or logical group. Run `bun run type-check && bun run lint` before each commit (CLAUDE.md).
- **Schema rule**: After T001, run T003 (`bunx prisma generate`) before any code referencing `prisma.analysisCalibration` is written.
- **Avoid**:
  - Creating a parallel `tests/integration/ticket-transition.test.ts` file — the existing `tests/integration/outcomes/ship-transition-capture-resilience.test.ts` covers SHIP-side fire-and-forget resilience and is the right place to extend (T010).
  - Editing `lib/outcomes/capture.ts` or `lib/outcomes/persist.ts` — calibration is a strict downstream consumer (FR-020).
  - Hardcoding hex colors in `components/calibration/*.tsx` — use Tailwind semantic tokens (CLAUDE.md "Colors").
  - Constructing Tailwind class names dynamically (CLAUDE.md "Tailwind Classes").
- **Scope guardrails**:
  - No backfill ships in v1 (research.md D10).
  - No re-pair API endpoint (FR-022).
  - No per-ticket calibration display (FR-021).
  - No new GitHub workflow (research.md D1).
