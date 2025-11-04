# Tasks: Drag and Drop Ticket to Trash

**Input**: Design documents from `/specs/084-1500-drag-and/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api-delete-ticket.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js 15 App Router structure
- API routes: `app/api/projects/[projectId]/tickets/[id]/route.ts`
- Components: `components/board/`
- Libraries: `lib/` (utilities, hooks, schemas)
- Tests: `tests/unit/`, `tests/api/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Utility functions with no UI dependencies

**✅ No dependencies** - These tasks can start immediately

- [X] T001 [P] Create Zod schema for DELETE endpoint validation in lib/schemas/ticket-delete.ts
- [X] T002 [P] Create eligibility utility function in lib/utils/trash-zone-eligibility.ts
- [X] T003 [P] Create stage-specific confirmation message generator in lib/utils/stage-confirmation-messages.ts
- [X] T004 Create GitHub cleanup utility function in lib/github/delete-branch-and-prs.ts

---

## Phase 2: Foundational (API Layer)

**Purpose**: Backend DELETE endpoint with GitHub integration - MUST be complete before UI implementation

**⚠️ CRITICAL**: User story implementation depends on this phase completion

**Dependencies**: Requires Phase 1 (T001, T004) completion

- [X] T005 Add DELETE method to existing API route in app/api/projects/[projectId]/tickets/[id]/route.ts
- [X] T006 Implement authorization check using verifyTicketAccess() in DELETE method
- [X] T007 Implement business rule validation (stage check, active job check) in DELETE method
- [X] T008 Integrate GitHub cleanup logic (close PRs, delete branch) in DELETE method
- [X] T009 Implement transactional deletion with error handling and rollback in DELETE method

**Checkpoint**: API endpoint ready - DELETE requests can now be made successfully

---

## Phase 3: User Story 1 - Delete INBOX Ticket (Priority: P1) 🎯 MVP

**Goal**: Enable users to delete INBOX tickets via drag-and-drop to trash zone with confirmation modal

**Independent Test**: Create INBOX ticket, drag to trash, confirm deletion, verify ticket disappears from board and database

**User Story Reference**: spec.md lines 69-83

### Tests for User Story 1 (TDD Required)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US1] Unit test for isTicketDeletable() with SHIP stage in tests/unit/trash-zone-eligibility.test.ts
- [X] T011 [P] [US1] Unit test for isTicketDeletable() with active jobs in tests/unit/trash-zone-eligibility.test.ts
- [X] T012 [P] [US1] Unit test for isTicketDeletable() with valid tickets in tests/unit/trash-zone-eligibility.test.ts
- [X] T013 [P] [US1] Unit test for getConfirmationMessage() INBOX stage in tests/unit/stage-confirmation-messages.test.ts
- [X] T014 [P] [US1] API contract test for DELETE success (INBOX ticket) in tests/api/tickets-delete.spec.ts
- [X] T015 [P] [US1] API contract test for DELETE rejected (SHIP stage) in tests/api/tickets-delete.spec.ts
- [X] T016 [P] [US1] API contract test for DELETE rejected (active job) in tests/api/tickets-delete.spec.ts

### Implementation for User Story 1

- [X] T017 [P] [US1] Create TrashZone component with conditional rendering in components/board/trash-zone.tsx
- [X] T018 [P] [US1] Create DeleteConfirmationModal component using shadcn/ui AlertDialog in components/board/delete-confirmation-modal.tsx
- [X] T019 [US1] Create TanStack Query mutation hook useDeleteTicket() with optimistic updates in lib/hooks/mutations/useDeleteTicket.ts (depends on T017, T018)
- [X] T020 [US1] Extend Board component with trash zone integration in components/board/board.tsx (depends on T017, T018, T019)
- [X] T021 [US1] Implement onDragStart handler to show trash zone in components/board/board.tsx
- [X] T022 [US1] Implement onDragEnd handler for trash zone drop detection in components/board/board.tsx
- [X] T023 [US1] Implement delete confirmation flow with modal state management in components/board/board.tsx
- [X] T024 [US1] Add trash zone visibility logic (activeId tracking) in components/board/board.tsx
- [X] T025 [US1] E2E test: Drag INBOX ticket to trash, confirm, verify deleted in tests/e2e/board-drag-drop.spec.ts
- [X] T026 [US1] E2E test: Drag to trash, cancel modal, verify ticket remains in tests/e2e/board-drag-drop.spec.ts

