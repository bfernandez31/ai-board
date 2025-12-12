# Tasks: Duplicate Ticket

**Input**: Design documents from `/specs/AIB-106-duplicate-a-ticket/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Requested in feature specification. Following TDD approach - write tests first, ensure they fail, then implement.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: This feature adds to an existing project - no setup needed. All infrastructure exists.

*No setup tasks required - feature integrates into existing Next.js application.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T001 Add `duplicateTicket` function signature to lib/db/tickets.ts (exports empty implementation)
- [x] T002 Create API route directory structure at app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts (stub returning 501)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Duplicate Ticket from Modal (Priority: P1)

**Goal**: Users can click duplicate button in ticket modal and create a new ticket in INBOX with copied content

**Independent Test**: Open any ticket modal, click duplicate, verify new ticket appears in INBOX with "Copy of " prefix, same description, policy, and attachments

### Tests for User Story 1 (TDD - Red Phase)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 [P] [US1] Create E2E test file tests/e2e/ticket-duplicate.spec.ts with test for basic duplication flow
- [x] T004 [P] [US1] Create API contract test file tests/api/tickets-duplicate.spec.ts with 201 success case

### Implementation for User Story 1

- [x] T005 [US1] Implement `duplicateTicket` function in lib/db/tickets.ts with title prefix and field mapping per data-model.md
- [x] T006 [US1] Implement POST handler in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts with verifyProjectAccess and verifyTicketAccess
- [x] T007 [US1] Add duplicate button to components/board/ticket-detail-modal.tsx header row with Copy icon from lucide-react
- [x] T008 [US1] Add `handleDuplicate` function in ticket-detail-modal.tsx with API call and TanStack Query invalidation

**Checkpoint**: User Story 1 should be fully functional - users can duplicate a ticket and see the new ticket in INBOX

---

## Phase 4: User Story 2 - Duplicate Ticket Visual Feedback (Priority: P2)

**Goal**: Users receive clear visual indication during duplicate action and success confirmation

**Independent Test**: Perform duplicate, verify button shows loading state while in progress, tooltip displays on hover, and success toast shows new ticket key

### Tests for User Story 2 (TDD - Red Phase)

- [x] T009 [P] [US2] Add E2E test in tests/e2e/ticket-duplicate.spec.ts for loading state during duplication
- [x] T010 [P] [US2] Add E2E test in tests/e2e/ticket-duplicate.spec.ts for tooltip display on duplicate button hover
- [x] T011 [P] [US2] Add E2E test in tests/e2e/ticket-duplicate.spec.ts for success toast with ticket key

### Implementation for User Story 2

- [x] T012 [US2] Add `isDuplicating` state and disabled/loading state to duplicate button in components/board/ticket-detail-modal.tsx
- [x] T013 [US2] Add tooltip with "Duplicate ticket" text to duplicate button in components/board/ticket-detail-modal.tsx
- [x] T014 [US2] Add success toast notification with new ticket key in handleDuplicate function in components/board/ticket-detail-modal.tsx
- [x] T015 [US2] Close modal after successful duplication in handleDuplicate function

**Checkpoint**: User Story 2 complete - users see loading state, tooltip, and success toast with ticket key

---

## Phase 5: User Story 3 - Duplicate Error Handling (Priority: P3)

**Goal**: Users receive appropriate error feedback when duplication fails

**Independent Test**: Simulate API failure, verify error toast displays, modal stays open, and retry is possible

### Tests for User Story 3 (TDD - Red Phase)

- [x] T016 [P] [US3] Add API contract test in tests/api/tickets-duplicate.spec.ts for 404 when ticket not found
- [x] T017 [P] [US3] Add API contract test in tests/api/tickets-duplicate.spec.ts for 404 when project not found
- [x] T018 [P] [US3] Add E2E test in tests/e2e/ticket-duplicate.spec.ts for error toast on API failure

### Implementation for User Story 3

- [x] T019 [US3] Add error response handling in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts for ticket not found (404)
- [x] T020 [US3] Add error response handling in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts for database errors (500)
- [x] T021 [US3] Add error toast in handleDuplicate catch block in components/board/ticket-detail-modal.tsx
- [x] T022 [US3] Ensure modal remains open on error and button re-enables for retry in components/board/ticket-detail-modal.tsx

**Checkpoint**: All user stories complete - full duplication flow with success and error handling

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and final validation

- [x] T023 [P] Add E2E test in tests/e2e/ticket-duplicate.spec.ts for long title truncation (>92 chars)
- [x] T024 [P] Add E2E test in tests/e2e/ticket-duplicate.spec.ts for ticket with maximum 5 attachments
- [x] T025 [P] Add API test in tests/api/tickets-duplicate.spec.ts for 400 on invalid projectId/ticketId
- [x] T026 Run quickstart.md validation - verify all manual testing steps pass
- [x] T027 Run full test suite with bun run test to ensure no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A - existing project
- **Foundational (Phase 2)**: No dependencies - can start immediately
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on User Story 1 (Phase 3) completion (button must exist)
- **User Story 3 (Phase 5)**: Depends on User Story 1 (Phase 3) completion (API must exist)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only - No dependencies on other stories
- **User Story 2 (P2)**: Requires US1 (duplicate button and handler must exist to add visual feedback)
- **User Story 3 (P3)**: Requires US1 (API endpoint must exist to add error handling)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- API implementation before UI implementation
- Handler function before visual enhancements
- Story complete before moving to next priority

### Parallel Opportunities

- Foundational tasks T001, T002 can run in parallel (different files)
- US1 tests T003, T004 can run in parallel (different test files)
- US2 tests T009, T010, T011 can run in parallel (same file but independent test cases)
- US3 tests T016, T017, T018 can run in parallel (different aspects of error handling)
- Polish tasks T023, T024, T025 can run in parallel (independent test additions)
- US2 and US3 can potentially run in parallel after US1 completes (if team has capacity)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together (they will fail initially - TDD Red Phase):
Task: "Create E2E test file tests/e2e/ticket-duplicate.spec.ts with test for basic duplication flow"
Task: "Create API contract test file tests/api/tickets-duplicate.spec.ts with 201 success case"
```

