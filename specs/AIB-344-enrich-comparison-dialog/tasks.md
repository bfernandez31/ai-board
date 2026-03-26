# Tasks: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Input**: Design documents from `/specs/AIB-344-enrich-comparison-dialog/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-changes.md, quickstart.md

**Tests**: Included — plan.md testing strategy specifies 10 test cases across unit/component/integration layers.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define new TypeScript types needed by all subsequent phases

- [x] T001 Extend ComparisonParticipantDetail with AggregatedTelemetry interface and qualityDetails field in lib/types/comparison.ts
- [x] T002 [P] Define OperationalMetricDefinition, OperationalMetricRow, OperationalMetricCell, and ComparisonQualityBreakdown interfaces in components/comparison/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend query changes and utility functions that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Modify getComparisonDetailForTicket() to fetch all COMPLETED jobs per ticket, aggregate with aggregateJobTelemetry(), include qualityScoreDetails from latest VERIFY job parsed via parseQualityScoreDetails(), and return aggregatedTelemetry + qualityDetails on each participant in lib/comparison/comparison-detail.ts
- [x] T004 [P] Create buildOperationalMetricRows() with 7 metric definitions (Total Tokens, Input Tokens, Output Tokens, Duration, Cost, Job Count, Quality Score) and determineBestValues() with tie handling in lib/comparison/operational-metrics.ts
- [x] T005 [P] Integration test for aggregated telemetry query verifying sums across multiple completed jobs per ticket in tests/integration/comparison-detail-telemetry.test.ts

**Checkpoint**: Backend enrichment and utility functions ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Compare Operational Efficiency of Two Implementations (Priority: P1) 🎯 MVP

**Goal**: Display a 7-row Operational Metrics grid in the comparison dialog showing aggregated telemetry with best-value highlighting

**Independent Test**: Open a comparison dialog with two tickets that have completed jobs with telemetry data; verify the operational metrics grid displays all 7 metric rows with correct values and "Best value" highlighting

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US1] Unit tests for best-value calculation (lowest/highest direction, ties, null values) and metric formatting (tokens with locale separators, cost as $X.XXXX, duration via formatDurationMs) in tests/unit/operational-metrics.test.ts
- [x] T007 [P] [US1] Component tests for operational metrics grid: renders 7 rows with correct labels, shows formatted values for available data, shows "N/A" for missing telemetry, shows "Pending" for in-progress jobs, displays "Best value" badge on winning cells, renders column headers with ticket key + workflow type + agent in tests/unit/components/comparison-operational-metrics.test.tsx

### Implementation for User Story 1

- [x] T008 [US1] Create ComparisonOperationalMetricsGrid component with Card header, table layout, sticky label column (position: sticky; left: 0), overflow-x-auto container, 7 metric rows using buildOperationalMetricRows(), and Best badge rendering in components/comparison/comparison-operational-metrics.tsx
- [x] T009 [US1] Insert ComparisonOperationalMetricsGrid between ComparisonMetricsGrid and ComparisonDecisionPoints in components/comparison/comparison-viewer.tsx

**Checkpoint**: User Story 1 complete — operational metrics grid visible with best-value highlighting for 2+ tickets

---

## Phase 4: User Story 2 - See Execution Context on Ranking Cards (Priority: P2)

**Goal**: Add workflow type, agent, and quality score badges to each ranking card for at-a-glance context

**Independent Test**: Open a comparison dialog and verify each ranking card displays workflow type badge (always), agent badge (when available), and quality score badge with threshold label (when available)

### Tests for User Story 2

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T010 [P] [US2] Component tests for ranking card badges: workflow type badge always visible, agent badge shown only when agent is non-null, quality score badge with threshold label shown only when quality.state is available, no badge for QUICK ticket without quality score in tests/unit/components/comparison-ranking-badges.test.tsx

### Implementation for User Story 2

- [x] T011 [US2] Add workflow type Badge (always visible), agent Badge (conditional on agent non-null), and quality score Badge with getScoreThreshold() label (conditional on quality.state === 'available') to each participant card in components/comparison/comparison-ranking.tsx

**Checkpoint**: User Story 2 complete — ranking cards show contextual badges

---

## Phase 5: User Story 3 - Inspect Quality Score Breakdown (Priority: P3)

**Goal**: Enable clicking a quality score cell to see a 5-dimension breakdown popover with scores, progress bars, and weights

**Independent Test**: Click a quality score cell for a FULL workflow ticket that passed VERIFY; verify popover shows all 5 dimensions (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync) with scores, progress bars, weights, and overall score with threshold label

