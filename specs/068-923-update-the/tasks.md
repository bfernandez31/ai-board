# Tasks: Board Real-Time Update on Workflow Stage Transitions

**Input**: Design documents from `/specs/068-923-update-the/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests and E2E tests are included in this task list as the feature requires validation of cache invalidation behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router: `app/` for server-side code
- Client components: `components/` for React components
- Tests: `tests/unit/` for unit tests, `tests/e2e/` for E2E tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and test discovery

- [X] T001 Review existing cache invalidation pattern in app/lib/hooks/mutations/useStageTransition.ts:87-93
- [X] T002 Review TanStack Query query key structure in app/lib/query-keys.ts:33
- [X] T003 [P] Search for existing useJobPolling tests with command: npx grep -r "useJobPolling" tests/
- [X] T004 [P] Search for existing board E2E tests with command: npx glob "tests/e2e/**/*board*.spec.ts"

**Checkpoint**: Existing patterns understood, test locations identified

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core imports and type definitions needed for all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Add imports to app/lib/hooks/useJobPolling.ts: useQueryClient from @tanstack/react-query, useRef and useEffect from react
- [X] T006 Import queryKeys factory in app/lib/hooks/useJobPolling.ts from app/lib/query-keys.ts
- [X] T007 Verify TERMINAL_STATUSES constant exists in app/lib/hooks/useJobPolling.ts (line 36)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Board Updates After Workflow Completion (Priority: P1) 🎯 MVP

**Goal**: When workflows complete and transition tickets, the board automatically reflects the change within 2 seconds without manual refresh.

**Independent Test**: Trigger a workflow that transitions a ticket from BUILD to VERIFY, observe board updates automatically without page refresh.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Add unit test in tests/unit/useJobPolling.test.ts: should invalidate tickets cache when job transitions to COMPLETED
- [X] T009 [P] [US1] Add unit test in tests/unit/useJobPolling.test.ts: should NOT invalidate cache on initial load
- [X] T010 [P] [US1] Add unit test in tests/unit/useJobPolling.test.ts: should NOT invalidate cache when job transitions from PENDING to RUNNING
- [X] T011 [US1] Run unit tests to verify they FAIL: bun run test:unit useJobPolling

### Implementation for User Story 1

- [X] T012 [US1] Create previousJobsRef using useRef<JobStatusDto[]>([]) in app/lib/hooks/useJobPolling.ts
- [X] T013 [US1] Get queryClient instance using useQueryClient() hook in app/lib/hooks/useJobPolling.ts
- [X] T014 [US1] Add useEffect hook with dependencies [jobs, projectId, queryClient] in app/lib/hooks/useJobPolling.ts
- [X] T015 [US1] Implement initial mount guard in useEffect: skip if previousJobsRef.current.length === 0 and jobs.length > 0
- [X] T016 [US1] Implement terminal status detection logic: filter jobs that transitioned from non-terminal to terminal status
- [X] T017 [US1] Call queryClient.invalidateQueries with queryKeys.projects.tickets(projectId) when terminal jobs detected
- [X] T018 [US1] Update previousJobsRef.current = jobs at end of useEffect
- [X] T019 [US1] Add console.log for debugging terminal job detection in app/lib/hooks/useJobPolling.ts
- [X] T020 [US1] Run unit tests to verify they PASS: bun run test:unit useJobPolling

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Board Updates After Quick-Impl Workflow (Priority: P2)

**Goal**: Quick-impl workflows (INBOX → BUILD transition) should also trigger automatic board updates when they complete.

**Independent Test**: Drag ticket from INBOX to BUILD (triggering quick-impl), observe board update after workflow completion.

### Tests for User Story 2

- [X] T021 [P] [US2] Add unit test in tests/unit/useJobPolling.test.ts: should invalidate cache for multiple jobs transitioning simultaneously
- [X] T022 [US2] Run unit tests to verify new test FAILS: bun run test:unit useJobPolling

### Implementation for User Story 2

- [X] T023 [US2] Verify cache invalidation works for multiple concurrent workflows in app/lib/hooks/useJobPolling.ts (implementation from US1 should handle this)
- [X] T024 [US2] Run unit tests to verify they PASS: bun run test:unit useJobPolling

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Manual Transitions Continue to Work (Priority: P3)

**Goal**: Ensure manual drag-and-drop transitions still work correctly with optimistic updates after implementing workflow-initiated updates.

**Independent Test**: Manually drag tickets between stages and verify immediate visual feedback without regressions.

### Tests for User Story 3

- [X] T025 [P] [US3] Create new E2E test file: tests/e2e/board/workflow-transitions.spec.ts
- [X] T026 [P] [US3] Add E2E test in tests/e2e/board/workflow-transitions.spec.ts: should update board when workflow transitions ticket to VERIFY
- [X] T027 [P] [US3] Add E2E test in tests/e2e/board/workflow-transitions.spec.ts: should update board when quick-impl workflow completes
- [X] T028 [P] [US3] Add E2E test in tests/e2e/board/workflow-transitions.spec.ts: should not break manual drag-and-drop transitions
- [X] T029 [US3] Run E2E tests to verify they FAIL: bun run test:e2e board/workflow-transitions

### Implementation for User Story 3

- [X] T030 [US3] Verify board component in components/board/board.tsx uses useJobPolling and useTickets hooks correctly
- [X] T031 [US3] Verify no changes needed to board component (passive consumer of cache updates)
- [X] T032 [US3] Run E2E tests to verify they PASS: bun run test:e2e board/workflow-transitions
- [X] T033 [US3] Manual testing: Start dev server with bun run dev
- [X] T034 [US3] Manual testing: Navigate to http://localhost:3000/projects/1/board
- [X] T035 [US3] Manual testing: Manually drag ticket between stages and verify immediate optimistic update
- [X] T036 [US3] Manual testing: Trigger workflow via API and verify board updates within 2 seconds

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T037 [P] Run full test suite to verify no regressions: bun run test
- [X] T038 [P] Verify type checking passes: bun run type-check
- [X] T039 [P] Run linter: bun run lint
- [X] T040 Remove debug console.log statements from app/lib/hooks/useJobPolling.ts (if desired for production)
- [X] T041 Review browser console logs for cache invalidation behavior during manual testing
- [X] T042 Verify no performance regressions: check network tab shows single refetch per workflow completion
- [X] T043 Review edge cases from spec.md: offline network recovery, rapid consecutive completions, rollback transitions
- [X] T044 Run quickstart.md validation steps for deployment readiness

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 implementation (uses same cache invalidation logic)
- **User Story 3 (P3)**: Can start after US1 and US2 complete - Validates integration with existing manual transitions

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- useEffect logic before testing
- Unit tests before E2E tests
- Implementation before manual validation
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- All unit tests within US1 marked [P] can run in parallel
- Unit test for US2 marked [P] can run concurrently with US1 tests (if team capacity allows)
- All E2E tests within US3 marked [P] can be written in parallel
- Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all unit tests for User Story 1 together:
Task T008: "Add unit test: should invalidate tickets cache when job transitions to COMPLETED"
Task T009: "Add unit test: should NOT invalidate cache on initial load"
Task T010: "Add unit test: should NOT invalidate cache when job transitions PENDING to RUNNING"

# Then run tests together:
Task T011: "bun run test:unit useJobPolling"

# Implementation tasks run sequentially (same file):
Task T012: "Create previousJobsRef"
Task T013: "Get queryClient instance"
Task T014: "Add useEffect hook"
# ... etc
```