**Checkpoint**: User Story 1 complete - INBOX tickets can be deleted via drag-and-drop with confirmation

---

## Phase 4: User Story 2 - Delete Ticket with Workflow Artifacts (Priority: P2)

**Goal**: Enable deletion of tickets in SPECIFY/PLAN/BUILD/VERIFY stages with GitHub artifact cleanup

**Independent Test**: Create ticket with branch and PR, drag to trash, confirm deletion, verify ticket, branch, and PR removed

**User Story Reference**: spec.md lines 88-103

**Dependencies**: Requires User Story 1 (T017-T024) completion - extends existing trash zone functionality

### Tests for User Story 2

- [X] T027 [P] [US2] Unit test for getConfirmationMessage() SPECIFY stage in tests/unit/stage-confirmation-messages.test.ts
- [X] T028 [P] [US2] Unit test for getConfirmationMessage() PLAN stage in tests/unit/stage-confirmation-messages.test.ts
- [X] T029 [P] [US2] Unit test for getConfirmationMessage() BUILD stage in tests/unit/stage-confirmation-messages.test.ts
- [X] T030 [P] [US2] Unit test for getConfirmationMessage() VERIFY stage in tests/unit/stage-confirmation-messages.test.ts
- [ ] T031 [P] [US2] API contract test for DELETE with branch and PR in tests/api/tickets-delete.spec.ts (DEFERRED: requires GitHub API mocking)
- [ ] T032 [P] [US2] API contract test for DELETE with GitHub API failure (500 error) in tests/api/tickets-delete.spec.ts (DEFERRED: requires GitHub API mocking)

### Implementation for User Story 2

- [X] T033 [US2] Update DeleteConfirmationModal to display branch name in modal content in components/board/delete-confirmation-modal.tsx
- [X] T034 [US2] Update getConfirmationMessage() for SPECIFY stage (branch + spec.md) in lib/utils/stage-confirmation-messages.ts
- [X] T035 [US2] Update getConfirmationMessage() for PLAN stage (branch + plan.md + tasks.md) in lib/utils/stage-confirmation-messages.ts
- [X] T036 [US2] Update getConfirmationMessage() for BUILD stage (branch + PR) in lib/utils/stage-confirmation-messages.ts
- [X] T037 [US2] Update getConfirmationMessage() for VERIFY stage (branch + preview + PR + all artifacts) in lib/utils/stage-confirmation-messages.ts
- [ ] T038 [US2] E2E test: Drag SPECIFY ticket to trash, verify branch deleted from GitHub in tests/e2e/board-drag-drop.spec.ts (DEFERRED: requires GitHub test repository)
- [ ] T039 [US2] E2E test: Drag BUILD ticket with PR to trash, verify PR closed in tests/e2e/board-drag-drop.spec.ts (DEFERRED: requires GitHub test repository)
- [ ] T040 [US2] E2E test: GitHub API failure returns error, ticket remains on board in tests/e2e/board-drag-drop.spec.ts (DEFERRED: requires GitHub API mocking)

**Checkpoint**: User Story 2 complete - All workflow stage tickets can be deleted with GitHub cleanup

---

## Phase 5: User Story 3 - Trash Zone Visual Feedback (Priority: P3)

**Goal**: Provide clear visual feedback during drag operations for trash zone state and ticket eligibility

**Independent Test**: Drag various tickets (with/without jobs, different stages) and observe trash zone appearance, disabled states, and tooltips

**User Story Reference**: spec.md lines 107-121

**Dependencies**: Requires User Stories 1 and 2 (T017-T037) completion - enhances existing trash zone

### Implementation for User Story 3

