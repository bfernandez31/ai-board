# Tasks: Testing Trophy Component Testing with React Testing Library

**Input**: Design documents from `/specs/AIB-121-testing-trophy-component/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: This feature adds RTL component tests as its primary deliverable.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No setup required - project already has Vitest and RTL dependencies installed

- [ ] T001 Verify RTL dependencies exist in package.json (@testing-library/react, @testing-library/dom, @testing-library/user-event)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Test infrastructure that MUST be complete before component tests can be written

**⚠️ CRITICAL**: No component test tasks (US3) can begin until this phase is complete

- [ ] T002 Create tests/unit/components/ directory structure for RTL component tests
- [ ] T003 Create component test utilities in tests/utils/component-test-utils.tsx with renderWithProviders() and createTestQueryClient()

**Checkpoint**: Infrastructure ready - component test implementation can now begin

---

## Phase 3: User Story 1 - AI Agent Writes Behavioral Component Tests (Priority: P1) 🎯 MVP

**Goal**: AI agents have clear RTL guidelines in constitution.md for when and how to write component tests

**Independent Test**: Read constitution.md and verify it contains RTL component testing guidelines following Testing Trophy methodology

### Implementation for User Story 1

- [ ] T004 [US1] Update .specify/memory/constitution.md to add RTL component testing layer to Testing Trophy table
- [ ] T005 [US1] Add query priority hierarchy (getByRole > getByLabelText > getByText > getByTestId) to constitution.md
- [ ] T006 [US1] Document userEvent vs fireEvent guidance in constitution.md (prefer userEvent)

**Checkpoint**: Constitution documentation complete - AI agents can reference RTL guidelines

---

## Phase 4: User Story 2 - Component Test Infrastructure Ready (Priority: P1)

**Goal**: Test utilities provide render wrapper, QueryClient setup, and re-exported RTL utilities

**Independent Test**: Import from tests/utils/component-test-utils.tsx and verify renderWithProviders, screen, userEvent are accessible

**Depends On**: Phase 2 (Foundational) for test utilities file

### Implementation for User Story 2

- [ ] T007 [US2] Implement createTestQueryClient() helper with retry: false and gcTime: 0 in tests/utils/component-test-utils.tsx
- [ ] T008 [US2] Implement renderWithProviders() wrapper with QueryClientProvider in tests/utils/component-test-utils.tsx
- [ ] T009 [US2] Re-export RTL utilities (screen, within, waitFor) from tests/utils/component-test-utils.tsx
- [ ] T010 [US2] Re-export userEvent from tests/utils/component-test-utils.tsx

**Checkpoint**: Test infrastructure ready - component tests can import utilities

---

## Phase 5: User Story 3 - High-Priority Components Have Tests (Priority: P2)

**Goal**: 5+ interactive components have RTL tests verifying user behavior

**Independent Test**: Run `bun run test:unit` and verify component tests in tests/unit/components/ pass

**Depends On**: Phase 2 (Foundational) and Phase 4 (US2) for test utilities

### Implementation for User Story 3

- [ ] T011 [P] [US3] Create RTL test for NewTicketModal in tests/unit/components/new-ticket-modal.test.tsx (form submission, validation, ESC to close)
- [ ] T012 [P] [US3] Create RTL test for QuickImplModal in tests/unit/components/quick-impl-modal.test.tsx (confirm/cancel behavior, keyboard accessibility)
- [ ] T013 [P] [US3] Create RTL test for DeleteConfirmationModal in tests/unit/components/delete-confirmation-modal.test.tsx (confirmation flow, danger action)
- [ ] T014 [P] [US3] Create RTL test for TicketSearch in tests/unit/components/ticket-search.test.tsx (search input, results display, keyboard navigation)
- [ ] T015 [P] [US3] Create RTL test for CommentForm in tests/unit/components/comment-form.test.tsx (text input, Cmd/Ctrl+Enter submission)

**Checkpoint**: 5 component tests complete - `bun run test:unit` passes with new RTL tests

---

## Phase 6: User Story 4 - Documentation Guides Testing Decisions (Priority: P2)

**Goal**: CLAUDE.md clearly explains when to use RTL vs unit vs E2E tests

**Independent Test**: Read CLAUDE.md Testing Guidelines section and verify test type decision criteria are documented

**Depends On**: Phase 3 (US1) for constitution documentation to be complete first

### Implementation for User Story 4

- [ ] T016 [US4] Update CLAUDE.md Testing Guidelines table to add RTL component test type
- [ ] T017 [US4] Add "When to Use Which Test Type" decision tree in CLAUDE.md with RTL component criteria
- [ ] T018 [US4] Add RTL integration test pattern example in CLAUDE.md (similar to existing unit/integration/E2E patterns)

**Checkpoint**: CLAUDE.md documentation complete - AI agents can make correct testing decisions

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T019 Run `bun run test:unit` to verify all component tests pass
- [ ] T020 Run `bun run type-check` to verify no TypeScript errors introduced
- [ ] T021 Verify constitution.md and CLAUDE.md are consistent in their RTL guidance

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verify existing deps
- **Foundational (Phase 2)**: Depends on Setup - creates directory and test utils file
- **User Story 1 (Phase 3)**: Can start after Setup - constitution updates independent of code
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) - needs test utils file created
- **User Story 3 (Phase 5)**: Depends on User Story 2 (Phase 4) - needs test utilities implemented
- **User Story 4 (Phase 6)**: Can start after User Story 1 (Phase 3) - extends documentation
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - can start immediately after Setup
- **User Story 2 (P1)**: Depends on Foundational - needs test utils file
- **User Story 3 (P2)**: Depends on User Story 2 - needs renderWithProviders utility
- **User Story 4 (P2)**: Depends on User Story 1 - CLAUDE.md should reference constitution

### Within Each User Story

- Documentation updates can be done in sequence (same file)
- Component tests marked [P] can run in parallel (different files)

### Parallel Opportunities

- **Phase 3 (US1)** and **Phase 2 (Foundational)** can run in parallel
- **Phase 5 (US3)**: All 5 component tests (T011-T015) can run in parallel
- **Phase 6 (US4)** can run in parallel with **Phase 5 (US3)**

---

## Parallel Example: User Story 3 (Component Tests)

```bash
# Launch all component tests in parallel (all [P] tasks):
Task: "Create RTL test for NewTicketModal in tests/unit/components/new-ticket-modal.test.tsx"
Task: "Create RTL test for QuickImplModal in tests/unit/components/quick-impl-modal.test.tsx"
Task: "Create RTL test for DeleteConfirmationModal in tests/unit/components/delete-confirmation-modal.test.tsx"
Task: "Create RTL test for TicketSearch in tests/unit/components/ticket-search.test.tsx"
Task: "Create RTL test for CommentForm in tests/unit/components/comment-form.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup (verify deps)
2. Complete Phase 2: Foundational (directory + test utils file)
3. Complete Phase 3: User Story 1 (constitution documentation)
4. Complete Phase 4: User Story 2 (test utilities implementation)
5. **STOP and VALIDATE**: Test utilities work by creating a simple test

### Incremental Delivery

1. Complete Setup + Foundational + US1 + US2 → Infrastructure ready
2. Add User Story 3 → Test independently → 5 component tests passing
3. Add User Story 4 → Test independently → CLAUDE.md complete
4. Polish phase → All tests pass, documentation consistent

### Parallel Execution Strategy

ai-board can execute in parallel after Foundational:

1. Complete Setup + Foundational sequentially
2. Once Foundational is done:
   - Parallel track A: User Story 1 (constitution)
   - Parallel track B: User Story 2 (test utilities)
3. Once US2 is done:
   - Parallel track: User Story 3 (all 5 component tests in parallel)
   - Parallel track: User Story 4 (CLAUDE.md, after US1)
4. Polish phase after all complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- RTL tests follow query priority: getByRole > getByLabelText > getByText > getByTestId
- Use userEvent over fireEvent for realistic user interactions
- Test behavior, not implementation details
- Component tests run as part of `bun run test:unit` via Vitest + happy-dom
