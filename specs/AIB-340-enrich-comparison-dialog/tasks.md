# Tasks: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Input**: Design documents from `/specs/AIB-340-enrich-comparison-dialog/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — plan.md testing strategy explicitly defines integration and component tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Type Extensions)

**Purpose**: Extend existing TypeScript interfaces with new fields needed by all user stories

- [x] T001 Extend `ComparisonTelemetryEnrichment` with `totalTokens`, `jobCount`, `primaryModel` fields in `lib/types/comparison.ts`
- [x] T002 Add `qualityBreakdown: ComparisonEnrichmentValue<QualityScoreDetails>` to `ComparisonParticipantDetail` in `lib/types/comparison.ts`
- [x] T003 Add `OperationalMetricsProps` interface and related prop types in `components/comparison/types.ts`

---

## Phase 2: Foundational (Service Layer Aggregation)

**Purpose**: Replace single-job telemetry query with multi-job aggregation — MUST complete before any UI work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add `aggregateJobTelemetry()` helper function that groups jobs by ticketId, sums tokens/cost/duration, counts jobs, and identifies primary model in `lib/comparison/comparison-detail.ts`
- [x] T005 Replace `distinct: ['ticketId']` latest-job query with `findMany` of all COMPLETED jobs per participant in `lib/comparison/comparison-detail.ts`
- [x] T006 Update `normalizeTelemetryEnrichment()` to accept aggregated data and produce `totalTokens`, `jobCount`, `primaryModel` enrichment values in `lib/comparison/comparison-detail.ts`
- [x] T007 Add quality breakdown enrichment: fetch latest verify job's `qualityScoreDetails` JSON, parse as `QualityScoreDetails`, wrap in `ComparisonEnrichmentValue` in `lib/comparison/comparison-detail.ts`
- [x] T008 Write integration test: aggregation sums across multiple completed jobs correctly in `tests/integration/comparisons/comparison-detail-aggregation.test.ts`
- [x] T009 Write integration test: primary model is from highest-token job in `tests/integration/comparisons/comparison-detail-aggregation.test.ts`
- [x] T010 Write integration test: ticket with no completed jobs returns unavailable enrichments in `tests/integration/comparisons/comparison-detail-aggregation.test.ts`
- [x] T011 Write integration test: ticket with in-progress jobs returns pending enrichments in `tests/integration/comparisons/comparison-detail-aggregation.test.ts`
- [x] T012 Write integration test: quality breakdown available only for FULL workflow with completed verify in `tests/integration/comparisons/comparison-detail-aggregation.test.ts`

**Checkpoint**: Service layer returns enriched aggregated telemetry + quality breakdown — all downstream UI work unblocked

---

## Phase 3: User Story 1 — Compare Operational Efficiency of Competing Implementations (Priority: P1) 🎯 MVP

**Goal**: Display an Operational Metrics grid with aggregated telemetry rows, best-value highlighting, and sticky label column for horizontal scroll (covers FR-004 through FR-011, FR-014, FR-015, FR-016)

**Independent Test**: Create a comparison between two tickets with completed jobs, verify the Operational Metrics section renders with correct aggregated values and best-value highlighting

### Tests for User Story 1

- [ ] T013 [P] [US1] Write component test: all 7 metric rows render with correct labels in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [ ] T014 [P] [US1] Write component test: best value badges appear on correct cells (lowest for cost/tokens/duration/jobs, highest for quality) in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [ ] T015 [P] [US1] Write component test: N/A shown for unavailable state, Pending shown for pending state in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [ ] T016 [P] [US1] Write component test: formatting functions produce expected output (tokens with commas, duration as "Xm Ys", cost as "$X.XX") in `tests/unit/components/comparison-operational-metrics.test.tsx`

### Implementation for User Story 1

- [ ] T017 [US1] Create `ComparisonOperationalMetrics` component with sticky first column table, 7 metric rows (Total Tokens, Input Tokens, Output Tokens, Duration, Cost, Job Count, Quality Score), column headers (ticketKey + workflowType + agent), best-value badges, Pending/N/A states, and value formatting in `components/comparison/comparison-operational-metrics.tsx`
- [ ] T018 [US1] Insert `<ComparisonOperationalMetrics>` between `<ComparisonMetricsGrid>` and `<ComparisonDecisionPoints>` in `components/comparison/comparison-viewer.tsx`

**Checkpoint**: Operational Metrics section visible in comparison dialog with correct data, horizontal scroll with sticky labels works for 2–6 tickets

---

## Phase 4: User Story 2 — View Execution Context on Ranking Cards (Priority: P1)

**Goal**: Add workflow type, agent, and quality score badges to each participant's ranking card (covers FR-001, FR-002, FR-003)

**Independent Test**: View a comparison where participants have different workflow types and agents, verify badges appear correctly on ranking cards

### Tests for User Story 2

- [ ] T019 [P] [US2] Write component test: workflow type badges render for FULL/QUICK/CLEAN workflows in `tests/unit/components/comparison-ranking.test.tsx`
- [ ] T020 [P] [US2] Write component test: agent badge hidden when agent is null, shown when present in `tests/unit/components/comparison-ranking.test.tsx`
- [ ] T021 [P] [US2] Write component test: quality badge shows "score label" when available, hidden when unavailable in `tests/unit/components/comparison-ranking.test.tsx`