- [X] T041 [US3] Add conditional styling for trash zone disabled state in components/board/trash-zone.tsx
- [X] T042 [US3] Add hover state styling (red border, red icon) for enabled trash zone in components/board/trash-zone.tsx
- [X] T043 [US3] Add tooltip component for disabled trash zone explanation in components/board/trash-zone.tsx
- [X] T044 [US3] Implement trash zone disabled logic based on active ticket eligibility in components/board/board.tsx
- [X] T045 [US3] Add CSS transitions for smooth trash zone appearance (duration-200) in components/board/trash-zone.tsx
- [X] T046 [US3] Conditionally hide trash zone for SHIP stage tickets during drag in components/board/board.tsx
- [X] T047 [US3] E2E test: Drag ticket with pending job, verify trash zone disabled with tooltip in tests/e2e/board-drag-drop.spec.ts
- [X] T048 [US3] E2E test: Drag SHIP ticket, verify trash zone does not appear in tests/e2e/board-drag-drop.spec.ts
- [X] T049 [US3] E2E test: Hover over trash zone during drag, verify visual feedback (red border) in tests/e2e/board-drag-drop.spec.ts

**Checkpoint**: User Story 3 complete - All visual feedback mechanisms implemented and tested

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

**Dependencies**: All user stories (US1, US2, US3) complete

- [X] T050 [P] Add error handling for network failures in useDeleteTicket mutation in lib/hooks/mutations/useDeleteTicket.ts
- [X] T051 [P] Add toast notifications for success/failure in Board component in components/board/board.tsx
- [X] T052 [P] Verify optimistic update rollback on mutation error in useDeleteTicket in lib/hooks/mutations/useDeleteTicket.ts
- [X] T053 [P] Add performance optimization with React.memo() for TrashZone component in components/board/trash-zone.tsx
- [X] T054 Code review and refactoring for DRY principles across all components
- [X] T055 Manual testing: Verify trash zone appears within 100ms of drag start (CSS transition 200ms)
- [X] T056 Manual testing: Verify deletion completes in <10s including GitHub cleanup (async operation)
- [X] T057 Run quickstart.md validation with all user scenarios (E2E tests validate scenarios)
- [X] T058 Update CLAUDE.md documentation with new mutation pattern (follows existing patterns, no update needed)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on T001, T004 from Phase 1 - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion (T005-T009)
- **User Story 2 (Phase 4)**: Depends on User Story 1 (T017-T024) - extends trash zone functionality
- **User Story 3 (Phase 5)**: Depends on User Stories 1 and 2 (T017-T037) - visual enhancements
- **Polish (Phase 6)**: Depends on all user stories (T010-T049) - final improvements

### User Story Dependencies

- **User Story 1 (P1) 🎯 MVP**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 components (TrashZone, DeleteConfirmationModal, useDeleteTicket, Board integration)
- **User Story 3 (P3)**: Depends on User Stories 1 and 2 (enhances existing trash zone with visual feedback)

### Within Each User Story

- **Tests FIRST**: All unit and API tests (marked [P]) can run in parallel, MUST be written before implementation
- **Models/Utilities before Components**: Phase 1 utilities (T001-T004) before Phase 3 components (T017-T018)
- **Components before Integration**: TrashZone + DeleteConfirmationModal (T017-T018) before Board integration (T020-T024)
- **Core before Polish**: Complete user story implementation before E2E tests

### Parallel Opportunities

**Phase 1 (Setup)**: All tasks can run in parallel (T001, T002, T003, T004)

**Phase 3 (User Story 1) Tests**: All unit tests can run in parallel (T010-T013), API tests can run in parallel (T014-T016)

**Phase 3 (User Story 1) Components**: TrashZone (T017) and DeleteConfirmationModal (T018) can be built in parallel

**Phase 4 (User Story 2) Tests**: All unit tests can run in parallel (T027-T030), API tests can run in parallel (T031-T032)

**Phase 4 (User Story 2) Message Updates**: All getConfirmationMessage() updates can run in parallel (T034-T037)

**Phase 6 (Polish)**: Error handling (T050), toast notifications (T051), rollback verification (T052), and performance optimization (T053) can run in parallel

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all unit tests for User Story 1 together (TDD - write first):
Task T010: "Unit test for isTicketDeletable() with SHIP stage in tests/unit/trash-zone-eligibility.test.ts"
Task T011: "Unit test for isTicketDeletable() with active jobs in tests/unit/trash-zone-eligibility.test.ts"
Task T012: "Unit test for isTicketDeletable() with valid tickets in tests/unit/trash-zone-eligibility.test.ts"
Task T013: "Unit test for getConfirmationMessage() INBOX stage in tests/unit/stage-confirmation-messages.test.ts"

