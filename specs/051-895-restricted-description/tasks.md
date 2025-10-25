---
description: "Task list for Stage-Based Ticket Editing Restrictions feature"
---

# Tasks: Restricted Ticket Editing by Stage

**Input**: Design documents from `/specs/051-895-restricted-description/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Tests included per TDD requirements (Principle III) - Vitest unit tests, Playwright integration/E2E tests

**Organization**: Tasks organized by user story to enable independent implementation and testing of each story

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router: `app/`, `components/`, `tests/` at repository root
- Paths follow Next.js 15 structure per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and test discovery

- [X] T001 [P] Search for existing ticket editing tests using grep pattern "describe.*ticket.*edit" in tests/
- [X] T002 [P] Search for existing ticket API tests using glob pattern "tests/**/*ticket*.(test|spec).ts"
- [X] T003 [P] Search for existing stage validation tests using grep pattern "stage.*validation" in tests/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation infrastructure that MUST be complete before ANY user story UI can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Utility Function (Foundation)

- [X] T004 Create stage validation utility function in lib/utils/stage-validation.ts

### Unit Tests for Validation (TDD - RED Phase)

- [X] T005 [P] Write unit test for INBOX stage returns true in tests/unit/stage-editing-validation.test.ts
- [X] T006 [P] Write unit test for SPECIFY stage returns false in tests/unit/stage-editing-validation.test.ts
- [X] T007 [P] Write unit test for PLAN stage returns false in tests/unit/stage-editing-validation.test.ts
- [X] T008 [P] Write unit test for BUILD stage returns false in tests/unit/stage-editing-validation.test.ts
- [X] T009 [P] Write unit test for VERIFY stage returns false in tests/unit/stage-editing-validation.test.ts
- [X] T010 [P] Write unit test for SHIP stage returns false in tests/unit/stage-editing-validation.test.ts

### Implementation (TDD - GREEN Phase)

- [X] T011 Implement canEditDescriptionAndPolicy function to pass all unit tests in lib/utils/stage-validation.ts
- [X] T012 Run unit tests with bun run test:unit tests/unit/stage-editing-validation.test.ts to verify GREEN state

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Edit Ticket in INBOX Stage (Priority: P1) 🎯 MVP

**Goal**: Users can freely edit ticket description and clarification policy when tickets are in INBOX stage

**Independent Test**: Create INBOX ticket, verify description field is editable Textarea, verify policy button is visible, successfully update both fields via API

### Server-Side Validation (US1)

- [X] T013 [US1] Add stage validation check to PATCH handler in app/api/projects/[projectId]/tickets/[id]/route.ts (after version check, before Prisma update)
- [X] T014 [US1] Add 400 error response with code INVALID_STAGE_FOR_EDIT for stage violations in app/api/projects/[projectId]/tickets/[id]/route.ts

### Contract Tests for US1 (TDD - RED Phase)

- [X] T015 [P] [US1] Write contract test for PATCH with description in INBOX returns 200 in tests/api/ticket-stage-restrictions.spec.ts
- [X] T016 [P] [US1] Write contract test for PATCH with clarificationPolicy in INBOX returns 200 in tests/api/ticket-stage-restrictions.spec.ts
- [X] T017 [P] [US1] Write contract test for PATCH with title in INBOX returns 200 (title not restricted) in tests/api/ticket-stage-restrictions.spec.ts

### Client-Side UI for US1

- [ ] T018 [US1] Locate ticket detail modal component using grep pattern "TicketDetailModal|ticket.*modal" in components/
- [ ] T019 [US1] Add isInboxStage boolean check using ticket.stage === 'INBOX' in ticket detail modal component
- [ ] T020 [US1] Add conditional rendering for description field (Textarea in INBOX, read-only div otherwise) in ticket detail modal component
- [ ] T021 [US1] Locate policy edit button using grep pattern "PolicyEditDialog|policy.*button" in components/
- [ ] T022 [US1] Add conditional visibility for policy button (visible only when isInboxStage) in policy edit component

### Integration Tests for US1 (TDD - RED Phase)

- [ ] T023 [P] [US1] Write integration test for INBOX ticket shows editable Textarea for description in tests/integration/ticket-editing.spec.ts
- [ ] T024 [P] [US1] Write integration test for INBOX ticket shows visible policy edit button in tests/integration/ticket-editing.spec.ts
- [ ] T025 [US1] Run integration tests with bun run test:e2e tests/integration/ticket-editing.spec.ts to verify RED state

### E2E Tests for US1 (TDD - RED Phase)

- [ ] T026 [P] [US1] Write E2E test for create INBOX ticket and edit description successfully in tests/e2e/stage-based-restrictions.spec.ts
- [ ] T027 [P] [US1] Write E2E test for create INBOX ticket and edit clarification policy successfully in tests/e2e/stage-based-restrictions.spec.ts
- [ ] T028 [US1] Run E2E tests with bun run test:e2e tests/e2e/stage-based-restrictions.spec.ts to verify RED state

### Validation (TDD - GREEN Phase)

- [ ] T029 [US1] Run all tests for User Story 1 with bun test to verify GREEN state (contract, integration, E2E)
- [ ] T030 [US1] Fix any test failures for User Story 1 until all tests pass

**Checkpoint**: User Story 1 fully functional - users can edit description and policy in INBOX stage

---

## Phase 4: User Story 2 - Restricted Editing in Active Stages (Priority: P1)

**Goal**: Ticket descriptions and policies become read-only after leaving INBOX stage, preventing unintended specification changes during active development

**Independent Test**: Create ticket in SPECIFY/PLAN/BUILD/VERIFY/SHIP stage, verify description is read-only text, verify policy button is hidden, verify API rejects updates with 400

### Contract Tests for US2 (TDD - RED Phase)

- [ ] T031 [P] [US2] Write contract test for PATCH with description in SPECIFY returns 400 with INVALID_STAGE_FOR_EDIT in tests/api/ticket-stage-restrictions.spec.ts
- [ ] T032 [P] [US2] Write contract test for PATCH with clarificationPolicy in PLAN returns 400 in tests/api/ticket-stage-restrictions.spec.ts
- [ ] T033 [P] [US2] Write contract test for PATCH with description in BUILD returns 400 in tests/api/ticket-stage-restrictions.spec.ts
- [ ] T034 [P] [US2] Write contract test for PATCH with clarificationPolicy in VERIFY returns 400 in tests/api/ticket-stage-restrictions.spec.ts
- [ ] T035 [P] [US2] Write contract test for PATCH with description in SHIP returns 400 in tests/api/ticket-stage-restrictions.spec.ts
- [ ] T036 [P] [US2] Write contract test for PATCH with title in SPECIFY returns 200 (title not restricted) in tests/api/ticket-stage-restrictions.spec.ts

### Integration Tests for US2 (TDD - RED Phase)

- [ ] T037 [P] [US2] Write integration test for SPECIFY ticket shows read-only div (not Textarea) for description in tests/integration/ticket-editing.spec.ts
- [ ] T038 [P] [US2] Write integration test for SPECIFY ticket hides policy edit button in tests/integration/ticket-editing.spec.ts
- [ ] T039 [P] [US2] Write integration test for PLAN ticket shows read-only description in tests/integration/ticket-editing.spec.ts
- [ ] T040 [P] [US2] Write integration test for BUILD ticket shows read-only description in tests/integration/ticket-editing.spec.ts
- [ ] T041 [P] [US2] Write integration test for VERIFY ticket shows read-only description in tests/integration/ticket-editing.spec.ts
- [ ] T042 [P] [US2] Write integration test for SHIP ticket shows read-only description in tests/integration/ticket-editing.spec.ts

### E2E Tests for US2 (TDD - RED Phase)

- [ ] T043 [P] [US2] Write E2E test for transition ticket from INBOX to SPECIFY and verify description becomes read-only in tests/e2e/stage-based-restrictions.spec.ts
- [ ] T044 [P] [US2] Write E2E test for attempt API description update in SPECIFY returns 400 error in tests/e2e/stage-based-restrictions.spec.ts
- [ ] T045 [P] [US2] Write E2E test for real-time polling updates UI to read-only when stage changes in tests/e2e/stage-based-restrictions.spec.ts

### Validation (TDD - GREEN Phase)

- [ ] T046 [US2] Run all tests for User Story 2 with bun test to verify GREEN state (contract, integration, E2E)
- [ ] T047 [US2] Fix any test failures for User Story 2 until all tests pass
- [ ] T048 [US2] Verify User Story 1 still passes after US2 implementation (regression check)

**Checkpoint**: User Stories 1 AND 2 both work - INBOX allows edits, all other stages prevent edits

---

## Phase 5: User Story 3 - Stage Transition Preservation (Priority: P2)

**Goal**: Description and policy values remain intact when tickets transition between stages, ensuring data integrity through stage lifecycle

**Independent Test**: Create INBOX ticket with specific description/policy, transition through multiple stages (INBOX → SPECIFY → PLAN → INBOX), verify values unchanged

### E2E Tests for US3 (TDD - RED Phase)

- [ ] T049 [P] [US3] Write E2E test for INBOX to SPECIFY transition preserves description and policy values in tests/e2e/stage-based-restrictions.spec.ts
- [ ] T050 [P] [US3] Write E2E test for SPECIFY to INBOX rollback re-enables editing in tests/e2e/stage-based-restrictions.spec.ts
- [ ] T051 [P] [US3] Write E2E test for transition through all stages (INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP) preserves values in tests/e2e/stage-based-restrictions.spec.ts

### Edge Case Tests for US3 (TDD - RED Phase)

- [ ] T052 [US3] Write E2E test for concurrent edit during stage transition (User A editing INBOX, User B transitions to SPECIFY, User A save fails with 400) in tests/e2e/stage-based-restrictions.spec.ts
- [ ] T053 [US3] Write E2E test for version conflict takes precedence over stage validation (existing behavior) in tests/e2e/stage-based-restrictions.spec.ts

### Validation (TDD - GREEN Phase)

- [ ] T054 [US3] Run all tests for User Story 3 with bun test to verify GREEN state
- [ ] T055 [US3] Fix any test failures for User Story 3 until all tests pass
- [ ] T056 [US3] Run full test suite (bun test) to verify all user stories pass together

**Checkpoint**: All user stories independently functional - complete feature ready for polish

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and user experience improvements

- [ ] T057 [P] Manual testing: Create INBOX ticket, edit description, verify save success
- [ ] T058 [P] Manual testing: Transition ticket to SPECIFY, verify read-only UI
- [ ] T059 [P] Manual testing: Attempt API edit in SPECIFY with curl, verify 400 error
- [ ] T060 [P] Manual testing: Transition back to INBOX, verify editing re-enabled
- [ ] T061 [P] Manual testing: Test real-time polling (two browsers, transition in one, verify other updates within 2s)
- [ ] T062 Verify optimistic update rollback on 400 error (manual browser test)
- [ ] T063 Verify TanStack Query error toast displays on stage validation failure (manual browser test)
- [ ] T064 Run full test suite with bun test to ensure all tests pass (unit, integration, E2E)
- [ ] T065 Run type check with bun run type-check to verify no TypeScript errors
- [ ] T066 Run linter with bun run lint to verify code quality
- [ ] T067 Review quickstart.md checklist completion (all manual testing items checked)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately (test discovery)
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories (validation utility + unit tests)
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (Phase 3): Can start after Foundational
  - User Story 2 (Phase 4): Can start after Foundational (extends US1 validation, but independent)
  - User Story 3 (Phase 5): Can start after Foundational (tests data integrity, independent of US1/US2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - implements INBOX editing
- **User Story 2 (P1)**: No dependencies on other stories - implements non-INBOX restrictions (uses same validation utility from Foundational)
- **User Story 3 (P2)**: No dependencies on other stories - tests stage transition data integrity (validates US1 + US2 work correctly through transitions)

### Within Each User Story

**Test-Driven Development (TDD) Order**:
1. Write tests FIRST (contract, integration, E2E) - verify RED state
2. Implement feature code - achieve GREEN state
3. Verify tests pass - maintain GREEN state
4. Refactor if needed - keep tests GREEN

**Implementation Order Within Story**:
- Server-side validation before client-side UI
- Contract tests before integration tests
- Integration tests before E2E tests
- Core implementation before edge cases

### Parallel Opportunities

**Phase 1 (Setup)**: All test discovery tasks (T001-T003) can run in parallel

**Phase 2 (Foundational)**: All unit test writing tasks (T005-T010) can run in parallel

**Phase 3 (US1)**:
- Contract tests T015-T017 can run in parallel
- Integration tests T023-T024 can run in parallel
- E2E tests T026-T027 can run in parallel

**Phase 4 (US2)**:
- Contract tests T031-T036 can run in parallel
- Integration tests T037-T042 can run in parallel
- E2E tests T043-T045 can run in parallel

**Phase 5 (US3)**:
- E2E tests T049-T051 can run in parallel

**Phase 6 (Polish)**:
- Manual testing tasks T057-T061 can run in parallel

**User Story Parallelization**:
- Once Foundational phase (Phase 2) completes, Phases 3-5 can proceed in parallel if team capacity allows
- Each user story is independently testable and does not block others

---

## Parallel Example: User Story 1 (Phase 3)

```bash
# Launch all contract tests for User Story 1 together (T015-T017):
Task: "Write contract test for PATCH with description in INBOX returns 200 in tests/api/ticket-stage-restrictions.spec.ts"
Task: "Write contract test for PATCH with clarificationPolicy in INBOX returns 200 in tests/api/ticket-stage-restrictions.spec.ts"
Task: "Write contract test for PATCH with title in INBOX returns 200 in tests/api/ticket-stage-restrictions.spec.ts"

