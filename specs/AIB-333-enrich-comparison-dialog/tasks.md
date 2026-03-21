# Tasks: Enrich Comparison Dialog with Operational Metrics and Quality Data

**Input**: Design documents from `/specs/AIB-333-enrich-comparison-dialog/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — plan.md defines integration and component test strategy.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Type Extensions & Backend Enrichment)

**Purpose**: Extend TypeScript types and backend queries that ALL user stories depend on. No schema changes — read-only query enrichment only.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Extend `ComparisonTelemetryEnrichment` with `totalTokens`, `jobCount`, `hasPartialData` fields in `lib/types/comparison.ts`
- [x] T002 Extend `ComparisonParticipantDetail` with `qualityScoreDetails` and `model` fields in `lib/types/comparison.ts`
- [x] T003 Replace single-job `distinct` query with `prisma.job.groupBy()` aggregation (sum tokens/cost/duration, count jobs) in `lib/comparison/comparison-detail.ts`
- [x] T004 Add primary model resolution query grouping by `[ticketId, model]` ordered by count desc in `lib/comparison/comparison-detail.ts`
- [x] T005 Add `qualityScoreDetails` to verify job select clause in `lib/comparison/comparison-detail.ts`
- [x] T006 Add in-progress job check per ticket for `hasPartialData` flag in `lib/comparison/comparison-detail.ts`
- [x] T007 Update `normalizeTelemetryEnrichment()` to accept aggregated data and compute `totalTokens`, `jobCount`, `hasPartialData` in `lib/comparison/comparison-record.ts`
- [x] T008 Update `normalizeParticipantDetail()` to include `model` and `qualityScoreDetails` in `lib/comparison/comparison-record.ts`

**Checkpoint**: All types and backend enrichment ready — UI tasks can now begin.

---

## Phase 2: User Story 1 — View Execution Context on Ranking Cards (Priority: P1) 🎯 MVP

**Goal**: Display workflow type, agent, and quality score badges on each ranking card for at-a-glance context.

**Independent Test**: Open a comparison dialog with 2+ tickets having different workflow types and quality scores; verify badges render correctly.

### Tests for User Story 1

- [x] T009 [P] [US1] Component test: renders workflow type badge on each card in `tests/unit/components/comparison-ranking-badges.test.tsx`
- [x] T010 [P] [US1] Component test: renders agent badge when agent is present, omits when null in `tests/unit/components/comparison-ranking-badges.test.tsx`
- [x] T011 [P] [US1] Component test: renders quality badge with score and threshold, omits when unavailable in `tests/unit/components/comparison-ranking-badges.test.tsx`

### Implementation for User Story 1

- [x] T012 [US1] Add workflow type badge (`Badge variant="outline"`, color-coded FULL/QUICK/CLEAN) to each participant card in `components/comparison/comparison-ranking.tsx`
- [x] T013 [US1] Add agent badge (`Badge variant="secondary"`) when `agent` is not null in `components/comparison/comparison-ranking.tsx`
- [x] T014 [US1] Add quality score badge with numeric score + threshold label using `getScoreColor()` in `components/comparison/comparison-ranking.tsx`

**Checkpoint**: Ranking cards show workflow type, agent, and quality badges. Story 1 fully testable.

---

## Phase 3: User Story 2 — Compare Operational Metrics Across Tickets (Priority: P1)

**Goal**: Display a comparison table with 7 metric rows (total tokens, input tokens, output tokens, duration, cost, job count, quality), best-value highlighting, and column headers with ticket key + badges. Includes horizontal scroll with sticky labels for up to 6 participants (covers US4 scalability requirements).

**Independent Test**: Create a comparison between tickets with completed jobs; verify the grid renders all 7 metric rows with correct aggregated values and best-value highlighting.

### Tests for User Story 2

- [x] T015 [P] [US2] Component test: renders 7 metric rows with correct labels in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [x] T016 [P] [US2] Component test: displays formatted token values (compact notation) in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [x] T017 [P] [US2] Component test: highlights best value per row (lowest for cost/tokens/duration, highest for quality) in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [x] T018 [P] [US2] Component test: shows "Pending" for pending telemetry and "N/A" for unavailable in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [x] T019 [P] [US2] Component test: renders column headers with ticket key + workflow type badge + agent + model in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [x] T020 [P] [US2] Component test: handles 6 participants without truncation in `tests/unit/components/comparison-operational-metrics.test.tsx`
- [x] T021 [P] [US2] Integration test: returns aggregated telemetry across multiple jobs in `tests/integration/comparisons/comparison-detail-route.test.ts`
- [x] T022 [P] [US2] Integration test: returns totalTokens as computed sum and jobCount per participant in `tests/integration/comparisons/comparison-detail-route.test.ts`
- [x] T023 [P] [US2] Integration test: returns primary model per participant in `tests/integration/comparisons/comparison-detail-route.test.ts`
- [x] T024 [P] [US2] Integration test: marks hasPartialData when jobs in progress in `tests/integration/comparisons/comparison-detail-route.test.ts`
- [x] T025 [P] [US2] Integration test: returns unavailable telemetry when no jobs in `tests/integration/comparisons/comparison-detail-route.test.ts`

### Implementation for User Story 2

- [x] T026 [P] [US2] Add props interface for `ComparisonOperationalMetrics` in `components/comparison/types.ts`
- [x] T027 [US2] Create `ComparisonOperationalMetrics` component with Card layout, table structure, and 7 metric rows in `components/comparison/comparison-operational-metrics.tsx`
- [x] T028 [US2] Implement value formatting: tokens (Intl.NumberFormat compact), duration (ms → human-readable), cost ($X.XX), quality (score + threshold) in `components/comparison/comparison-operational-metrics.tsx`
- [x] T029 [US2] Implement enrichment state handling: `available` → formatted value, `pending` → "Pending" muted, `unavailable` → "N/A" muted in `components/comparison/comparison-operational-metrics.tsx`
- [x] T030 [US2] Implement client-side best-value computation and highlighting (lowest wins: tokens/cost/duration/job count; highest wins: quality; ties highlight all) in `components/comparison/comparison-operational-metrics.tsx`
- [x] T031 [US2] Implement horizontal scroll with `overflow-x-auto` wrapper and CSS sticky `left-0 z-10 bg-card` on metric label column in `components/comparison/comparison-operational-metrics.tsx`
- [x] T032 [US2] Render column headers with ticket key, workflow type badge, agent badge, and model sub-label in `components/comparison/comparison-operational-metrics.tsx`

**Checkpoint**: Operational metrics grid renders all 7 rows with formatting, best-value highlighting, and horizontal scroll for up to 6 participants.

---

## Phase 4: User Story 3 — View Quality Score Breakdown (Priority: P2)

**Goal**: Clickable quality score opens a popover showing 5 dimension scores with progress bars and weights. Only available for FULL workflow tickets that passed VERIFY.

**Independent Test**: Click a quality score for a FULL workflow ticket that passed VERIFY; verify popover shows 5 dimensions with correct scores, weights, and progress bars.

### Tests for User Story 3

- [x] T033 [P] [US3] Component test: opens popover on click showing 5 dimensions with name, score, weight, and progress bar in `tests/unit/components/comparison-quality-popover.test.tsx`
- [x] T034 [P] [US3] Component test: shows overall score with threshold label in `tests/unit/components/comparison-quality-popover.test.tsx`
- [x] T035 [P] [US3] Component test: not clickable for non-FULL workflow tickets in `tests/unit/components/comparison-quality-popover.test.tsx`
- [x] T036 [P] [US3] Component test: closes on Escape key in `tests/unit/components/comparison-quality-popover.test.tsx`
- [x] T037 [P] [US3] Integration test: returns qualityScoreDetails for FULL+VERIFY tickets, null for QUICK tickets in `tests/integration/comparisons/comparison-detail-route.test.ts`

### Implementation for User Story 3

- [x] T038 [P] [US3] Add props interface for `ComparisonQualityPopover` in `components/comparison/types.ts`
- [x] T039 [US3] Create `ComparisonQualityPopover` component with shadcn Popover, overall score + threshold, and 5 dimension rows (name, score, progress bar, weight) in `components/comparison/comparison-quality-popover.tsx`
- [x] T040 [US3] Wire `ComparisonQualityPopover` into quality row of operational metrics grid — clickable for FULL workflow, plain text otherwise in `components/comparison/comparison-operational-metrics.tsx`

**Checkpoint**: Quality score popover works for FULL workflow tickets; non-FULL tickets show plain score.

---

## Phase 5: User Story 5 — Correct Section Ordering (Priority: P3)

**Goal**: Sections appear in logical order: Ranking → Implementation Metrics → Operational Metrics → Decision Points → Compliance Grid.

**Independent Test**: Open any comparison dialog and verify 5 sections appear in the specified order.

- [ ] T041 [US5] Import `ComparisonOperationalMetrics` and insert between `ComparisonMetricsGrid` and `ComparisonDecisionPoints` in `components/comparison/comparison-viewer.tsx`

**Checkpoint**: All sections render in correct order per FR-014.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories.

- [ ] T042 Run `bun run type-check` and fix any type errors across all modified files
- [ ] T043 Run `bun run lint` and fix any lint issues across all modified files
- [ ] T044 Run quickstart.md validation scenarios to verify end-to-end behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **User Story 1 (Phase 2)**: Depends on Phase 1 (types + backend)
- **User Story 2 (Phase 3)**: Depends on Phase 1 (types + backend)
- **User Story 3 (Phase 4)**: Depends on Phase 1 (types + backend) + Phase 3 (grid exists to wire popover into)
- **User Story 5 (Phase 5)**: Depends on Phase 3 (operational metrics component must exist)
- **Polish (Phase 6)**: Depends on all previous phases

### User Story Dependencies

- **US1 (Ranking badges)**: Independent — only needs foundational types
- **US2 (Operational metrics grid)**: Independent — only needs foundational types + backend
- **US3 (Quality popover)**: Depends on US2 — popover wires into the grid's quality row
- **US4 (6-ticket scroll)**: Folded into US2 — grid built with scroll support from the start
- **US5 (Section ordering)**: Depends on US2 — needs the operational metrics component to insert

### Within Each Phase

- Tests written first (TDD — verify they fail)
- Type/interface definitions before implementation
- Core logic before integration/wiring
- Formatting/styling after functional correctness

### Parallel Opportunities

**Phase 1 (Foundational)**:
- T001 + T002 can run in parallel (different type extensions, same file — but sequential since same file)
- T003–T006 sequential (same file, dependent queries)
- T007 + T008 can run in parallel (different functions in same file — sequential since same file)

**Phase 2 + Phase 3 (US1 + US2)**: Can run in parallel after Phase 1 completes
- US1 modifies `comparison-ranking.tsx`
- US2 creates new `comparison-operational-metrics.tsx`
- No file conflicts

**Within US2**:
- All component tests (T015–T020) in parallel
- All integration tests (T021–T025) in parallel
- T026 (types) before T027–T032

**Within US3**:
- All tests (T033–T037) in parallel
- T038 (types) before T039, T039 before T040

---

## Parallel Example: US1 + US2 After Foundational

```bash
# After Phase 1 completes, launch US1 and US2 in parallel:

# Stream 1 — US1 (ranking badges):
Task: T009-T011 (component tests in parallel)
Task: T012-T014 (badge implementation, sequential)

# Stream 2 — US2 (operational metrics grid):
Task: T015-T025 (all tests in parallel)
Task: T026 (props interface)
Task: T027-T032 (grid implementation, sequential)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Foundational types + backend enrichment
2. Complete Phase 2: US1 — Ranking card badges
3. Complete Phase 3: US2 — Operational metrics grid (includes US4 scroll support)
4. **STOP and VALIDATE**: Both P1 stories independently functional
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 (Foundational) → Types and backend ready
2. US1 (Ranking badges) → Immediate visual value in ranking section
3. US2 (Operational metrics grid) → Core new capability with scroll support
4. US3 (Quality popover) → Deeper quality insight for FULL workflow tickets
5. US5 (Section ordering) → Final layout polish
6. Phase 6 (Polish) → Type-check, lint, validation

---

## Notes

- No database schema changes — all data already exists in Job model
- No new API endpoints — extends existing comparison detail response
- No new dependencies — uses existing shadcn/ui (Badge, Popover, Card, Table)
- US4 (6-ticket scroll) is folded into US2 since the grid is built with horizontal scroll from the start
- Best-value computation is client-side per AD-2 (research.md#R6)
- Quality popover reuses `getScoreColor()` and `getScoreThreshold()` from `lib/quality-score`
