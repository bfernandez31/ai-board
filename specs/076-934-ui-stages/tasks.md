# Tasks: Real-Time UI Stage Synchronization

**Feature Branch**: `076-934-ui-stages`
**Input**: Design documents from `/specs/076-934-ui-stages/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: This feature specification does NOT explicitly request tests. However, per CLAUDE.md constitution Principle III (Test-Driven Development), we follow the hybrid testing strategy documented in research.md: Vitest unit tests + Playwright integration/E2E tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js 15 App Router project
- Frontend: `app/`, `components/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and test environment setup

- [X] T001 [P] Search for existing useJobPolling test files in tests/ directory
- [X] T002 [P] Search for existing real-time test directory structure in tests/
- [X] T003 Verify TanStack Query v5.90.5 installed and query-keys factory available in app/lib/query-keys.ts

**Checkpoint**: Setup complete - test discovery finished, no new test files needed if existing tests found

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Read and understand existing useJobPolling hook implementation in app/lib/hooks/useJobPolling.ts
- [X] T005 Read and understand TanStack Query cache patterns in app/lib/hooks/queries/useTickets.ts
- [X] T006 Read and understand queryKeys factory structure in app/lib/query-keys.ts
- [X] T007 Verify polling endpoint contract in app/api/projects/[projectId]/jobs/status/route.ts
- [X] T008 Verify tickets endpoint contract in app/api/projects/[projectId]/tickets/route.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Quick-Impl Workflow Stage Visibility (Priority: P1) 🎯 MVP

**Goal**: Ticket automatically moves from BUILD to VERIFY column when quick-impl workflow completes, within 2-3 seconds, without manual page refresh.

**Independent Test**: Create ticket, drag INBOX → BUILD (quick-impl), observe automatic transition to VERIFY when workflow script calls transition API.

### Tests for User Story 1 (Red-Green-Refactor: Write tests FIRST) ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T009 [P] [US1] Write Vitest unit test for terminal job detection logic in tests/unit/useJobPolling.test.ts
- [X] T010 [P] [US1] Write Vitest unit test for cache invalidation trigger on terminal status in tests/unit/useJobPolling.test.ts
- [X] T011 [P] [US1] Write Vitest unit test for useRef tracking of previous job state in tests/unit/useJobPolling.test.ts
- [ ] T012 [US1] Write Playwright E2E test for quick-impl workflow stage sync in tests/e2e/real-time/ui-stage-sync.spec.ts (depends on T009-T011)

**⚠️ VERIFY ALL TESTS FAIL** before proceeding to implementation tasks

### Implementation for User Story 1

- [X] T013 [US1] Add useRef to track previous job state in app/lib/hooks/useJobPolling.ts
- [X] T014 [US1] Implement terminal job detection logic (compare current vs previous jobs) in app/lib/hooks/useJobPolling.ts
- [X] T015 [US1] Import useQueryClient hook from @tanstack/react-query in app/lib/hooks/useJobPolling.ts
- [X] T016 [US1] Import queryKeys factory in app/lib/hooks/useJobPolling.ts
- [X] T017 [US1] Add useEffect to call queryClient.invalidateQueries when terminal jobs detected in app/lib/hooks/useJobPolling.ts
- [X] T018 [US1] Update previousJobsRef.current with current jobs state at end of effect in app/lib/hooks/useJobPolling.ts
- [X] T019 [US1] Run Vitest unit tests to verify terminal detection logic (tests T009-T011 should pass)
- [ ] T020 [US1] Run Playwright E2E test for quick-impl stage sync (test T012 should pass)

**Checkpoint**: User Story 1 complete - quick-impl workflow stage transitions now visible in UI automatically within 2-3 seconds

---

## Phase 4: User Story 2 - Auto-Ship Deployment Stage Visibility (Priority: P1)

**Goal**: Ticket automatically moves from VERIFY to SHIP column when auto-ship workflow completes deployment, within 2-3 seconds, without manual page refresh.

**Independent Test**: Simulate production deployment event with merged ticket branch, observe ticket moves from VERIFY to SHIP column automatically.

### Tests for User Story 2 (Red-Green-Refactor: Write tests FIRST) ⚠️

- [ ] T021 [P] [US2] Write Playwright E2E test for auto-ship workflow stage sync in tests/e2e/real-time/ui-stage-sync.spec.ts
- [ ] T022 [P] [US2] Write Playwright integration test for concurrent job transitions in tests/integration/real-time/job-polling.spec.ts

**⚠️ VERIFY ALL TESTS FAIL** before proceeding to implementation tasks

### Implementation for User Story 2

