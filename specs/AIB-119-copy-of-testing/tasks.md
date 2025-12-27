# Tasks: React Testing Library Component Testing Integration

**Input**: Design documents from `/specs/AIB-119-copy-of-testing/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: This feature includes RTL component tests as the primary deliverable. Tests are written as implementation tasks, not as TDD test-first approach.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create test helper infrastructure for RTL component tests

- [x] T001 Create test directory structure at `tests/unit/components/helpers/`
- [x] T002 [P] Implement TestWrapper component with QueryClientProvider in `tests/unit/components/helpers/test-wrapper.tsx`
- [x] T003 [P] Implement renderWithProviders function in `tests/unit/components/helpers/render-helpers.ts`
- [x] T004 [P] Implement type-safe mock data factories in `tests/unit/components/helpers/factories.ts`
- [x] T005 [P] Implement Next.js navigation mocks in `tests/unit/components/helpers/next-mocks.ts`

**Checkpoint**: Test helper infrastructure ready - component tests can now be written

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify test infrastructure works before implementing user story tests

**⚠️ CRITICAL**: No user story component tests can begin until this phase is complete

- [x] T006 Create smoke test to validate test wrapper works in `tests/unit/components/helpers/test-wrapper.test.tsx`
- [x] T007 Verify factories return correct Prisma types by running TypeScript check

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Developer Tests Interactive Board Components (Priority: P1) 🎯 MVP

**Goal**: Write RTL tests for board components (TicketCard, StageColumn, NewTicketModal) to verify ticket display, click interactions, and modal behaviors

**Independent Test**: Run `bunx vitest tests/unit/components/board/` - all board component tests pass

### Implementation for User Story 1

- [x] T008 [P] [US1] Create board test directory at `tests/unit/components/board/`
- [x] T009 [US1] Write TicketCard component tests in `tests/unit/components/board/ticket-card.test.tsx`
  - Test: displays ticket key and title
  - Test: shows workflow type badge (QUICK, FULL, CLEAN)
  - Test: calls onTicketClick when card is clicked
  - Test: shows job status indicator when jobs are present
- [x] T010 [US1] Write NewTicketModal component tests in `tests/unit/components/board/new-ticket-modal.test.tsx`
  - Test: renders form fields for title and description
  - Test: validates required title field
  - Test: calls onSubmit with form data when submitted
  - Test: closes modal on cancel
- [x] T011 [US1] Write StageColumn component tests in `tests/unit/components/board/stage-column.test.tsx`
  - Test: displays column heading with stage name
  - Test: renders all ticket cards in the column
  - Test: shows empty state when no tickets

**Checkpoint**: Board component tests complete - core kanban functionality verified

---

## Phase 4: User Story 2 - Developer Tests Comment Form Interactions (Priority: P2)

**Goal**: Write RTL tests for comment components (CommentForm, CommentList) to verify form submission, keyboard shortcuts, and content display

**Independent Test**: Run `bunx vitest tests/unit/components/comments/` - all comment component tests pass

### Implementation for User Story 2

- [x] T012 [P] [US2] Create comments test directory at `tests/unit/components/comments/`
- [x] T013 [US2] Write CommentForm component tests in `tests/unit/components/comments/comment-form.test.tsx`
  - Test: renders textarea for comment input
  - Test: calls onSubmit with comment content when form is submitted
  - Test: disables submit button when input is empty
  - Test: clears input after successful submission
- [x] T014 [US2] Write CommentList component tests in `tests/unit/components/comments/comment-list.test.tsx`
  - Test: renders all comments with author and content
  - Test: displays timestamps for each comment
  - Test: shows empty state when no comments

**Checkpoint**: Comment component tests complete - comment functionality verified

---

## Phase 5: User Story 3 - Developer Tests Project Components (Priority: P3)

**Goal**: Write RTL tests for project components (ProjectCard, EmptyProjectsState) to verify project display, copy functionality, and empty states

**Independent Test**: Run `bunx vitest tests/unit/components/projects/` - all project component tests pass

### Implementation for User Story 3

- [x] T015 [P] [US3] Create projects test directory at `tests/unit/components/projects/`
- [x] T016 [US3] Write ProjectCard component tests in `tests/unit/components/projects/project-card.test.tsx`
  - Test: displays project name and key
  - Test: shows ticket count
  - Test: copies project key to clipboard when copy button clicked
  - Test: shows copy success feedback
  - Test: navigates to project board when card is clicked
- [x] T017 [US3] Write EmptyProjectsState component tests in `tests/unit/components/projects/empty-projects-state.test.tsx`
  - Test: displays empty state message
  - Test: shows create project action button

**Checkpoint**: Project component tests complete - project functionality verified

---

## Phase 6: User Story 4 - Documentation Updated with RTL Testing Guidelines (Priority: P1)

**Goal**: Update constitution and CLAUDE.md with RTL component testing guidelines for team consistency

**Independent Test**: Review documentation for completeness - Testing Trophy includes RTL layer, CLAUDE.md explains when to use RTL vs other test types

### Implementation for User Story 4

- [x] T018 [P] [US4] Update constitution.md with RTL component testing as part of Testing Trophy strategy in `.specify/constitution.md`
- [x] T019 [P] [US4] Update CLAUDE.md Testing Guidelines section with RTL component test guidance in `CLAUDE.md`
  - Add: When to use RTL component tests vs unit/integration/E2E
  - Add: Component test file location (`tests/unit/components/`)
  - Add: Query priority (getByRole > getByLabelText > getByText > getByTestId)
- [x] T020 [US4] Verify test commands include component tests by running `bun run test:unit` and confirming new tests execute

**Checkpoint**: Documentation complete - team can write consistent RTL tests

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T021 Run full test suite with `bun run test:unit` to verify all component tests pass
- [x] T022 Run TypeScript check with `bun run type-check` to verify no type errors
- [x] T023 Validate test execution time is under 2 seconds for all component tests
- [x] T024 Run quickstart.md validation - verify examples in quickstart.md work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (Board) and US4 (Docs) are both P1 - can run in parallel
  - US2 (Comments) and US3 (Projects) can run in parallel after Foundational
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (documentation only)

### Within Each User Story

- Create directory before writing tests
- Tests can be written in any order within a story
- All tests should pass independently

### Parallel Opportunities

- T002, T003, T004, T005 (Setup helpers) can all run in parallel
- T008, T012, T015 (directory creation) can run in parallel after Foundational
- T018, T019 (documentation updates) can run in parallel
- All user stories can be worked on in parallel by different team members after Foundational completes

---

## Parallel Example: Setup Phase

```bash
# Launch all helper creation tasks together:
Task: "Implement TestWrapper in tests/unit/components/helpers/test-wrapper.tsx"
Task: "Implement renderWithProviders in tests/unit/components/helpers/render-helpers.ts"
Task: "Implement factories in tests/unit/components/helpers/factories.ts"
Task: "Implement next-mocks in tests/unit/components/helpers/next-mocks.ts"
```

---

## Parallel Example: User Story 1 (Board)

```bash
# After directory created, tests can be written in parallel if different developers:
Task: "Write TicketCard tests in tests/unit/components/board/ticket-card.test.tsx"
Task: "Write NewTicketModal tests in tests/unit/components/board/new-ticket-modal.test.tsx"
Task: "Write StageColumn tests in tests/unit/components/board/stage-column.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 4)

1. Complete Phase 1: Setup (test helpers)
2. Complete Phase 2: Foundational (validate infrastructure)
3. Complete Phase 3: User Story 1 (Board component tests)
4. Complete Phase 6: User Story 4 (Documentation)
5. **STOP and VALIDATE**: Board tests pass, docs are complete
6. Deploy/demo - core RTL testing infrastructure is usable

### Incremental Delivery

1. Complete Setup + Foundational → Test infrastructure ready
2. Add User Story 1 (Board) → Test independently → Core MVP!
3. Add User Story 4 (Docs) → Documentation complete → Team can use
4. Add User Story 2 (Comments) → Test independently → Expanded coverage
5. Add User Story 3 (Projects) → Test independently → Full coverage
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Board tests)
   - Developer B: User Story 4 (Documentation)
   - Developer C: User Story 2 (Comments) or User Story 3 (Projects)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Use `renderWithProviders` from helpers for all component tests
- Follow query priority: getByRole > getByLabelText > getByText > getByTestId
- Use `userEvent.setup()` for all user interactions
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: testing implementation details, using fireEvent instead of userEvent
