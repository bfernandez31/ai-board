# Tasks: Automatic Quality Score via Code Review

**Input**: Design documents from `/specs/AIB-303-automatic-quality-score/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per testing strategy in plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Data Foundation)

**Purpose**: Prisma schema migration and shared quality score utilities

- [x] T001 Add `qualityScore Int?` and `qualityScoreDetails String?` fields to Job model in `prisma/schema.prisma`
- [x] T002 Run Prisma migration (`bunx prisma migrate dev --name add-quality-score-to-job`) and regenerate client (`bunx prisma generate`)
- [x] T003 Create shared quality score utilities (`getScoreThreshold()`, `getScoreColor()`, `parseQualityScoreDetails()`, types) in `lib/quality-score.ts`

---

## Phase 2: Foundational (API & Data Access)

**Purpose**: Extend existing API endpoints to accept and serve quality score data — MUST complete before any user story

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Extend Zod validation schema in `app/lib/job-update-validator.ts` to accept optional `qualityScore` (int 0-100) and `qualityScoreDetails` (string) fields
- [x] T005 Update `PATCH /api/jobs/[id]/status/route.ts` to persist `qualityScore` and `qualityScoreDetails` when status is COMPLETED (silently ignore for other statuses)
- [x] T006 [P] Extend `TicketJobWithTelemetry` interface in `lib/types/job-types.ts` with `qualityScore: number | null` and `qualityScoreDetails: string | null`
- [x] T007 [P] Add `qualityScore` and `qualityScoreDetails` to select clause in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`

**Checkpoint**: API accepts and serves quality score data — user story implementation can begin

---

## Phase 3: User Story 1 - View Quality Score on Ticket Card (Priority: P1) MVP

**Goal**: Display a small colored badge (green/blue/amber/red) on ticket cards showing the quality score from the latest COMPLETED verify job

**Independent Test**: Complete a VERIFY job with a quality score and confirm the badge appears on the ticket card with the correct color threshold

### Tests for User Story 1

- [x] T008 [P] [US1] Component test for `QualityScoreBadge` testing all 4 threshold colors, null score, boundary values (0, 49, 50, 69, 70, 89, 90, 100) in `tests/unit/components/quality-score-badge.test.tsx`

### Implementation for User Story 1

- [x] T009 [US1] Create `QualityScoreBadge` component with colored badge displaying score and threshold color (Excellent=green, Good=blue, Fair=amber, Poor=red) in `components/ticket/quality-score-badge.tsx`
- [x] T010 [US1] Integrate `QualityScoreBadge` into `components/board/ticket-card.tsx` — render badge for tickets with a quality score from the latest COMPLETED verify job; hide for QUICK/CLEAN workflows

**Checkpoint**: Ticket cards show quality score badges with correct threshold colors

---

## Phase 4: User Story 2 - View Quality Score in Ticket Stats Tab (Priority: P1)

**Goal**: Show overall score, threshold label, and breakdown of all 5 dimension scores with weights in the Stats tab

**Independent Test**: Open the Stats tab on a ticket with quality score data and verify all dimension scores and the weighted total are displayed

### Tests for User Story 2

- [x] T011 [P] [US2] Component test for `QualityScoreSection` testing dimension breakdown rendering, latest score selection from multiple verify jobs, null/missing state in `tests/unit/components/quality-score-section.test.tsx`

### Implementation for User Story 2

- [x] T012 [US2] Create `QualityScoreSection` component showing overall score, threshold label (Excellent/Good/Fair/Poor), and 5 dimension sub-scores with weights in `components/ticket/quality-score-section.tsx`
- [x] T013 [US2] Integrate `QualityScoreSection` into `components/ticket/ticket-stats.tsx` — render above existing summary cards, conditional on latest COMPLETED verify job having a quality score

**Checkpoint**: Stats tab shows full quality score breakdown for scored tickets

---

## Phase 5: User Story 3 - Quality Score Computation During VERIFY (Priority: P1)

**Goal**: Extend code review agents to produce dimension scores and compute a weighted final score stored on the verify job

**Independent Test**: Trigger a VERIFY workflow for a FULL ticket and confirm the job record contains the computed quality score

### Tests for User Story 3

- [ ] T014 [P] [US3] Unit test for score computation logic (weighted sum formula, rounding e.g. 83.5->84, threshold derivation, boundary values) in `tests/unit/quality-score.test.ts`
- [ ] T015 [P] [US3] Integration test for PATCH endpoint accepting `qualityScore` on COMPLETED status, rejecting on RUNNING, null for QUICK workflow — extend `tests/integration/jobs/status.test.ts`

### Implementation for User Story 3