- [X] T023 [US2] Verify existing terminal detection logic handles auto-ship command in app/lib/hooks/useJobPolling.ts (code review)
- [ ] T024 [US2] Run Playwright E2E test for auto-ship stage sync (test T021 should pass)
- [ ] T025 [US2] Run Playwright integration test for concurrent transitions (test T022 should pass)

**Checkpoint**: User Stories 1 AND 2 both work independently - workflow-initiated stage transitions (quick-impl and auto-ship) now visible in UI

---

## Phase 5: User Story 3 - Manual Stage Transition Reliability (Priority: P2)

**Goal**: Manual drag-and-drop stage transitions remain responsive and correct even when workflows are simultaneously running and making their own stage transitions.

**Independent Test**: Manually drag a ticket while a workflow is running on another ticket. Both operations should complete successfully without race conditions or UI state corruption.

### Tests for User Story 3 (Red-Green-Refactor: Write tests FIRST) ⚠️

- [ ] T026 [P] [US3] Write Playwright E2E test for manual drag during workflow in tests/e2e/real-time/ui-stage-sync.spec.ts
- [ ] T027 [P] [US3] Write Playwright E2E test for concurrent manual and workflow updates in tests/e2e/real-time/ui-stage-sync.spec.ts
- [ ] T028 [P] [US3] Write Playwright integration test for cache consistency after simultaneous updates in tests/integration/real-time/job-polling.spec.ts

**⚠️ VERIFY ALL TESTS FAIL** before proceeding to implementation tasks

### Implementation for User Story 3

- [X] T029 [US3] Verify existing optimistic update logic in drag-and-drop handler is unaffected by polling (code review)
- [ ] T030 [US3] Test backward compatibility: manual drag from BUILD to INBOX while polling active (quickstart.md scenario 3)
- [ ] T031 [US3] Run Playwright E2E tests for manual transitions (tests T026-T027 should pass)
- [ ] T032 [US3] Run Playwright integration test for cache consistency (test T028 should pass)

**Checkpoint**: All user stories independently functional - both workflow and manual transitions work correctly with polling active

---

## Phase 6: Edge Cases & Cross-Story Validation

**Purpose**: Handle edge cases that affect multiple user stories

### Tests for Edge Cases (Red-Green-Refactor: Write tests FIRST) ⚠️

- [ ] T033 [P] Write Vitest unit test for rapid successive stage transitions (BUILD → VERIFY → SHIP) in tests/unit/useJobPolling.test.ts
- [ ] T034 [P] Write Playwright integration test for network latency during refetch in tests/integration/real-time/job-polling.spec.ts
- [ ] T035 [P] Write Playwright E2E test for version conflict during concurrent transitions in tests/e2e/real-time/ui-stage-sync.spec.ts

**⚠️ VERIFY ALL TESTS FAIL** before proceeding to implementation tasks

### Implementation for Edge Cases

- [X] T036 Verify TanStack Query request deduplication handles rapid transitions (code review of useJobPolling.ts)
- [ ] T037 Test rapid successive transitions: workflow chains BUILD → VERIFY → SHIP within 4 seconds (quickstart.md edge case 1)
- [ ] T038 Test network latency: delay tickets refetch and verify eventual consistency (quickstart.md edge case 2)
- [ ] T039 Test version conflict: manual drag at exact moment of workflow transition (quickstart.md edge case 3)
- [ ] T040 Run all edge case tests (tests T033-T035 should pass)

**Checkpoint**: All edge cases handled - system is resilient to rapid transitions, network latency, and concurrent updates

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T041 [P] Remove debug console.logs from useJobPolling.ts (if any added during development)
- [X] T042 [P] Verify TypeScript strict mode compliance in app/lib/hooks/useJobPolling.ts (no `any` types)
- [ ] T043 [P] Run full test suite: bun test (all unit + E2E tests must pass)
- [X] T044 [P] Run type check: bun run type-check (no TypeScript errors)
- [X] T045 [P] Run lint: bun run lint (no linting errors)
- [ ] T046 Performance validation: measure UI update latency (target < 3000ms, see quickstart.md)
- [ ] T047 Performance validation: monitor polling endpoint response time (target < 100ms p95, see quickstart.md)
- [ ] T048 Performance validation: monitor tickets endpoint response time (target < 100ms p95, see quickstart.md)
- [ ] T049 Run quickstart.md test scenarios manually (Test Scenarios 1-3)
- [X] T050 Verify no new dependencies added (only existing TanStack Query used)
- [X] T051 Verify backward compatibility: existing manual transitions still work (regression test)
- [X] T052 Update CLAUDE.md if needed (document cache invalidation pattern if not already documented)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 US1 → P1 US2 → P2 US3)
- **Edge Cases (Phase 6)**: Depends on all user stories complete (validates cross-story interactions)
- **Polish (Phase 7)**: Depends on all previous phases complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Reuses terminal detection logic from US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Validates compatibility with US1/US2 but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Red-Green-Refactor)
- Unit tests before E2E tests (fast feedback loop)
- Terminal detection logic before cache invalidation
- Cache invalidation implementation before E2E validation
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T003)
- All tests for a user story marked [P] can run in parallel
  - US1: T009, T010, T011 (unit tests)
  - US2: T021, T022 (E2E tests)
  - US3: T026, T027, T028 (E2E + integration tests)
  - Edge cases: T033, T034, T035