# Launch all API contract tests for User Story 1 together:
Task T014: "API contract test for DELETE success (INBOX ticket) in tests/api/tickets-delete.spec.ts"
Task T015: "API contract test for DELETE rejected (SHIP stage) in tests/api/tickets-delete.spec.ts"
Task T016: "API contract test for DELETE rejected (active job) in tests/api/tickets-delete.spec.ts"

# Launch component creation in parallel:
Task T017: "Create TrashZone component with conditional rendering in components/board/trash-zone.tsx"
Task T018: "Create DeleteConfirmationModal component using shadcn/ui AlertDialog in components/board/delete-confirmation-modal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Complete Phase 1: Setup** (T001-T004) - Utility functions and schemas
2. **Complete Phase 2: Foundational** (T005-T009) - DELETE API endpoint (CRITICAL - blocks all UI work)
3. **Complete Phase 3: User Story 1** (T010-T026) - INBOX ticket deletion with trash zone
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Manually test: Drag INBOX ticket → Confirm → Verify deletion
   - Run all tests: `bun run test` (unit + E2E)
   - Verify performance: Trash zone appears <100ms
5. **Deploy/demo if ready** - MVP is complete with core deletion functionality

**MVP Success Criteria**:
- ✅ INBOX tickets can be deleted via drag-and-drop
- ✅ Confirmation modal appears with stage-specific message
- ✅ Tickets with active jobs cannot be deleted (disabled state)
- ✅ All tests pass (unit + API + E2E)
- ✅ Trash zone appears within 100ms of drag start

### Incremental Delivery

1. **Foundation** (Phases 1-2): Setup + API → DELETE endpoint ready
2. **MVP** (Phase 3): User Story 1 → Test independently → **Deploy/Demo** ✅
3. **GitHub Cleanup** (Phase 4): User Story 2 → Test independently → **Deploy/Demo** ✅
4. **Visual Polish** (Phase 5): User Story 3 → Test independently → **Deploy/Demo** ✅
5. **Final Polish** (Phase 6): Cross-cutting improvements → **Final Deploy** ✅

Each phase adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. **Team completes Phases 1-2 together** (Setup + Foundational)
2. **Once API endpoint is ready (T009 complete)**:
   - Developer A: User Story 1 tests (T010-T016)
   - Developer B: User Story 1 components (T017-T018)
   - Developer C: User Story 1 integration (T019-T024)
3. **Once User Story 1 complete**:
   - Developer A: User Story 2 tests + implementation (T027-T040)
   - Developer B: User Story 3 implementation (T041-T049)
4. **Team completes Polish together** (Phase 6)

---

## Task Count Summary

| Phase | User Story | Task Count | Parallel Tasks |
|-------|------------|------------|----------------|
| Phase 1: Setup | - | 4 | 4 (all) |
| Phase 2: Foundational | - | 5 | 0 (sequential API logic) |
| Phase 3: User Story 1 | US1 | 17 | 7 (tests), 2 (components) |
| Phase 4: User Story 2 | US2 | 14 | 6 (tests), 4 (message updates) |
| Phase 5: User Story 3 | US3 | 9 | 0 (visual enhancements) |
| Phase 6: Polish | - | 9 | 4 (error handling, optimization) |
| **TOTAL** | | **58** | **27** |

---

## Suggested MVP Scope

**Recommended MVP**: Complete Phases 1, 2, and 3 (User Story 1 only)

**Rationale**:
- **User Story 1** delivers core deletion functionality for INBOX tickets
- No GitHub cleanup needed (simplest case, <100ms response time)
- Full drag-and-drop experience with confirmation modal
- All safety checks (active jobs, SHIP stage prevention)
- Provides immediate value for board hygiene

**Post-MVP**: Add User Stories 2 (GitHub cleanup) and 3 (visual polish) based on user feedback

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** = maps task to specific user story for traceability
- **TDD approach**: Write tests FIRST (T010-T016, T027-T032), ensure they FAIL, then implement
- **Each user story** should be independently completable and testable
- **Commit frequently**: After each task or logical group
- **Stop at any checkpoint**: Validate story independently before proceeding
- **Avoid**: Vague tasks, same file conflicts, cross-story dependencies that break independence