- [ ] T016 [US3] Modify `.claude-plugin/commands/ai-board.code-review.md` to add scoring instructions to each of the 5 review agents (return dimension score 0-100 alongside issues)
- [ ] T017 [US3] Add consolidation step to `.claude-plugin/commands/ai-board.code-review.md` that computes weighted final score and writes `quality-score.json` to workspace root
- [ ] T018 [US3] Update `.github/workflows/verify.yml` to read `quality-score.json` after code review step and include `qualityScore` + `qualityScoreDetails` in the COMPLETED status PATCH request; skip for QUICK/CLEAN workflows

**Checkpoint**: VERIFY workflow produces and stores quality scores for FULL workflow tickets

---

## Phase 6: User Story 4 - Quality Score Analytics (Priority: P2)

**Goal**: Team plan users see quality score trend charts and per-dimension comparison on the analytics dashboard

**Independent Test**: Have multiple tickets with quality scores and confirm analytics charts render with correct aggregated data

### Tests for User Story 4

- [ ] T019 [P] [US4] Integration test for analytics endpoint returning quality score aggregations (score trend, dimension comparison, Team plan gating, empty state) in `tests/integration/analytics/quality-score.test.ts`

### Implementation for User Story 4

- [ ] T020 [P] [US4] Add `QualityScoreAnalytics`, `QualityScoreDataPoint`, `DimensionComparison` types to `lib/analytics/types.ts`
- [ ] T021 [US4] Add quality score aggregation queries (score trend by date, dimension comparison AVG, overall average) to `lib/analytics/queries.ts`
- [ ] T022 [US4] Extend analytics API endpoint in `app/api/projects/[projectId]/analytics/route.ts` to include `qualityScore` section in response (Team plan gated)
- [ ] T023 [P] [US4] Create `QualityScoreTrendChart` component (Recharts line chart for score over time) in `components/analytics/quality-score-trend-chart.tsx`
- [ ] T024 [P] [US4] Create `DimensionComparisonChart` component (Recharts bar chart for per-dimension averages) in `components/analytics/dimension-comparison-chart.tsx`
- [ ] T025 [US4] Integrate quality score charts into `components/analytics/analytics-dashboard.tsx` with Team plan gating and empty state handling

**Checkpoint**: Analytics dashboard shows quality score trends and dimension comparisons for Team plan users

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation and final quality checks

- [ ] T026 Run `bun run type-check` and fix any TypeScript errors across all modified files
- [ ] T027 Run `bun run lint` and fix any linting issues across all modified files
- [ ] T028 Run quickstart.md validation to confirm end-to-end implementation matches the quickstart order

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 Card Badge (Phase 3)**: Depends on Phase 2
- **US2 Stats Tab (Phase 4)**: Depends on Phase 2
- **US3 Computation (Phase 5)**: Depends on Phase 2 (T004, T005 specifically)
- **US4 Analytics (Phase 6)**: Depends on Phase 2
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US3 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US4 (P2)**: Can start after Phase 2 — no dependencies on other stories

### Within Each User Story

- Tests written first (should fail before implementation)
- Utilities/types before components
- Components before integration into existing views
- Core implementation before integration

### Parallel Opportunities

- T006 and T007 can run in parallel (different files)
- T008, T011, T014, T015 (all tests) can run in parallel after Phase 2
- T009 and T012 (new components) can run in parallel (different files)
- T020, T023, T024 (analytics types + chart components) can run in parallel
- US1, US2, US3, US4 can all proceed in parallel after Phase 2

---

## Parallel Example: After Phase 2

```bash
# All user stories can launch in parallel:
Story 1: T008 → T009 → T010
Story 2: T011 → T012 → T013
Story 3: T014, T015 (parallel) → T016 → T017 → T018
Story 4: T019, T020 (parallel) → T021 → T022; T023, T024 (parallel) → T025
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3)

1. Complete Phase 1: Setup (schema + utilities)
2. Complete Phase 2: Foundational (API extension)
3. Complete Phase 5: US3 — Computation (produces scores)
4. Complete Phase 3: US1 — Card Badge (displays scores)
5. **STOP and VALIDATE**: Quality scores are computed and visible on ticket cards

### Incremental Delivery

1. Setup + Foundational → Data layer ready
2. Add US3 (Computation) → Scores are generated during VERIFY
3. Add US1 (Card Badge) → Scores visible at a glance (MVP!)
4. Add US2 (Stats Tab) → Detailed breakdown available
5. Add US4 (Analytics) → Team plan trend charts
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Quality scores are immutable (no update/delete)
- QUICK/CLEAN workflows never produce quality scores
- `qualityScoreDetails` is a JSON string (not a JSON column) — parse at application layer
- Tailwind semantic color tokens from data-model.md (emerald/blue/amber/red with dark mode variants)
- Commit after each task or logical group