### Implementation for User Story 2

- [ ] T022 [US2] Add workflow type `<Badge variant="outline">` (always shown), agent `<Badge variant="outline">` (conditional on non-null), and quality `<Badge variant="secondary">` with threshold label (conditional on available state) to each participant card in `components/comparison/comparison-ranking.tsx`

**Checkpoint**: Ranking cards display workflow type, agent, and quality badges with correct conditional visibility

---

## Phase 5: User Story 3 — Drill into Quality Score Breakdown (Priority: P2)

**Goal**: Clicking a quality score in the Operational Metrics grid opens a popover showing 5 quality dimensions with scores, weights, and progress bars (covers FR-012, FR-013)

**Independent Test**: Click a quality score cell for a FULL workflow ticket with quality score details, verify popover shows all 5 dimensions with correct data

### Tests for User Story 3

- [ ] T023 [P] [US3] Write component test: popover opens on click and shows all 5 dimension rows with name, score, weight, and progress bar in `tests/unit/components/comparison-quality-popover.test.tsx`
- [ ] T024 [P] [US3] Write component test: overall score with threshold label displayed at bottom in `tests/unit/components/comparison-quality-popover.test.tsx`
- [ ] T025 [P] [US3] Write component test: quality cell is not clickable when breakdown is unavailable (QUICK workflow) in `tests/unit/components/comparison-quality-popover.test.tsx`
- [ ] T026 [P] [US3] Write component test: popover closes on outside click in `tests/unit/components/comparison-quality-popover.test.tsx`

### Implementation for User Story 3

- [ ] T027 [US3] Create `ComparisonQualityPopover` component using shadcn/ui `Popover` + `PopoverTrigger` + `PopoverContent` with 5 dimension rows (name, score, weight, progress bar proportional to score/100), overall score with threshold label, and conditional clickability based on `qualityBreakdown.state` in `components/comparison/comparison-quality-popover.tsx`
- [ ] T028 [US3] Integrate `ComparisonQualityPopover` as the quality score cell renderer in `ComparisonOperationalMetrics` grid in `components/comparison/comparison-operational-metrics.tsx`

**Checkpoint**: Quality score cells are clickable for eligible tickets, popover displays full breakdown with visual progress bars

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cross-cutting improvements

- [ ] T029 Run `bun run type-check` and fix any TypeScript errors across all modified files
- [ ] T030 Run `bun run lint` and fix any lint errors across all modified files
- [ ] T031 Run quickstart.md validation: `bun run test:unit` and `bun run test:integration` to verify all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types must exist before service code)
- **US1 (Phase 3)**: Depends on Phase 2 (needs aggregated telemetry data)
- **US2 (Phase 4)**: Depends on Phase 2 (needs quality/telemetry enrichments); independent of US1
- **US3 (Phase 5)**: Depends on Phase 3 (popover integrates into operational metrics grid)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — no dependency on other stories
- **User Story 2 (P1)**: Can start after Phase 2 — fully independent of US1
- **User Story 3 (P2)**: Depends on US1 (quality popover is triggered from the operational metrics grid)
- **User Story 4 (P2)**: Horizontal scroll is built into US1's grid component (T017) — no separate phase needed

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Component creation before integration into parent
- Core implementation before cross-component wiring

### Parallel Opportunities

- T001, T002, T003 can run in parallel (different files/interfaces)
- T008–T012 can run in parallel (separate test cases in same file)
- T013–T016 can run in parallel (separate component test cases)
- T019–T021 can run in parallel (separate component test cases)
- T023–T026 can run in parallel (separate component test cases)
- **US1 and US2 can execute in parallel** after Phase 2 completes (different component files)

---

## Parallel Example: User Stories 1 & 2

```bash
# After Phase 2 completes, launch US1 and US2 in parallel:

# Parallel track A (US1):
Task: "Write component tests for operational metrics grid in tests/unit/components/comparison-operational-metrics.test.tsx"
Task: "Create ComparisonOperationalMetrics component in components/comparison/comparison-operational-metrics.tsx"
Task: "Insert into viewer in components/comparison/comparison-viewer.tsx"

# Parallel track B (US2):
Task: "Write component tests for ranking badges in tests/unit/components/comparison-ranking.test.tsx"
Task: "Add badges to ranking cards in components/comparison/comparison-ranking.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (type extensions)
2. Complete Phase 2: Foundational (aggregation service + integration tests)
3. Complete Phase 3: User Story 1 (operational metrics grid with scroll)
4. Complete Phase 4: User Story 2 (ranking card badges) — can run parallel with US1
5. **STOP and VALIDATE**: Both P1 stories independently testable
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Service layer ready
2. Add US1 → Operational metrics visible → Test independently
3. Add US2 → Ranking badges visible → Test independently (parallel with US1)
4. Add US3 → Quality popover functional → Test independently
5. Polish → All checks pass → Ship

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, US1 and US2 can run in parallel:
   - Parallel task 1: User Story 1 (operational metrics grid)
   - Parallel task 2: User Story 2 (ranking card badges)
3. After US1 completes, US3 can start (depends on grid component)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US4 (horizontal scrolling) is inherent to the grid component in US1 — no separate tasks needed
- Quality popover (US3) must wait for the operational metrics grid (US1) since it integrates as the quality cell renderer
- No new database tables or migrations — all changes are TypeScript types + UI + service layer