### Tests for User Story 3

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T012 [P] [US3] Component tests for quality breakdown popover: renders 5 dimension rows with name/score/progress bar/weight, shows overall score with threshold label in footer, popover disabled (not clickable) when qualityDetails is null, closes on outside click in tests/unit/components/comparison-quality-popover.test.tsx

### Implementation for User Story 3

- [x] T013 [US3] Create ComparisonQualityPopover component using shadcn Popover with PopoverTrigger on quality score cell, 5 dimension rows using Progress component, and footer with overall score + getScoreThreshold() color label in components/comparison/comparison-quality-popover.tsx
- [x] T014 [US3] Wire ComparisonQualityPopover as click trigger on quality score cells in ComparisonOperationalMetricsGrid (only enabled when participant has qualityDetails) in components/comparison/comparison-operational-metrics.tsx

**Checkpoint**: User Story 3 complete — quality breakdown popover available for eligible tickets

---

## Phase 6: User Story 4 - Compare 6 Tickets with Horizontal Scroll (Priority: P4)

**Goal**: Ensure the operational metrics grid remains readable with 6 compared tickets via horizontal scrolling with fixed label column

**Independent Test**: Open a comparison with 6 participants; verify metric labels column stays fixed while data columns scroll horizontally; verify no scrollbar appears for 2 tickets

### Tests for User Story 4

- [x] T015 [US4] Add component test verifying 6-participant grid renders with horizontally scrollable container and fixed metric labels column, and no scrollbar for 2-participant grid in tests/unit/components/comparison-operational-metrics.test.tsx

### Implementation for User Story 4

- [x] T016 [US4] Verify and refine sticky column z-index, background color, and touch scroll behavior for 6 participants on narrow viewports in components/comparison/comparison-operational-metrics.tsx

**Checkpoint**: User Story 4 complete — grid scales to 6 participants with smooth horizontal scroll

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories

- [ ] T017 Run bun run type-check and bun run lint, fix all errors across modified and new files
- [ ] T018 Run quickstart.md validation steps (bun run type-check, bun run lint, bun run test:unit, bun run test)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - US1 (Phase 3): No dependencies on other stories
  - US2 (Phase 4): No dependencies on other stories — can run in parallel with US1
  - US3 (Phase 5): Depends on US1 (quality popover triggers from operational metrics grid cells)
  - US4 (Phase 6): Depends on US1 (tests the grid component created in US1)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent — core grid component
- **US2 (P2)**: Independent — modifies ranking component only
- **US3 (P3)**: Depends on US1 — popover integrates into the grid's quality score cells
- **US4 (P4)**: Depends on US1 — tests and refines the grid's scroll behavior

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Utility functions before components
- Components before integration/wiring
- Story complete before moving to dependent stories

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003, T004, T005 — T004 and T005 can run in parallel with each other (different files), T003 is independent
- T006 and T007 can run in parallel (different test files)
- T010 can run in parallel with US1 implementation (different files)
- US1 and US2 can execute in parallel (no shared files)

---

## Parallel Example: Phases 3 & 4

```bash
# After Phase 2 completes, launch US1 and US2 in parallel:

# Parallel stream A — User Story 1:
Task: T006 "Unit tests for best-value calculation in tests/unit/operational-metrics.test.ts"
Task: T007 "Component tests for operational metrics grid in tests/unit/components/comparison-operational-metrics.test.tsx"
Task: T008 "Create ComparisonOperationalMetricsGrid in components/comparison/comparison-operational-metrics.tsx"
Task: T009 "Wire grid into comparison-viewer.tsx"

# Parallel stream B — User Story 2:
Task: T010 "Component tests for ranking badges in tests/unit/components/comparison-ranking-badges.test.tsx"
Task: T011 "Add badges to comparison-ranking.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (backend query + utilities)
3. Complete Phase 3: User Story 1 (operational metrics grid)
4. **STOP and VALIDATE**: Test grid with 2 tickets, verify 7 rows, best-value highlighting
5. Deploy/demo if ready — users can already compare operational efficiency

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Deploy (MVP — operational metrics grid)
3. Add US2 → Test independently → Deploy (ranking badges)
4. Add US3 → Test independently → Deploy (quality breakdown popover)
5. Add US4 → Test independently → Deploy (6-ticket scroll polish)
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, parallel execution:
   - Parallel task 1: User Story 1 (grid) + User Story 2 (badges)
3. After US1 completes:
   - Parallel task 2: User Story 3 (popover) + User Story 4 (scroll polish)
4. Polish phase after all stories complete
