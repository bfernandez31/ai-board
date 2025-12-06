# Tasks: Add Stats Tab to Ticket Detail Modal

**Input**: Design documents from `/specs/AIB-99-add-stats-tab/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included as explicitly requested in the feature specification (see spec.md auto-resolved decisions).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [ ] T001 [P] Create `TicketJobWithTelemetry` interface in lib/types/job-types.ts
- [ ] T002 [P] Create `TicketStats` interface in lib/hooks/use-ticket-stats.ts

**Checkpoint**: Types ready - hooks and components can now reference these types

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core hooks and data access that MUST be complete before UI components

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete

- [ ] T003 Implement `useTicketStats` hook with aggregation logic in lib/hooks/use-ticket-stats.ts (depends on T002)
- [ ] T004 Extend job polling response to include telemetry fields in components/board/kanban-board.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Aggregated Job Statistics (Priority: P1) 🎯 MVP

**Goal**: Display aggregated statistics for all workflow jobs on a ticket (total cost, duration, tokens, cache efficiency)

**Independent Test**: Open any ticket with completed jobs and verify Stats tab shows summary metrics

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T005 [P] [US1] Unit test for stats aggregation functions in tests/unit/ticket-stats.test.ts
- [ ] T006 [P] [US1] E2E test for Stats tab visibility and summary cards in tests/e2e/tickets/stats-tab.spec.ts

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create `StatsSummaryCards` component with 4 summary cards in components/ticket/ticket-stats.tsx
- [ ] T008 [US1] Add Stats tab to ticket detail modal (TabsTrigger, TabsContent) in components/board/ticket-detail-modal.tsx
- [ ] T009 [US1] Implement conditional Stats tab visibility (only when jobs exist) in components/board/ticket-detail-modal.tsx
- [ ] T010 [US1] Update TabsList grid from grid-cols-3 to grid-cols-4 in components/board/ticket-detail-modal.tsx
- [ ] T011 [US1] Add keyboard shortcut Cmd+4 / Ctrl+4 for Stats tab in components/board/ticket-detail-modal.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - users can see aggregated stats

---

## Phase 4: User Story 2 - Review Jobs Timeline (Priority: P1)

**Goal**: Display chronological list of all jobs with individual metrics and expandable token breakdown

**Independent Test**: Open a ticket with multiple jobs and verify each job appears with correct details and can be expanded

### Tests for User Story 2 ⚠️

- [ ] T012 [P] [US2] E2E test for jobs timeline display and expansion in tests/e2e/tickets/stats-tab.spec.ts

### Implementation for User Story 2

- [ ] T013 [P] [US2] Create `JobsTimeline` component with chronological job list in components/ticket/jobs-timeline.tsx
- [ ] T014 [US2] Implement `JobRow` component with status icon, duration, cost, model in components/ticket/jobs-timeline.tsx
- [ ] T015 [US2] Add Collapsible token breakdown to JobRow (input, output, cache read, cache creation) in components/ticket/jobs-timeline.tsx
- [ ] T016 [US2] Integrate JobsTimeline into ticket-stats.tsx in components/ticket/ticket-stats.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can see summary stats and job timeline

---

## Phase 5: User Story 3 - Analyze Tool Usage (Priority: P2)

**Goal**: Display aggregated tool usage counts sorted by frequency

**Independent Test**: Open a ticket with jobs that used various tools and verify aggregated counts are displayed correctly

### Tests for User Story 3 ⚠️

- [ ] T017 [P] [US3] E2E test for tools usage display in tests/e2e/tickets/stats-tab.spec.ts

### Implementation for User Story 3

- [ ] T018 [US3] Create `ToolsUsageSection` component with frequency-sorted tool badges in components/ticket/ticket-stats.tsx
- [ ] T019 [US3] Implement empty state message when no tools recorded in components/ticket/ticket-stats.tsx

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - Real-Time Statistics Updates (Priority: P2)

**Goal**: Stats tab updates automatically as jobs complete via existing 2-second polling

**Independent Test**: Trigger a workflow and observe Stats tab updates during job completion without manual refresh

### Tests for User Story 4 ⚠️

- [ ] T020 [P] [US4] E2E test for real-time stats updates in tests/e2e/tickets/stats-tab.spec.ts

### Implementation for User Story 4

- [ ] T021 [US4] Verify stats recalculate on jobs prop change in components/ticket/ticket-stats.tsx
- [ ] T022 [US4] Verify JobsTimeline updates when new job appears in components/ticket/jobs-timeline.tsx

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, null handling, and final validation

- [ ] T023 Implement null/undefined telemetry handling with fallback values ("N/A", "-", 0) in lib/hooks/use-ticket-stats.ts
- [ ] T024 Handle large numbers with abbreviation formatting (1.2M) in components/ticket/ticket-stats.tsx
- [ ] T025 Run quickstart.md verification checklist
- [ ] T026 Run all tests and ensure they pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Shares ticket-stats.tsx container with US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Shares ticket-stats.tsx container with US1
- **User Story 4 (P2)**: Can start after US1/US2 complete - Tests real-time behavior

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/hooks before components
- Components before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002 can run in parallel (different files)
- T005, T006 can run in parallel (different test files)
- T007 can run in parallel with T005, T006 (different file types)
- T012, T013 can run in parallel (test file vs component file)
- T017, T018 can run in parallel (test file vs component file)
- T020, T021 can run in parallel after dependencies complete

---

## Parallel Example: User Story 1

```bash
# Launch tests and summary component together:
Task: "Unit test for stats aggregation functions in tests/unit/ticket-stats.test.ts"
Task: "E2E test for Stats tab visibility and summary cards in tests/e2e/tickets/stats-tab.spec.ts"
Task: "Create StatsSummaryCards component with 4 summary cards in components/ticket/ticket-stats.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T004)
3. Complete Phase 3: User Story 1 (T005-T011)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready - users can see aggregated stats

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Jobs timeline)
4. Add User Story 3 → Test independently → Deploy/Demo (Tools usage)
5. Add User Story 4 → Test independently → Deploy/Demo (Real-time updates)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Summary cards)
   - Developer B: User Story 2 (Jobs timeline)
3. After US1/US2 complete:
   - Developer A: User Story 3 (Tools usage)
   - Developer B: User Story 4 (Real-time)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Reuse existing formatting utilities from `lib/analytics/aggregations.ts`
- No schema changes required - reads from existing Job model