# Launch all integration tests for User Story 1 together (T023-T024):
Task: "Write integration test for INBOX ticket shows editable Textarea for description in tests/integration/ticket-editing.spec.ts"
Task: "Write integration test for INBOX ticket shows visible policy edit button in tests/integration/ticket-editing.spec.ts"

# Launch all E2E tests for User Story 1 together (T026-T027):
Task: "Write E2E test for create INBOX ticket and edit description successfully in tests/e2e/stage-based-restrictions.spec.ts"
Task: "Write E2E test for create INBOX ticket and edit clarification policy successfully in tests/e2e/stage-based-restrictions.spec.ts"
```

---

## Parallel Example: User Story 2 (Phase 4)

```bash
# Launch all contract tests for User Story 2 together (T031-T036):
Task: "Write contract test for PATCH with description in SPECIFY returns 400 with INVALID_STAGE_FOR_EDIT in tests/api/ticket-stage-restrictions.spec.ts"
Task: "Write contract test for PATCH with clarificationPolicy in PLAN returns 400 in tests/api/ticket-stage-restrictions.spec.ts"
Task: "Write contract test for PATCH with description in BUILD returns 400 in tests/api/ticket-stage-restrictions.spec.ts"
Task: "Write contract test for PATCH with clarificationPolicy in VERIFY returns 400 in tests/api/ticket-stage-restrictions.spec.ts"
Task: "Write contract test for PATCH with description in SHIP returns 400 in tests/api/ticket-stage-restrictions.spec.ts"
Task: "Write contract test for PATCH with title in SPECIFY returns 200 in tests/api/ticket-stage-restrictions.spec.ts"

