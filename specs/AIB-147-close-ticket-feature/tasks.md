# Tasks: Close Ticket Feature

**Input**: Design documents from `/specs/AIB-147-close-ticket-feature/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are NOT included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Schema & Core Infrastructure)

**Purpose**: Database schema changes and foundational stage logic

- [x] T001 Add CLOSED to Stage enum and closedAt field to Ticket model in prisma/schema.prisma
- [x] T002 Run prisma migrate dev to create migration for CLOSED stage and closedAt field
- [x] T003 Add CLOSED to Stage type and update isTerminalStage() function in lib/stage-transitions.ts
- [x] T004 [P] Add isCloseTransition() helper function in lib/stage-transitions.ts
- [x] T005 [P] Add canCloseTicket() validation function in lib/stage-transitions.ts

---

## Phase 2: Foundational (GitHub & Database Operations)

**Purpose**: Core operations that multiple user stories depend on

**⚠️ CRITICAL**: User stories 1-3 depend on these completing first

- [x] T006 Create closePRsOnly() function in lib/github/close-prs-only.ts (find PRs by branch, add comment, close without deleting branch)
- [x] T007 Create closeTicket() function in lib/db/tickets.ts (atomic update of stage to CLOSED and set closedAt timestamp)
- [x] T008 Update board ticket query to exclude CLOSED tickets in lib/db/tickets.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Close Ticket from VERIFY Stage (Priority: P1) 🎯 MVP

**Goal**: Allow users to close tickets from VERIFY stage via drag-and-drop with confirmation

**Independent Test**: Drag a ticket from VERIFY toward SHIP, drop on Close zone, confirm in modal, verify ticket disappears from board

### Implementation for User Story 1

- [x] T009 [US1] Extend transition endpoint Zod schema to accept CLOSED as valid targetStage in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [x] T010 [US1] Implement VERIFY → CLOSED transition logic in app/api/projects/[projectId]/tickets/[id]/transition/route.ts (call canCloseTicket, closeTicket, closePRsOnly)
- [x] T011 [US1] Create CloseConfirmationModal component using AlertDialog in components/board/close-confirmation-modal.tsx
- [x] T012 [US1] Create useCloseTicket mutation hook in app/lib/hooks/mutations/useCloseTicket.ts
- [x] T013 [US1] Add Close zone drop handling and open CloseConfirmationModal in components/board/board.tsx

**Checkpoint**: User Story 1 complete - tickets can be closed from VERIFY stage with confirmation

---

## Phase 4: User Story 2 - Search for Closed Tickets (Priority: P2)

**Goal**: Allow users to find closed tickets via search and view them in read-only mode

**Independent Test**: Close a ticket, search for it by key/title, verify it appears with muted styling and Closed badge, click to open read-only modal

### Implementation for User Story 2

- [x] T014 [US2] Add closedAt to search endpoint select fields in app/api/projects/[projectId]/tickets/search/route.ts
- [x] T015 [US2] Add muted styling and Closed badge for CLOSED tickets in components/tickets/ticket-search-result.tsx
- [x] T016 [US2] Add isReadOnly prop and closed state banner to ticket detail modal in components/tickets/ticket-detail-modal.tsx (disable edit controls when stage is CLOSED)

**Checkpoint**: User Story 2 complete - closed tickets searchable and viewable in read-only mode

---

## Phase 5: User Story 3 - Ship Zone Split During Drag (Priority: P2)

**Goal**: Display dual drop zones (Ship/Close) when dragging from VERIFY to SHIP column

**Independent Test**: Start dragging a ticket from VERIFY, observe SHIP column splits into Ship zone (top 60%, purple solid border) and Close zone (bottom 40%, red dashed border)

### Implementation for User Story 3

- [x] T017 [US3] Create CloseZone droppable component with red dashed border and Archive icon in components/board/close-zone.tsx
- [x] T018 [US3] Detect drag source stage using useDndContext in components/board/stage-column.tsx
- [x] T019 [US3] Implement conditional dual zone rendering (ShipZone 60% + CloseZone 40%) when dragSource is VERIFY in components/board/stage-column.tsx

**Checkpoint**: User Story 3 complete - dual drop zones appear when dragging from VERIFY

---

## Phase 6: User Story 4 - Validation Blocking Closure (Priority: P3)

**Goal**: Prevent ticket closure when conditions are unsafe (active jobs, cleanup locks)

**Independent Test**: Attempt to close a ticket with PENDING/RUNNING job, verify error message appears and closure is blocked

### Implementation for User Story 4

- [x] T020 [US4] Add active job check (PENDING/RUNNING status) to VERIFY → CLOSED transition in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [x] T021 [US4] Add cleanup lock check returning HTTP 423 for VERIFY → CLOSED transition in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [x] T022 [US4] Add CLOSED as terminal stage with no outbound transitions in lib/stage-transitions.ts (prevent CLOSED → any transition)

**Checkpoint**: User Story 4 complete - invalid closure attempts are blocked with appropriate feedback

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and integration

- [x] T023 Verify CLOSED tickets excluded from all board columns (regression check)
- [x] T024 Verify PR closure is idempotent (no error when no PR exists or PR already closed)
- [x] T025 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - core close functionality
- **User Story 2 (Phase 4)**: Depends on Foundational - can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 (needs close zone handling) - enhances UX
- **User Story 4 (Phase 6)**: Depends on Foundational - can run in parallel with US1/US2
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational - **MVP, must complete first**
- **User Story 2 (P2)**: After Foundational - independent of US1, can parallelize
- **User Story 3 (P2)**: After US1 - depends on close zone drop handling in board.tsx
- **User Story 4 (P3)**: After Foundational - independent of other stories, can parallelize

### Within Each User Story

- API changes before UI components
- UI components before integration
- Story complete before moving to dependent stories

### Parallel Opportunities

**Phase 1 (Setup):**
```
T003 (stage-transitions.ts) → T004, T005 can run in parallel after T003
```

**Phase 2 (Foundational):**
```
T006 (close-prs-only.ts), T007 (tickets.ts), T008 (tickets.ts query) - T006 parallel with T007/T008
```

**After Foundational - User Stories can parallelize:**
```
US1 (T009-T013) | US2 (T014-T016) | US4 (T020-T022) - all can start after Phase 2
US3 (T017-T019) - must wait for US1 T013 (board.tsx close handling)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T008)
3. Complete Phase 3: User Story 1 (T009-T013)
4. **STOP and VALIDATE**: Close a ticket from VERIFY via API
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test close from VERIFY → MVP!
3. Add User Story 2 → Search finds closed tickets → Enhanced discoverability
4. Add User Story 3 → Dual drop zones → Full UX
5. Add User Story 4 → Validation blocking → Production safety

### Parallel Execution Strategy

ai-board can execute after Foundational:

1. Complete Setup + Foundational phases sequentially (T001-T008)
2. Once Foundational is done, parallelize:
   - Parallel task 1: User Story 1 (T009-T013)
   - Parallel task 2: User Story 2 (T014-T016)
   - Parallel task 3: User Story 4 (T020-T022)
3. After US1 completes: User Story 3 (T017-T019)
4. Polish phase (T023-T025)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- CLOSED is a terminal state - no outbound transitions allowed
- Branch preservation is critical (FR-008) - never delete branch on close
- PR closure is best-effort with retry logic for GitHub API rate limits
