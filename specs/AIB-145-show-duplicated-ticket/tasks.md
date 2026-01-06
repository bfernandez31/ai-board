# Tasks: Show Duplicated Ticket

**Input**: Design documents from `/specs/AIB-145-show-duplicated-ticket/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: RTL component tests are REQUIRED per spec.md (SC-003: "Test coverage includes at least one passing test that verifies the duplicate-and-display behavior")

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and imports are available

- [x] T001 Verify queryKeys utility exists and exports `projects.tickets` in app/lib/query-keys.ts
- [x] T002 Verify TicketWithVersion type is exported from app/lib/types/query-types.ts
- [x] T003 Verify test utilities exist for RTL testing in tests/utils/component-test-utils.ts

**Checkpoint**: All required utilities and types are confirmed available

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational changes needed - this is a bug fix in an existing component

**⚠️ NOTE**: This feature has no blocking infrastructure requirements. The existing codebase provides all necessary types, utilities, and patterns.

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - Duplicate Ticket Appears Immediately (Priority: P1) MVP

**Goal**: Fix the cache key mismatch so duplicated tickets appear in INBOX immediately without page refresh

**Independent Test**: Duplicate a ticket via modal, verify new ticket appears in INBOX column within 1 second without manual refresh

### Tests for User Story 1

**NOTE: Write test FIRST, ensure it FAILS before implementation**

- [x] T004 [US1] Create test file tests/unit/components/ticket-detail-modal.test.tsx with describe block for duplicate functionality
- [x] T005 [US1] Write RTL test case "should add duplicated ticket to cache immediately" that verifies cache update after duplicate

### Implementation for User Story 1

- [x] T006 [US1] Add import for queryKeys from @/app/lib/query-keys in components/board/ticket-detail-modal.tsx
- [x] T007 [US1] Add import for TicketWithVersion from @/app/lib/types/query-types in components/board/ticket-detail-modal.tsx
- [x] T008 [US1] Fix cache key in handleDuplicate from ['tickets', projectId] to queryKeys.projects.tickets(projectId) in components/board/ticket-detail-modal.tsx
- [x] T009 [US1] Add optimistic update pattern before API call in handleDuplicate in components/board/ticket-detail-modal.tsx
- [x] T010 [US1] Add onSuccess cache invalidation using correct queryKey in handleDuplicate in components/board/ticket-detail-modal.tsx
- [x] T011 [US1] Verify test T005 now passes after implementation

**Checkpoint**: User Story 1 is complete - duplicated tickets appear immediately without refresh

---

## Phase 4: User Story 2 - Error Handling on Duplicate Failure (Priority: P2)

**Goal**: When duplication fails, show error toast and maintain consistent UI state (cache rollback)

**Independent Test**: Simulate failed duplicate API call, verify error toast appears and cache is not corrupted

### Tests for User Story 2

- [x] T012 [US2] Write RTL test case "should show error toast on duplicate failure" in tests/unit/components/ticket-detail-modal.test.tsx
- [x] T013 [US2] Write RTL test case "should rollback cache on duplicate failure" in tests/unit/components/ticket-detail-modal.test.tsx

### Implementation for User Story 2

- [x] T014 [US2] Add cache snapshot before optimistic update for rollback capability in handleDuplicate in components/board/ticket-detail-modal.tsx
- [x] T015 [US2] Add catch block that restores previousData to cache on error in handleDuplicate in components/board/ticket-detail-modal.tsx
- [x] T016 [US2] Verify error toast displays proper error message in catch block in components/board/ticket-detail-modal.tsx
- [x] T017 [US2] Verify tests T012 and T013 pass after implementation

**Checkpoint**: User Story 2 is complete - error handling provides clear feedback and maintains cache consistency

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T018 Run full test suite to ensure no regressions (bun run test:unit)
- [x] T019 Run type check to ensure no TypeScript errors (bun run type-check)
- [x] T020 Manual verification using quickstart.md checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: N/A - no foundational work needed
- **User Story 1 (Phase 3)**: Depends on Setup verification
- **User Story 2 (Phase 4)**: Can run in parallel with US1 OR after US1 completion
- **Polish (Phase 5)**: Depends on US1 and US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - core bug fix
- **User Story 2 (P2)**: Shares same file as US1, best done sequentially after US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Imports before implementation
- Core fix before optimistic updates
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002, T003 (Setup verification) can run in parallel
- T004-T005 (US1 tests) should run sequentially (same file)
- T006, T007 (imports) can run in parallel
- T012, T013 (US2 tests) should run sequentially (same file)
- US1 and US2 modify same file - recommend sequential execution

---

## Parallel Example: Setup Phase

```bash
# Launch all setup verification tasks together:
Task: "Verify queryKeys utility exists in app/lib/query-keys.ts"
Task: "Verify TicketWithVersion type exists in app/lib/types/query-types.ts"
Task: "Verify test utilities exist in tests/utils/component-test-utils.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup verification
2. Skip Phase 2: No foundational work needed
3. Complete Phase 3: User Story 1 (cache key fix + optimistic update)
4. **STOP and VALIDATE**: Test duplicate functionality - ticket should appear immediately
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup verification → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Recommended Execution Order

Given that both user stories modify the same file (`ticket-detail-modal.tsx`), sequential execution is recommended:

1. Phase 1: Setup (parallel tasks T001-T003)
2. Phase 3: User Story 1 (tasks T004-T011 sequentially)
3. Phase 4: User Story 2 (tasks T012-T017 sequentially)
4. Phase 5: Polish (tasks T018-T020 sequentially)

---

## Notes

- [P] marker not used extensively because most tasks modify the same file
- [Story] label maps task to specific user story for traceability
- Each user story can be independently tested
- Verify tests fail before implementing (TDD approach per spec)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- This is a minimal bug fix - avoid over-engineering
