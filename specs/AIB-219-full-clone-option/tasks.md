# Tasks: Full Clone Option for Ticket Duplication

**Input**: Design documents from `/specs/AIB-219-full-clone-option/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Tests are included per constitution principle III (Test-Driven) as specified in plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new utility files and prepare imports

- [ ] T001 [P] Create branch operations utility file at lib/github/branch-operations.ts with type exports from contracts/branch-operations.ts
- [ ] T002 [P] Verify shadcn/ui DropdownMenu component exists at components/ui/dropdown-menu.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement generateBranchName() function in lib/github/branch-operations.ts (slugify title, format: {ticketNumber}-{slug})
- [ ] T004 Implement createBranchFromSource() function in lib/github/branch-operations.ts using Octokit git.createRef() API
- [ ] T005 Add fullCloneTicket() function signature to lib/db/tickets.ts with proper TypeScript types

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Full Clone for Alternative Implementation (Priority: P1) 🎯 MVP

**Goal**: Enable users to clone tickets with preserved stage, jobs, and new branch for A/B testing implementations

**Independent Test**: Click Full Clone on a ticket in PLAN stage, verify new ticket has all jobs copied and a new branch exists

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [P] [US1] Create unit test for generateBranchName() in tests/unit/lib/branch-slug.test.ts (slugify, special chars, 3-word limit)
- [ ] T007 [P] [US1] Add integration test for full clone in tests/integration/tickets/duplicate.test.ts (creates ticket with correct stage, copies all jobs with telemetry)

### Implementation for User Story 1

- [ ] T008 [US1] Implement fullCloneTicket() in lib/db/tickets.ts using Prisma $transaction (copy ticket with "Clone of " prefix, preserve stage, copy all jobs with telemetry)
- [ ] T009 [US1] Extend POST handler in app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts to accept mode parameter and handle full clone
- [ ] T010 [US1] Add Zod validation for mode parameter ("simple" | "full") in duplicate route.ts
- [ ] T011 [US1] Integrate createBranchFromSource() call in duplicate route.ts for full clone mode
- [ ] T012 [US1] Add error handling for missing source branch (400 error with MISSING_BRANCH code)
- [ ] T013 [US1] Add error handling for branch creation failures (500 error with BRANCH_CREATION_FAILED code)

**Checkpoint**: Full clone API is functional - can be tested via API calls

---

## Phase 4: User Story 2 - Simple Copy Preservation (Priority: P2)

**Goal**: Ensure existing simple copy behavior remains accessible and unchanged

**Independent Test**: Click "Simple copy" option, verify ticket lands in INBOX without jobs or branch

### Tests for User Story 2

- [ ] T014 [US2] Add integration test in tests/integration/tickets/duplicate.test.ts verifying simple copy still works (INBOX stage, "Copy of " prefix, no jobs, no branch)

### Implementation for User Story 2

- [ ] T015 [US2] Replace Duplicate button with DropdownMenu in components/board/ticket-detail-modal.tsx
- [ ] T016 [US2] Add "Simple copy" DropdownMenuItem that calls existing duplicate logic with mode="simple"
- [ ] T017 [US2] Add ChevronDown icon to dropdown trigger button in ticket-detail-modal.tsx

**Checkpoint**: Simple copy and Full clone both work from dropdown menu

---

## Phase 5: User Story 3 - Full Clone Availability Control (Priority: P3)

**Goal**: Show Full clone option only for eligible stages (SPECIFY, PLAN, BUILD, VERIFY)

**Independent Test**: Check dropdown menu options across all ticket stages

### Tests for User Story 3

- [ ] T018 [US3] Create E2E test in tests/e2e/ticket-duplication.spec.ts for dropdown visibility by stage (Full clone hidden on INBOX/SHIP)

### Implementation for User Story 3

- [ ] T019 [US3] Add showFullClone computed variable in ticket-detail-modal.tsx based on ticket.stage
- [ ] T020 [US3] Conditionally render "Full clone" DropdownMenuItem only when showFullClone is true
- [ ] T021 [US3] Add GitBranch icon for "Full clone" option, Copy icon for "Simple copy" option

**Checkpoint**: Full clone option appears only on eligible stages

---

## Phase 6: User Story 4 - Clone Feedback (Priority: P4)

**Goal**: Provide clear feedback after duplication operations

**Independent Test**: Perform clone and verify toast notification appears with new ticket key

### Implementation for User Story 4

- [ ] T022 [US4] Add success toast notification in ticket-detail-modal.tsx showing "Cloned to {NEW_TICKET_KEY}" for full clone
- [ ] T023 [US4] Add success toast notification showing "Copied to {NEW_TICKET_KEY}" for simple copy
- [ ] T024 [US4] Add error toast notifications for full clone failures (branch not found, API errors)
- [ ] T025 [US4] Add loading state (Loader2 spinner) to dropdown trigger during duplication

**Checkpoint**: User receives clear feedback for all duplication operations

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T026 Run quickstart.md validation - verify all implementation steps complete
- [ ] T027 Verify all edge cases from spec.md are handled (missing branch, running jobs, rate limits, nested clones)
- [ ] T028 Run full test suite (unit + integration + E2E) to ensure all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - US1 (Phase 3): Core full clone - MVP
  - US2 (Phase 4): UI dropdown - requires US1 API to be callable
  - US3 (Phase 5): Stage filtering - requires US2 dropdown to exist
  - US4 (Phase 6): Feedback - requires US2 dropdown and US1 API
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 - Needs API to call
- **User Story 3 (P3)**: Can start after US2 - Needs dropdown to conditionally render
- **User Story 4 (P4)**: Can start after US2 - Needs dropdown for feedback

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Utility functions before API integration
- API implementation before UI implementation
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (Setup phase)
- T006 and T007 can run in parallel (US1 tests)
- All tests within a phase can be written in parallel

---

## Parallel Example: Phase 1 (Setup)

```bash
# Launch all setup tasks together:
Task: "Create branch operations utility file at lib/github/branch-operations.ts"
Task: "Verify shadcn/ui DropdownMenu component exists"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 tests together:
Task: "Create unit test for generateBranchName() in tests/unit/lib/branch-slug.test.ts"
Task: "Add integration test for full clone in tests/integration/tickets/duplicate.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Full clone API works)
4. **STOP and VALIDATE**: Test full clone via API calls
5. Can deploy backend-only if needed

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Full clone API functional (MVP!)
3. Add User Story 2 → Dropdown UI with both options
4. Add User Story 3 → Stage-based visibility
5. Add User Story 4 → User feedback complete
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- No database migrations required (uses existing schema)
- Existing patterns: shadcn/ui DropdownMenu from ProjectMenu.tsx, Octokit from delete-branch-and-prs.ts, Prisma $transaction from transition.ts

---

## Task Summary

| Phase | Story | Task Count |
|-------|-------|------------|
| Phase 1 | Setup | 2 |
| Phase 2 | Foundational | 3 |
| Phase 3 | US1 (P1) | 8 |
| Phase 4 | US2 (P2) | 4 |
| Phase 5 | US3 (P3) | 4 |
| Phase 6 | US4 (P4) | 4 |
| Phase 7 | Polish | 3 |
| **Total** | | **28** |
