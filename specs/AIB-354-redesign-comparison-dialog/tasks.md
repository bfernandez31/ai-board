# Tasks: Redesign Comparison Dialog as Mission Control Dashboard

**Input**: Design documents from `/specs/AIB-354-redesign-comparison-dialog/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓ (no API changes)

**Tests**: Included — plan.md Testing Strategy section specifies component tests for all new components.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the foundational ScoreGauge component and comparison score utility used across multiple user stories

- [x] T001 Create comparison score color helper with `getComparisonScoreColor` function (green >=85, blue 70-84, yellow 50-69, red <50) in `components/comparison/score-gauge.tsx`
- [x] T002 Implement ScoreGauge SVG circular gauge component with `stroke-dasharray`/`stroke-dashoffset` animation, `prefers-reduced-motion` support, and configurable `score`/`size`/`strokeWidth` props in `components/comparison/score-gauge.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update shared types that all new components depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add prop interfaces for all new components (`ComparisonHeroCardProps`, `ComparisonParticipantGridProps`, `ComparisonStatCardsProps`, `ComparisonUnifiedMetricsProps`, `ComparisonComplianceHeatmapProps`) in `components/comparison/types.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Instant Winner Identification (Priority: P1) 🎯 MVP

**Goal**: Hero card at the top prominently displays the winner with score gauge, recommendation, key differentiators, metadata, and stat pills

**Independent Test**: Open any comparison with a known winner and verify the hero card renders with correct winner data, animated gauge, and stat pills

### Tests for User Story 1

- [x] T004 [P] [US1] Write component test for ScoreGauge verifying SVG renders with correct dashoffset, color matches threshold, and reduced-motion skips animation in `tests/unit/components/score-gauge.test.tsx`
- [x] T005 [P] [US1] Write component test for ComparisonHeroCard verifying winner key visible, recommendation text, stat pills show values, metadata text present, and enrichment state handling in `tests/unit/components/comparison-hero-card.test.tsx`

### Implementation for User Story 1

- [x] T006 [US1] Create ComparisonHeroCard component with winner ticket key, ScoreGauge (size ~120px), recommendation summary, key differentiator Badge components, metadata line (generatedAt, sourceTicketKey), and three stat pills (Cost, Duration, Quality Score) with enrichment state handling in `components/comparison/comparison-hero-card.tsx`

**Checkpoint**: Hero card renders with winner data, score gauge, and stat pills

---

## Phase 4: User Story 2 — Visual Participant Scanning (Priority: P1)

**Goal**: Non-winner participants displayed in a responsive horizontal card grid with mini score rings

**Independent Test**: Open a comparison with 3+ participants; verify non-winner cards appear in a grid with correct data and color-coded score rings

### Tests for User Story 2

- [ ] T007 [P] [US2] Write component test for ComparisonParticipantGrid verifying correct number of cards, rank/key/title visible, score ring colors per threshold, and responsive layout in `tests/unit/components/comparison-participant-grid.test.tsx`

### Implementation for User Story 2

- [ ] T008 [US2] Create ComparisonParticipantGrid component with flex-wrap card grid, each card showing rank, ticket key, title, workflowType/agent/quality badges, rationale text, and mini ScoreGauge (size ~40px) with color-coded score rings in `components/comparison/comparison-participant-grid.tsx`

**Checkpoint**: Non-winner participants render in responsive grid with correct badges and score rings

---

## Phase 5: User Story 3 — Key Metrics at a Glance (Priority: P2)

**Goal**: Four stat cards (Cost, Duration, Quality Score, Files Changed) with winner's values and micro-bars showing relative participant positions

**Independent Test**: Open a comparison with 3+ participants with available telemetry; verify stat card values match the winner and micro-bars show relative positions

### Tests for User Story 3

- [ ] T009 [P] [US3] Write component test for ComparisonStatCards verifying 4 stat cards render, winner values shown, micro-bar markers positioned proportionally, and pending/unavailable handling in `tests/unit/components/comparison-stat-cards.test.tsx`

### Implementation for User Story 3

- [ ] T010 [US3] Create ComparisonStatCards component with four Card components in responsive grid (2x2 mobile, 4x1 desktop), winner's value displayed prominently, micro-bars with proportional markers (winner=`bg-primary`, others=`bg-muted-foreground/50`), and enrichment state handling in `components/comparison/comparison-stat-cards.tsx`

**Checkpoint**: Four stat cards render with correct values and micro-bar visualizations

---

## Phase 6: User Story 4 — Unified Metrics Comparison Table (Priority: P2)

**Goal**: Single unified table with 9 metric rows replacing two separate tables, with proportional inline bars and sticky first column

**Independent Test**: Open a comparison and verify all 9 metric rows appear in a single table with proportional bars and sticky first column

### Tests for User Story 4

- [ ] T011 [P] [US4] Write component test for ComparisonUnifiedMetrics verifying 9 metric rows, inline bar widths proportional, best value uses primary color, sticky column, quality popover clickable, and enrichment state handling in `tests/unit/components/comparison-unified-metrics.test.tsx`

### Implementation for User Story 4

- [ ] T012 [US4] Create ComparisonUnifiedMetrics component with single table for all 9 metrics (Lines Changed, Files Changed, Test Files Changed, Total Tokens, Input Tokens, Output Tokens, Duration, Cost, Job Count), proportional inline bars (width=value/max, best=`bg-primary`, others=`bg-muted`), sticky first column (`sticky left-0 z-10 bg-card`), Quality Score cell retaining ComparisonQualityPopover, and enrichment state handling in `components/comparison/comparison-unified-metrics.tsx`

**Checkpoint**: Unified metrics table renders all 9 rows with proportional bars and horizontal scrolling

---

## Phase 7: User Story 5 — Compliance Heatmap (Priority: P3)

**Goal**: Colored heatmap grid replacing the text-based compliance table, with tooltips for assessment notes

**Independent Test**: Open a comparison with compliance data; verify cell colors match statuses and hover tooltips show notes

### Tests for User Story 5

- [ ] T013 [P] [US5] Write component test for ComparisonComplianceHeatmap verifying cell colors match status (green/yellow/red), no text in cells, tooltip shows notes on hover, missing=muted bg, and unavailable state handling in `tests/unit/components/comparison-compliance-heatmap.test.tsx`

### Implementation for User Story 5

- [ ] T014 [US5] Create ComparisonComplianceHeatmap component with principle rows x participant columns grid, cell backgrounds by status (`bg-ctp-green/20` pass, `bg-ctp-yellow/20` mixed, `bg-ctp-red/20` fail, `bg-muted` missing), shadcn Tooltip on hover/tap showing assessment notes, sticky first column, and unavailable state handling in `components/comparison/comparison-compliance-heatmap.tsx`

**Checkpoint**: Compliance heatmap renders colored cells with tooltips

---

## Phase 8: User Story 6 — Decision Point Visual Cues (Priority: P3)

**Goal**: Enhanced decision point accordions with colored verdict dots and ticket key badges

**Independent Test**: Open a comparison with decision points having various verdict states; verify dot colors and accordion behavior

### Tests for User Story 6

- [ ] T015 [P] [US6] Write component test for enhanced ComparisonDecisionPoints verifying verdict dot colors (green=winner match, yellow=other participant, neutral=null), first accordion open, summary visible without expanding, and ticket key badges in approaches in `tests/unit/components/comparison-decision-points.test.tsx`

### Implementation for User Story 6

- [ ] T016 [US6] Enhance ComparisonDecisionPoints by adding `winnerTicketId` prop, verdict dots (`h-2.5 w-2.5 rounded-full`) with color logic (verdictTicketId===winnerTicketId → `bg-ctp-green`, non-null mismatch → `bg-ctp-yellow`, null → `bg-muted-foreground/30`), and wrapping participant approach ticket keys in Badge components in `components/comparison/comparison-decision-points.tsx`

**Checkpoint**: Decision points show colored verdict dots and ticket key badges

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Wire all new components into the viewer, remove deprecated components, and validate

- [ ] T017 Update ComparisonViewer to compute winner/nonWinners from participants, replace old component tree with ComparisonHeroCard → ComparisonParticipantGrid → ComparisonStatCards → ComparisonUnifiedMetrics → ComparisonDecisionPoints (with winnerTicketId) → ComparisonComplianceHeatmap, remove standalone metadata block and old component imports in `components/comparison/comparison-viewer.tsx`
- [ ] T018 Delete deprecated components: `components/comparison/comparison-ranking.tsx`, `components/comparison/comparison-metrics-grid.tsx`, `components/comparison/comparison-operational-metrics.tsx`, `components/comparison/comparison-compliance-grid.tsx` after verifying no other imports reference them
- [ ] T019 Run `bun run type-check` and `bun run lint` to verify no type errors or lint violations across all changed files
- [ ] T020 Run quickstart.md validation — verify all components render correctly with test data

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–8)**: All depend on Foundational phase completion
  - US1 and US2 (both P1) can proceed in parallel
  - US3 and US4 (both P2) can proceed in parallel after foundational
  - US5 and US6 (both P3) can proceed in parallel after foundational
- **Polish (Phase 9)**: Depends on ALL user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 2 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 3 (P2)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 4 (P2)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 5 (P3)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 6 (P3)**: Can start after Phase 2 — No dependencies on other stories

### Within Each User Story

- Tests written FIRST (they should FAIL before implementation)
- Implementation follows test structure
- Story complete before integration in Phase 9

### Parallel Opportunities

- T001 and T002 are sequential (T002 depends on T001's color helper)
- T004 + T005 can run in parallel (different test files)
- T007, T009, T011, T013, T015 can ALL run in parallel (all test files, independent)
- T006, T008 can run in parallel (different component files)
- T010, T012 can run in parallel (different component files)
- T014, T016 can run in parallel (different component files)

---

## Parallel Example: All User Story Tests

```bash
# Launch all component tests in parallel (all independent files):
Task T004: "ScoreGauge test in tests/unit/components/score-gauge.test.tsx"
Task T005: "ComparisonHeroCard test in tests/unit/components/comparison-hero-card.test.tsx"
Task T007: "ComparisonParticipantGrid test in tests/unit/components/comparison-participant-grid.test.tsx"
Task T009: "ComparisonStatCards test in tests/unit/components/comparison-stat-cards.test.tsx"
Task T011: "ComparisonUnifiedMetrics test in tests/unit/components/comparison-unified-metrics.test.tsx"
Task T013: "ComparisonComplianceHeatmap test in tests/unit/components/comparison-compliance-heatmap.test.tsx"
Task T015: "ComparisonDecisionPoints test in tests/unit/components/comparison-decision-points.test.tsx"
```

## Parallel Example: P1 User Story Implementations

```bash
# After foundational phase, launch P1 story implementations in parallel:
Task T006: "ComparisonHeroCard in components/comparison/comparison-hero-card.tsx"
Task T008: "ComparisonParticipantGrid in components/comparison/comparison-participant-grid.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (ScoreGauge + color helper)
2. Complete Phase 2: Foundational (type interfaces)
3. Complete Phase 3: User Story 1 (Hero Card)
4. Complete Phase 4: User Story 2 (Participant Grid)
5. **STOP and VALIDATE**: Wire hero card + participant grid into viewer, test independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Hero Card) + US2 (Participant Grid) → Core winner/participant display (MVP!)
3. Add US3 (Stat Cards) + US4 (Unified Metrics) → Full metrics comparison
4. Add US5 (Compliance Heatmap) + US6 (Decision Points) → Complete visual redesign
5. Polish → Wire into viewer, remove deprecated components, validate

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel batch 1: US1 + US2 (P1 stories)
   - Parallel batch 2: US3 + US4 (P2 stories)
   - Parallel batch 3: US5 + US6 (P3 stories)
3. Polish phase integrates all components into the viewer

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- All colors use Tailwind semantic tokens or `ctp-*` CSS variables — NO hardcoded hex/rgb
- No API or schema changes — UI-only redesign using existing `ComparisonDetail` data
- Enrichment states (available, pending, unavailable) must be handled in every component
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