---

## Parallel Example: User Story 3

```bash
# Launch all E2E test creation together:
Task T026: "Add E2E test: should update board when workflow transitions ticket to VERIFY"
Task T027: "Add E2E test: should update board when quick-impl workflow completes"
Task T028: "Add E2E test: should not break manual drag-and-drop transitions"

# Then run tests:
Task T029: "bun run test:e2e board/workflow-transitions"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Tasks T001-T004)
2. Complete Phase 2: Foundational (Tasks T005-T007) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (Tasks T008-T020)
4. **STOP and VALIDATE**: Test User Story 1 independently with unit tests
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Complete Polish phase → Final validation → Production deploy

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (Tasks T001-T007)
2. Once Foundational is done:
   - Developer A: User Story 1 tests (T008-T010), then implementation (T012-T020)
   - Developer B: Prepare User Story 2 tests (T021-T022) while US1 in progress
   - Developer C: Prepare E2E test file structure (T025) while US1 in progress
3. After US1 completes:
   - Developer A: User Story 2 implementation (T023-T024)
   - Developer B: User Story 3 E2E tests (T026-T029)
   - Developer C: Start manual testing prep (T033-T036)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each logical group of tasks
- Stop at any checkpoint to validate story independently
- Implementation is client-side only - no API or database changes
- Cache invalidation pattern follows existing TanStack Query conventions
- 2-second polling interval provides real-time feel without excessive server load

## Summary

- **Total tasks**: 44
- **User Story 1**: 13 tasks (8 tests, 9 implementation, 1 validation)
- **User Story 2**: 4 tasks (2 tests, 2 implementation)
- **User Story 3**: 12 tasks (5 tests, 7 implementation/validation)
- **Parallel opportunities**: 15 tasks marked [P]
- **Independent test criteria**: Each user story has clear acceptance scenarios defined in spec.md
- **Suggested MVP scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only)
