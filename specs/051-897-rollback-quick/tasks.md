# Tasks: Quick Workflow Rollback

**Feature Branch**: `051-897-rollback-quick`
**Input**: Design documents from `/home/runner/work/ai-board/ai-board/specs/051-897-rollback-quick/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/rollback-api.md ✅, quickstart.md ✅

**Tests**: Test tasks are included per TDD requirements from constitution and quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `- [ ] [ID] [P?] [Story?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js full-stack (App Router)
- `app/` for backend logic and API routes
- `components/` for frontend components
- `tests/` for all test files

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new setup required - leveraging existing Next.js/Prisma infrastructure

**Note**: This feature requires ZERO setup tasks. All infrastructure exists (Prisma, TanStack Query, @dnd-kit, Zod, Vitest, Playwright).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core rollback validation logic that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T001 Create rollback validation utility with type definitions in app/lib/workflows/rollback-validator.ts
- [ ] T002 [P] Create Vitest unit test suite for rollback validation logic in tests/unit/rollback-validator.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Recover from Failed Quick-Impl (Priority: P1) 🎯 MVP

**Goal**: Enable users to rollback tickets from BUILD to INBOX when quick-impl or normal workflow jobs have FAILED or CANCELLED status, providing a recovery mechanism to retry with different workflow paths.

**Independent Test**: Create ticket → Transition to BUILD with quick-impl → Simulate job failure → Drag to INBOX → Verify state reset (stage=INBOX, workflowType=FULL, branch=null, version=1, job deleted) → Successfully proceed through normal workflow.

### Tests for User Story 1 (TDD Required)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T003 [P] [US1] Create Playwright API contract test suite for rollback transition endpoint in tests/api/rollback-transition.spec.ts
- [ ] T004 [P] [US1] Create Playwright E2E test suite for drag-and-drop rollback workflow in tests/e2e/rollback-quick-impl.spec.ts

### Implementation for User Story 1

- [ ] T005 [US1] Extend existing transition API route with rollback detection logic in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T006 [US1] Implement rollback validation with job filtering (exclude comment-* jobs) in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T007 [US1] Implement atomic rollback transaction (ticket update + job deletion) in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T008 [US1] Add structured error responses for rollback validation failures in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T009 [US1] Verify all API contract tests pass for rollback endpoint using bun run test:e2e tests/api/rollback-transition.spec.ts
- [ ] T010 [US1] Verify all E2E tests pass for rollback workflow using bun run test:e2e tests/e2e/rollback-quick-impl.spec.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - users can rollback failed BUILD tickets to INBOX via API and successfully restart workflows.

---

## Phase 4: User Story 2 - Visual Feedback for Rollback Eligibility (Priority: P2)

**Goal**: Provide clear visual indicators during drag operations to show whether a ticket is eligible for rollback to INBOX, distinct from normal workflow progression indicators.

**Independent Test**: Set up tickets in various states (BUILD with FAILED, RUNNING, COMPLETED jobs) → Start drag operations → Verify correct visual feedback appears (amber border for eligible, disabled/grayed for ineligible) WITHOUT executing actual transitions.

### Tests for User Story 2 (TDD Required)

- [ ] T011 [US2] Add E2E test cases for rollback visual feedback states in tests/e2e/rollback-quick-impl.spec.ts

### Implementation for User Story 2

- [ ] T012 [US2] Implement rollback eligibility check function for drag feedback in components/board/board.tsx
- [ ] T013 [US2] Add job filtering logic to find most recent workflow job in components/board/board.tsx
- [ ] T014 [US2] Implement amber border styling for rollback-eligible tickets during drag in components/board/board.tsx
- [ ] T015 [US2] Implement disabled styling for rollback-ineligible tickets during drag in components/board/board.tsx
- [ ] T016 [US2] Integrate job polling data with drag-and-drop visual feedback in components/board/board.tsx
- [ ] T017 [US2] Verify visual feedback tests pass using bun run test:e2e tests/e2e/rollback-quick-impl.spec.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users see clear visual feedback before attempting rollback.

---

## Phase 5: User Story 3 - Rollback State Reset (Priority: P2)

**Goal**: Ensure complete and atomic state reset when tickets are rolled back to INBOX, preventing data corruption and enabling clean restart with either workflow path.

**Independent Test**: Rollback ticket from BUILD to INBOX → Verify database state (workflowType=FULL, branch=null, version=1, failed job deleted) → Proceed through normal workflow (INBOX → SPECIFY → PLAN → BUILD) → Verify no state conflicts → Rollback again → Proceed through quick-impl (INBOX → BUILD) → Verify no state conflicts.

### Tests for User Story 3 (TDD Required)

- [ ] T018 [US3] Add API contract test cases for state reset validation in tests/api/rollback-transition.spec.ts
- [ ] T019 [US3] Add E2E test cases for post-rollback workflow restart in tests/e2e/rollback-quick-impl.spec.ts

### Implementation for User Story 3

**Note**: Core implementation already covered by User Story 1 (T007). This phase focuses on validation and edge case testing.

- [ ] T020 [US3] Verify atomic transaction resets all four fields (stage, workflowType, branch, version) in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T021 [US3] Add test case for rollback followed by normal workflow restart in tests/e2e/rollback-quick-impl.spec.ts
- [ ] T022 [US3] Add test case for rollback followed by quick-impl workflow restart in tests/e2e/rollback-quick-impl.spec.ts
- [ ] T023 [US3] Add test case for multiple rollback cycles on same ticket in tests/e2e/rollback-quick-impl.spec.ts
- [ ] T024 [US3] Verify all state reset tests pass using bun run test:e2e tests/api/rollback-transition.spec.ts

**Checkpoint**: All user stories should now be independently functional - complete rollback feature with validation, visual feedback, and state management.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and ensure production readiness

- [ ] T025 [P] Run full test suite to verify all unit, API contract, and E2E tests pass using bun test
- [ ] T026 [P] Verify quickstart.md manual testing checklist completeness
- [ ] T027 [P] Performance validation: Verify API response time <200ms using browser DevTools
- [ ] T028 [P] Performance validation: Verify visual feedback latency <100ms during drag operations
- [ ] T029 [P] Verify success criteria SC-001 through SC-007 from spec.md
- [ ] T030 Code review: Verify TypeScript strict mode compliance (no any types)
- [ ] T031 Code review: Verify Zod validation schemas for all API inputs
- [ ] T032 Code review: Verify no sensitive data in error responses
- [ ] T033 [P] Update CLAUDE.md if needed (likely no changes required for this feature)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: SKIPPED - No setup required (existing infrastructure)
- **Foundational (Phase 2)**: No dependencies - can start immediately - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Depends on T001-T002 (rollback validator)
  - User Story 2 (P2): Depends on User Story 1 completion (needs working API for visual feedback)
  - User Story 3 (P2): Depends on User Story 1 completion (validates state reset from US1 implementation)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (T001-T002) - Core rollback functionality
- **User Story 2 (P2)**: Depends on User Story 1 API implementation - Adds visual feedback layer
- **User Story 3 (P2)**: Depends on User Story 1 transaction logic - Validates state management

**Note**: User Stories 2 and 3 both depend on User Story 1, so they cannot run fully in parallel. However, test writing for US2/US3 can begin while US1 implementation is in progress.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD red-green-refactor)
- API implementation before UI integration
- Validation logic before transaction logic
- Error handling after happy path implementation
- Test verification after implementation

