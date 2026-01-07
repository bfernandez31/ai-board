# Tasks: Fix Display Closed Ticket Modal

**Input**: Design documents from `/specs/AIB-156-fix-display-closed/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: REQUIRED - User explicitly requested tests ("add some test") and Constitution III mandates test-driven development.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add query key and hook infrastructure required by all user stories

- [ ] T001 Add `ticketByKey` query key factory in app/lib/query-keys.ts
- [ ] T002 Add `useTicketByKey` hook in app/lib/hooks/queries/useTickets.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core state and hook integration in board component - MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Add `pendingTicketKey` state variable in components/board/board.tsx
- [ ] T004 Add `useTicketByKey` hook call in components/board/board.tsx

**Checkpoint**: Foundation ready - query infrastructure in place

---

## Phase 3: User Story 1 - View Closed Ticket from Search (Priority: P1) 🎯 MVP

**Goal**: When a user clicks on a closed ticket in search results, the modal opens with ticket details in read-only mode

**Independent Test**: Search for a closed ticket, click on it, verify modal opens with all ticket details visible

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T005 [P] [US1] Integration test for ticket-by-key API lookup in tests/integration/tickets/ticket-by-key.test.ts
- [ ] T006 [P] [US1] RTL component test for modal opening from search in tests/unit/components/board-modal-open.test.tsx

### Implementation for User Story 1

- [ ] T007 [US1] Modify URL parameter useEffect to set pendingTicketKey when ticket not in allTickets in components/board/board.tsx
- [ ] T008 [US1] Add useEffect to handle fetchedTicket and open modal in components/board/board.tsx
- [ ] T009 [US1] Update selectedTicket useMemo to include fetchedTicket fallback in components/board/board.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - clicking closed tickets in search opens the modal

---

## Phase 4: User Story 2 - Direct URL Access to Closed Ticket (Priority: P2)

**Goal**: User can navigate directly to a URL with a closed ticket key and the modal opens

**Independent Test**: Navigate to `/projects/1/board?ticket=AIB-123&modal=open` where AIB-123 is a closed ticket - modal should open

### Tests for User Story 2 ⚠️

- [ ] T010 [US2] Integration test for direct URL navigation with closed ticket in tests/integration/tickets/ticket-by-key.test.ts

### Implementation for User Story 2

**Note**: Implementation covered by US1 - the URL parameter handling in T007 and T008 already handles direct URL access. This phase validates the behavior works for the direct URL use case.

- [ ] T011 [US2] Verify URL parameter handling works for direct navigation (bookmarks, shared links) in components/board/board.tsx

**Checkpoint**: Direct URL access to closed tickets works - users can share/bookmark closed ticket URLs

---

## Phase 5: User Story 3 - Error Handling for Non-Existent Tickets (Priority: P3)

**Goal**: Gracefully handle cases where ticket key in URL doesn't exist (no modal, no errors)

**Independent Test**: Navigate to URL with non-existent ticket key - modal should not open, no console errors

### Tests for User Story 3 ⚠️

- [ ] T012 [US3] Integration test for 404 response when ticket not found in tests/integration/tickets/ticket-by-key.test.ts

### Implementation for User Story 3

- [ ] T013 [US3] Handle null fetchedTicket case (ticket not found) in useEffect in components/board/board.tsx

**Checkpoint**: Error handling complete - invalid ticket keys handled gracefully

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T014 Run type-check to verify no TypeScript errors: `bun run type-check`
- [ ] T015 Run unit tests: `bun run test:unit`
- [ ] T016 Run integration tests: `bun run test:integration`
- [ ] T017 Run quickstart.md manual verification steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 is MVP and should be completed first
  - US2 validates URL behavior (mostly implemented by US1)
  - US3 adds error handling
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Validates behavior implemented by US1 - can run after US1
- **User Story 3 (P3)**: Adds error handling to US1/US2 - can start after Foundational but best after US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Query key before hook
- State before hook usage
- URL handler before fetchedTicket handler
- Story complete before moving to next priority

### Parallel Opportunities

- Setup tasks T001 and T002 must be sequential (hook depends on query key)
- Foundational tasks T003 and T004 must be sequential (hook usage depends on state)
- Test tasks T005 and T006 can run in parallel (different files)
- All Polish tasks T014-T017 must run sequentially (each validates previous work)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch test tasks in parallel:
Task: "Integration test for ticket-by-key API lookup in tests/integration/tickets/ticket-by-key.test.ts"
Task: "RTL component test for modal opening from search in tests/unit/components/board-modal-open.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T004)
3. Complete Phase 3: User Story 1 (T005-T009)
4. **STOP and VALIDATE**: Test US1 independently - search for closed ticket, verify modal opens
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (validates URL sharing)
4. Add User Story 3 → Test independently → Deploy/Demo (adds robustness)
5. Each story adds value without breaking previous stories

### File Modification Summary

| File | Tasks | Changes |
|------|-------|---------|
| `app/lib/query-keys.ts` | T001 | Add `ticketByKey` query key |
| `app/lib/hooks/queries/useTickets.ts` | T002 | Add `useTicketByKey` hook |
| `components/board/board.tsx` | T003, T004, T007, T008, T009, T011, T013 | State, hook, URL handling, selectedTicket |
| `tests/integration/tickets/ticket-by-key.test.ts` | T005, T010, T012 | NEW: Integration tests |
| `tests/unit/components/board-modal-open.test.tsx` | T006 | NEW: RTL component tests |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No new API endpoint needed - uses existing `/api/projects/{projectId}/tickets/{identifier}`
- Closed tickets display in read-only mode (existing behavior in modal)