- All Polish tasks marked [P] can run in parallel (T041-T045)
- Different user stories can be worked on in parallel by different team members (after Phase 2 complete)

---

## Parallel Example: User Story 1

```bash
# Launch all unit tests for User Story 1 together (Red-Green-Refactor: WRITE FIRST):
Task: T009 - "Write Vitest unit test for terminal job detection logic in tests/unit/useJobPolling.test.ts"
Task: T010 - "Write Vitest unit test for cache invalidation trigger in tests/unit/useJobPolling.test.ts"
Task: T011 - "Write Vitest unit test for useRef tracking in tests/unit/useJobPolling.test.ts"

# After tests fail, implement in sequence:
Task: T013 - "Add useRef to track previous job state"
Task: T014 - "Implement terminal job detection logic"
Task: T015 - "Import useQueryClient"
Task: T016 - "Import queryKeys"
Task: T017 - "Add useEffect to call invalidateQueries"
Task: T018 - "Update previousJobsRef.current"

# Then validate (Green):
Task: T019 - "Run unit tests (should pass)"
Task: T020 - "Run E2E test (should pass)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003) - ~5 minutes
2. Complete Phase 2: Foundational (T004-T008) - ~15 minutes (code review)
3. Complete Phase 3: User Story 1 (T009-T020) - ~45 minutes (TDD cycle)
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart.md scenario 1)
5. Deploy/demo if ready - quick-impl workflow stage visibility is working!

**Estimated MVP Time**: ~65 minutes

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (~20 minutes)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! +45 minutes, total ~65 minutes)
3. Add User Story 2 → Test independently → Deploy/Demo (+30 minutes, total ~95 minutes)
4. Add User Story 3 → Test independently → Deploy/Demo (+30 minutes, total ~125 minutes)
5. Add Edge Cases → Validate cross-story → Deploy/Demo (+30 minutes, total ~155 minutes)
6. Polish → Final validation → Production release (+30 minutes, total ~185 minutes)

**Estimated Total Time**: ~3 hours (full feature with all user stories, edge cases, and polish)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (~20 minutes)
2. Once Foundational is done:
   - Developer A: User Story 1 (T009-T020) - ~45 minutes
   - Developer B: User Story 2 (T021-T025) - ~30 minutes
   - Developer C: User Story 3 (T026-T032) - ~30 minutes
3. Once all stories complete: Team works together on Edge Cases (T033-T040) - ~30 minutes
4. Final Polish in parallel (T041-T052) - ~30 minutes

**Estimated Parallel Time**: ~1.5 hours (with 3 developers)

---

## Performance Success Criteria (from spec.md)

- **SC-001**: UI stage changes visible within 3 seconds of workflow completion ✅ Target
- **SC-002**: 100% of workflow-initiated transitions work without page refresh ✅ Target
- **SC-003**: Polling performance maintained (2s interval, < 100ms p95 response time) ✅ Target
- **SC-004**: Zero instances of tickets in incorrect columns ✅ Target
- **SC-005**: Manual drag-and-drop works correctly during concurrent workflows ✅ Target

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD MANDATORY**: Verify tests fail before implementing (Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No new API endpoints or database migrations required (client-side fix only)
- Leverage TanStack Query built-in cache invalidation and request deduplication
- Follow TypeScript 5.6 strict mode throughout
- All changes confined to app/lib/hooks/useJobPolling.ts (single file modification)
- Zero breaking changes to existing code (backward compatible)

---

## Total Task Count

- **Setup**: 3 tasks
- **Foundational**: 5 tasks
- **User Story 1**: 12 tasks (4 tests + 8 implementation)
- **User Story 2**: 5 tasks (2 tests + 3 implementation)
- **User Story 3**: 7 tasks (3 tests + 4 implementation)
- **Edge Cases**: 8 tasks (3 tests + 5 implementation)
- **Polish**: 12 tasks

**Total**: 52 tasks

**Parallel Opportunities**: 19 tasks marked [P] can run concurrently

**MVP Scope** (User Story 1 only): 20 tasks (Setup + Foundational + US1)

**Suggested MVP Delivery**: Focus on Phase 1-3 (T001-T020) for immediate value, then iterate with US2-US3 in subsequent sprints.