### Parallel Opportunities

- **Foundational Phase**: T001 and T002 can run in parallel (validator implementation and tests)
- **User Story 1 Tests**: T003 and T004 can be written in parallel (API contract and E2E test suites)
- **User Story 2**: T011 test writing can start while US1 implementation is in progress
- **User Story 3**: T018 and T019 test writing can start while US1 implementation is in progress
- **Polish Phase**: T025-T029 and T033 can run in parallel (testing and validation tasks)

---

## Parallel Example: Foundational Phase

```bash
# Launch validator implementation and test suite together:
# Terminal 1:
Task: "Create rollback validation utility with type definitions in app/lib/workflows/rollback-validator.ts"

# Terminal 2 (TDD approach - write tests first):
Task: "Create Vitest unit test suite for rollback validation logic in tests/unit/rollback-validator.test.ts"
```

---

## Parallel Example: User Story 1 Tests

```bash
# Launch both test suites together (write tests BEFORE implementation):
# Terminal 1:
Task: "Create Playwright API contract test suite for rollback transition endpoint in tests/api/rollback-transition.spec.ts"

# Terminal 2:
Task: "Create Playwright E2E test suite for drag-and-drop rollback workflow in tests/e2e/rollback-quick-impl.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T002) - Rollback validator with unit tests
2. Complete Phase 3: User Story 1 (T003-T010) - Core rollback API functionality
3. **STOP and VALIDATE**: Test rollback API endpoint independently via Playwright
4. Deploy/demo if ready - Users can rollback via API (no UI visual feedback yet)

**MVP Deliverable**: Users can recover from failed workflows by dragging tickets back to INBOX, with full state reset and validation.

### Incremental Delivery

1. Complete Foundational → Rollback validator ready (T001-T002)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! Core rollback works)
3. Add User Story 2 → Test independently → Deploy/Demo (Visual feedback added)
4. Add User Story 3 → Test independently → Deploy/Demo (State reset validation hardened)
5. Each story adds value without breaking previous stories

### Sequential Implementation (Single Developer)

1. Complete T001-T002 (Foundational) - ~2 hours
2. Complete T003-T010 (User Story 1) - ~6 hours
3. Complete T011-T017 (User Story 2) - ~3 hours
4. Complete T018-T024 (User Story 3) - ~2 hours
5. Complete T025-T033 (Polish) - ~2 hours

**Total Estimated Time**: ~15 hours for complete feature

### Parallel Team Strategy

With 2 developers after Foundational phase completes:

1. Team completes Foundational together (T001-T002)
2. Once Foundational is done:
   - Developer A: User Story 1 (T003-T010) - Core API implementation
   - Developer B: Write tests for User Story 2 and 3 (T011, T018-T019)
3. After US1 completes:
   - Developer A: User Story 2 implementation (T012-T017)
   - Developer B: User Story 3 validation (T020-T024)
4. Both join for Polish phase (T025-T033)

**Total Estimated Time**: ~10 hours with 2 developers

---

## Success Criteria Checklist

After implementation, verify all success criteria from spec.md:

- [ ] **SC-001**: Users can rollback tickets from BUILD to INBOX within 3 seconds (drag-and-drop completes)
- [ ] **SC-002**: Rollback eligibility validation completes in under 200ms (API response time)
- [ ] **SC-003**: 100% of rollback transitions correctly reset workflowType=FULL, branch=null, version=1, and delete failed job
- [ ] **SC-004**: 100% of invalid rollback attempts (RUNNING/COMPLETED jobs) blocked with clear error messages
- [ ] **SC-005**: Users can successfully restart either workflow path after rollback (INBOX → SPECIFY or INBOX → BUILD)
- [ ] **SC-006**: Rollback operations correctly delete only failed workflow job, leaving AI-BOARD comment jobs intact
- [ ] **SC-007**: Visual feedback for rollback eligibility appears within 100ms of drag start

---

## Edge Cases Coverage

Ensure tests cover all edge cases from spec.md:

- [ ] Rollback blocked when job status is RUNNING (error: "workflow is still running")
- [ ] Rollback blocked when job status is COMPLETED (error: "workflow completed successfully")
- [ ] Rollback blocked when job status is PENDING (error: "workflow is pending")
- [ ] Rollback allowed for both FAILED and CANCELLED job statuses
- [ ] Multiple jobs scenario: Only workflow job checked (ignore comment-* jobs)
- [ ] Normal workflow (workflowType=FULL) rollback works same as quick-impl rollback
- [ ] Git branch reference reset to null (actual branch cleanup is manual)
- [ ] Post-rollback ticket can proceed through normal workflow (INBOX → SPECIFY)
- [ ] Post-rollback ticket can proceed through quick-impl workflow (INBOX → BUILD)
- [ ] Multiple rollback cycles on same ticket work correctly

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD approach: Write tests FIRST, verify they FAIL, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Performance targets: <200ms API, <100ms UI feedback, <3s total transaction
- No schema changes required - all fields exist in current database
- Constitution compliance: TypeScript strict mode, Zod validation, Prisma transactions, NextAuth.js sessions