# Launch all integration tests for User Story 2 together (T037-T042):
Task: "Write integration test for SPECIFY ticket shows read-only div for description in tests/integration/ticket-editing.spec.ts"
Task: "Write integration test for SPECIFY ticket hides policy edit button in tests/integration/ticket-editing.spec.ts"
Task: "Write integration test for PLAN ticket shows read-only description in tests/integration/ticket-editing.spec.ts"
Task: "Write integration test for BUILD ticket shows read-only description in tests/integration/ticket-editing.spec.ts"
Task: "Write integration test for VERIFY ticket shows read-only description in tests/integration/ticket-editing.spec.ts"
Task: "Write integration test for SHIP ticket shows read-only description in tests/integration/ticket-editing.spec.ts"

# Launch all E2E tests for User Story 2 together (T043-T045):
Task: "Write E2E test for transition ticket from INBOX to SPECIFY and verify description becomes read-only in tests/e2e/stage-based-restrictions.spec.ts"
Task: "Write E2E test for attempt API description update in SPECIFY returns 400 error in tests/e2e/stage-based-restrictions.spec.ts"
Task: "Write E2E test for real-time polling updates UI to read-only when stage changes in tests/e2e/stage-based-restrictions.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (test discovery)
2. Complete Phase 2: Foundational (validation utility + unit tests) - CRITICAL
3. Complete Phase 3: User Story 1 (INBOX editing)
4. **STOP and VALIDATE**: Test User Story 1 independently with bun test
5. Deploy/demo if ready - users can edit in INBOX