## Parallel Example: User Story 3 API Tests

```bash
# Launch all API error tests together:
Task: "Add API contract test for 404 when ticket not found"
Task: "Add API contract test for 404 when project not found"
Task: "Add E2E test for error toast on API failure"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (stubs)
2. Complete Phase 3: User Story 1 (Tests + Implementation)
3. **STOP and VALIDATE**: Test User Story 1 independently
4. Deploy/demo if ready - users can duplicate tickets with basic functionality

### Incremental Delivery

1. Complete Foundational (T001-T002) -> Stubs ready
2. Complete User Story 1 (T003-T008) -> Test independently -> Core duplication works!
3. Complete User Story 2 (T009-T015) -> Test independently -> Better UX with feedback
4. Complete User Story 3 (T016-T022) -> Test independently -> Robust error handling
5. Complete Polish (T023-T027) -> Edge cases covered, full test suite passes

### Single Developer Strategy (Recommended Order)

1. T001-T002 (Foundational stubs)
2. T003-T004 (US1 tests - should fail)
3. T005-T008 (US1 implementation - tests pass)
4. T009-T011 (US2 tests - should fail)
5. T012-T015 (US2 implementation - tests pass)
6. T016-T018 (US3 tests - should fail)
7. T019-T022 (US3 implementation - tests pass)
8. T023-T027 (Polish and validation)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD Red-Green cycle)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

## Summary

- **Total Tasks**: 27
- **User Story 1 (P1)**: 6 tasks (2 tests + 4 implementation)
- **User Story 2 (P2)**: 7 tasks (3 tests + 4 implementation)
- **User Story 3 (P3)**: 7 tasks (3 tests + 4 implementation)
- **Foundational**: 2 tasks
- **Polish**: 5 tasks
- **Parallel Opportunities**: 14 tasks marked [P]
- **MVP Scope**: User Story 1 only (8 tasks including foundational)
