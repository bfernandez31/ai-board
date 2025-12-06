# Tasks: Add Stats Tab to Ticket Detail Modal

**Input**: Design documents from `/specs/AIB-98-add-stats-tab/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Not explicitly requested in feature specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and utility functions shared across all user stories

- [X] T001 [P] Create TicketJobWithStats interface in lib/types/job-types.ts ✅ DONE
- [X] T002 [P] Create TicketStats and ToolUsageCount interfaces in lib/types/job-types.ts ✅ DONE
- [X] T003 [P] Create formatNumber utility function in lib/analytics/aggregations.ts ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API and aggregation logic that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Extend jobs API endpoint to support includeStats query parameter in app/api/projects/[projectId]/tickets/[id]/jobs/route.ts ✅ DONE
- [X] T005 Create calculateTicketStats function in lib/stats/ticket-stats.ts ✅ DONE
- [X] T006 Create aggregateToolUsage helper function in lib/stats/ticket-stats.ts ✅ DONE

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Aggregated Job Metrics (Priority: P1) 🎯 MVP

**Goal**: Display summary cards showing total cost, duration, tokens, and cache efficiency across all workflow executions

**Independent Test**: Create a ticket with completed jobs containing telemetry data, open the modal, and verify the Stats tab displays accurate aggregated metrics

### Implementation for User Story 1

- [X] T007 [P] [US1] Create StatsSummaryCards component in components/ticket/stats-summary-cards.tsx ✅ DONE
- [X] T008 [P] [US1] Create StatsTab container component in components/ticket/stats-tab.tsx ✅ DONE
- [X] T009 [US1] Add Stats tab to ticket detail modal in components/board/ticket-detail-modal.tsx ✅ DONE
- [X] T010 [US1] Add conditional tab visibility when jobs.length > 0 in components/board/ticket-detail-modal.tsx ✅ DONE
- [X] T011 [US1] Update grid layout from grid-cols-3 to conditional grid-cols-4 in components/board/ticket-detail-modal.tsx ✅ DONE
- [X] T012 [US1] Add Cmd/Ctrl+4 keyboard shortcut for Stats tab in components/board/ticket-detail-modal.tsx ✅ DONE

**Checkpoint**: At this point, User Story 1 should be fully functional - summary cards visible with accurate aggregates

---

## Phase 4: User Story 2 - Review Individual Job Details (Priority: P2)

**Goal**: Display chronological job timeline with expandable rows showing token breakdown

**Independent Test**: Open a ticket with multiple jobs and verify timeline displays job rows with correct data and expandable token breakdown

### Implementation for User Story 2

- [X] T013 [P] [US2] Create JobTimelineRow component with expandable token breakdown in components/ticket/job-timeline-row.tsx ✅ DONE
- [X] T014 [US2] Create JobTimeline component with chronological ordering in components/ticket/job-timeline.tsx ✅ DONE
- [X] T015 [US2] Add getStageFromCommand helper for stage label mapping in lib/stats/ticket-stats.ts ✅ DONE (already exists in lib/analytics/aggregations.ts)
- [X] T016 [US2] Integrate JobTimeline into StatsTab component in components/ticket/stats-tab.tsx ✅ DONE

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - summary cards and timeline visible

---

## Phase 5: User Story 3 - Analyze Tool Usage Patterns (Priority: P3)

**Goal**: Display aggregated tool usage counts across all jobs, sorted by frequency

**Independent Test**: Create jobs with varying toolsUsed arrays and verify aggregated count displays correctly, sorted by frequency

### Implementation for User Story 3

- [X] T017 [US3] Create ToolsUsageSection component with frequency-sorted badges in components/ticket/tools-usage-section.tsx ✅ DONE
- [X] T018 [US3] Integrate ToolsUsageSection into StatsTab component in components/ticket/stats-tab.tsx ✅ DONE

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T019 [P] Add empty state message for edge case when no jobs exist in components/ticket/stats-tab.tsx ✅ DONE
- [X] T020 [P] Add null value handling with "—" display in components/ticket/stats-summary-cards.tsx ✅ DONE
- [X] T021 [P] Add null value handling with "—" display in components/ticket/job-timeline-row.tsx ✅ DONE
- [X] T022 Run type-check to verify all TypeScript types are correct ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001, T002, T003) - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion (T004, T005, T006)
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses StatsTab from US1 but works independently
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses StatsTab from US1 but works independently

### Within Each User Story

- Models/types before components
- Container components before integration
- Core implementation before polish
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002, T003 (Setup) can run in parallel
- T007, T008 (US1 components) can run in parallel
- T013 (US2 row component) can start while T014 (timeline) is being written
- T019, T020, T021 (Polish) can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all setup tasks together:
Task: "Create TicketJobWithStats interface in lib/types/job-types.ts"
Task: "Create TicketStats and ToolUsageCount interfaces in lib/types/job-types.ts"
Task: "Create formatNumber utility function in lib/analytics/aggregations.ts"
```

## Parallel Example: User Story 1

```bash
# Launch US1 components together:
Task: "Create StatsSummaryCards component in components/ticket/stats-summary-cards.tsx"
Task: "Create StatsTab container component in components/ticket/stats-tab.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready - users can see aggregated job metrics

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! - Summary cards visible)
3. Add User Story 2 → Test independently → Deploy/Demo (Timeline with expandable rows)
4. Add User Story 3 → Test independently → Deploy/Demo (Tool usage analytics)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Summary Cards)
   - Developer B: User Story 2 (Job Timeline)
   - Developer C: User Story 3 (Tool Usage)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All new components use shadcn/ui primitives (Card, Collapsible, Badge)
- Existing analytics formatters (formatDuration, formatCost, formatPercentage) are reused
- No database schema changes required - Job model already has all telemetry fields