### Incremental Delivery (Recommended)

1. Complete Setup + Foundational → Validation infrastructure ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: INBOX editing works)
3. Add User Story 2 → Test independently → Deploy/Demo (Full feature: restrictions enforced)
4. Add User Story 3 → Test independently → Deploy/Demo (Data integrity validated)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (Phase 1-2)
2. Once Foundational is done:
   - Developer A: User Story 1 (INBOX editing)
   - Developer B: User Story 2 (non-INBOX restrictions)
   - Developer C: User Story 3 (stage transition integrity)
3. Stories complete and integrate independently
4. Final integration test verifies all stories work together

---

## Notes

- **[P] tasks**: Different files, no dependencies - safe to run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **TDD Workflow**: RED (write failing test) → GREEN (implement to pass) → REFACTOR (improve while keeping GREEN)
- **Test Hierarchy**: Unit tests (fastest, foundation) → Contract tests (API) → Integration tests (UI) → E2E tests (full workflow)
- **Independent Stories**: Each user story can be tested and deployed independently
- **Commit Strategy**: Commit after each task or logical group (e.g., all contract tests for a story)
- **Checkpoints**: Stop at any checkpoint to validate story independently before proceeding
- **Constitution Compliance**: Follows all principles (TypeScript-first, component-driven, TDD, security-first, database integrity, specification clarification)
- **Estimated Timeline**: 2 hours total (30min foundational + 45min US1 + 30min US2 + 15min US3 + polish)
