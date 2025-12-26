# Tasks: Testing Trophy Component Integration

**Input**: Design documents from `/specs/AIB-117-testing-trophy-component/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included - this feature is specifically about implementing component tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and test utility creation

- [ ] T001 Create render-with-providers utility in tests/helpers/render-with-providers.tsx
- [ ] T002 Create component mock fixtures in tests/fixtures/component-mocks.ts
- [ ] T003 [P] Create tests/integration/components/ directory structure

---

## Phase 2: Foundational (Documentation Updates)

**Purpose**: Update constitution and CLAUDE.md to document the component testing layer

**⚠️ CRITICAL**: Documentation must be complete before component tests are written to ensure consistent patterns

- [ ] T004 [P] Update .specify/memory/constitution.md with component testing section (add row to Testing Trophy table, update Test Selection Decision Tree)
- [ ] T005 [P] Update CLAUDE.md with component testing guidelines (add Component Integration Tests row to Testing Guidelines table, add When to Use Component Tests section)

**Checkpoint**: Foundation ready - component test implementation can now begin

---

## Phase 3: User Story 1 - Set Up Component Testing Infrastructure (Priority: P1) 🎯 MVP

**Goal**: Developers can run component integration tests using `bun run test:integration`

**Independent Test**: Run `bun run test:integration` and verify component tests in `tests/integration/components/` execute successfully

### Implementation for User Story 1

- [ ] T006 [US1] Implement renderWithProviders function with QueryClientProvider wrapper in tests/helpers/render-with-providers.tsx
- [ ] T007 [US1] Implement TestProviders wrapper component in tests/helpers/render-with-providers.tsx
- [ ] T008 [US1] Add re-exports for testing-library utilities in tests/helpers/render-with-providers.tsx
- [ ] T009 [US1] Create mock project member fixtures in tests/fixtures/component-mocks.ts
- [ ] T010 [US1] Create mock ticket fixtures in tests/fixtures/component-mocks.ts
- [ ] T011 [US1] Verify Vitest configuration discovers tests in tests/integration/components/ directory

**Checkpoint**: Infrastructure complete - can now write component tests with proper provider wrapping

---

## Phase 4: User Story 2 - Test Form Components with User Interactions (Priority: P1)

**Goal**: Integration tests for NewTicketModal and CommentForm covering validation, submission, and keyboard shortcuts

**Independent Test**: Run `bun run test:integration tests/integration/components/new-ticket-modal.test.tsx` and verify all form validation and submission tests pass

### Implementation for User Story 2

- [ ] T012 [P] [US2] Create new-ticket-modal.test.tsx in tests/integration/components/
- [ ] T013 [P] [US2] Create comment-form.test.tsx in tests/integration/components/
- [ ] T014 [US2] Implement NewTicketModal form validation tests (empty title, short title, long description) in tests/integration/components/new-ticket-modal.test.tsx
- [ ] T015 [US2] Implement NewTicketModal form submission tests (valid data, API error handling) in tests/integration/components/new-ticket-modal.test.tsx
- [ ] T016 [US2] Implement NewTicketModal modal behavior tests (open/close, escape key) in tests/integration/components/new-ticket-modal.test.tsx
- [ ] T017 [US2] Implement CommentForm text input and Cmd+Enter submission tests in tests/integration/components/comment-form.test.tsx
- [ ] T018 [US2] Implement CommentForm loading and error state tests in tests/integration/components/comment-form.test.tsx

**Checkpoint**: Form component tests complete - NewTicketModal and CommentForm have 3+ integration tests each

---

## Phase 5: User Story 3 - Test Search and Autocomplete Components (Priority: P2)

**Goal**: Integration tests for TicketSearch and MentionInput covering debouncing, keyboard navigation, and result selection

**Independent Test**: Run `bun run test:integration tests/integration/components/ticket-search.test.tsx` and verify debounce and keyboard navigation tests pass

### Implementation for User Story 3

- [ ] T019 [P] [US3] Create ticket-search.test.tsx in tests/integration/components/
- [ ] T020 [P] [US3] Create mention-input.test.tsx in tests/integration/components/
- [ ] T021 [US3] Implement TicketSearch debounce tests with fake timers in tests/integration/components/ticket-search.test.tsx
- [ ] T022 [US3] Implement TicketSearch keyboard navigation tests (ArrowUp/Down, Enter, Escape) in tests/integration/components/ticket-search.test.tsx
- [ ] T023 [US3] Implement TicketSearch result selection tests in tests/integration/components/ticket-search.test.tsx
- [ ] T024 [US3] Implement MentionInput @ trigger behavior tests in tests/integration/components/mention-input.test.tsx
- [ ] T025 [US3] Implement MentionInput user filtering tests in tests/integration/components/mention-input.test.tsx
- [ ] T026 [US3] Implement MentionInput mention selection and insertion tests in tests/integration/components/mention-input.test.tsx

**Checkpoint**: Search and autocomplete tests complete - TicketSearch and MentionInput have 3+ integration tests each

---

## Phase 6: User Story 4 - Test Modal and Confirmation Components (Priority: P3)

**Goal**: Integration tests for modal components verifying confirmation flows and callbacks

**Independent Test**: Run tests for modal components and verify confirm/cancel callbacks work correctly

### Implementation for User Story 4

- [ ] T027 [P] [US4] Identify modal components requiring tests (CleanupConfirmDialog, DeleteConfirmationModal, or similar) by examining components/ directory
- [ ] T028 [US4] Create modal component test file(s) in tests/integration/components/
- [ ] T029 [US4] Implement modal visibility tests (renders when open, hidden when closed) in modal test file(s)
- [ ] T030 [US4] Implement modal callback tests (confirm triggers action, cancel closes) in modal test file(s)
- [ ] T031 [US4] Implement modal loading state tests (loading indicator during async action) in modal test file(s)

**Checkpoint**: Modal component tests complete - confirmation dialogs have 3+ integration tests each

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup

- [ ] T032 [P] Run full test suite with `bun run test:integration` to verify all component tests pass
- [ ] T033 [P] Verify component tests execute in <500ms each (per SC-002)
- [ ] T034 Run quickstart.md validation by following the guide to write a new component test
- [ ] T035 Update quickstart.md with any discovered improvements or corrections

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - documentation must be updated first
- **User Story 1 (Phase 3)**: Depends on Foundational - infrastructure implementation
- **User Stories 2-4 (Phases 4-6)**: Depend on User Story 1 completion - need working renderWithProviders utility
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - BLOCKS other stories
- **User Story 2 (P1)**: Can start after User Story 1 - No dependencies on US3/US4
- **User Story 3 (P2)**: Can start after User Story 1 - No dependencies on US2/US4
- **User Story 4 (P3)**: Can start after User Story 1 - No dependencies on US2/US3

### Within Each User Story

- File creation tasks can run in parallel ([P] marked)
- Test implementation tasks should be sequential within a component
- Story complete when all tests pass

### Parallel Opportunities

- T003, T004, T005 can run in parallel (different files)
- T012, T013 can run in parallel (different test files)
- T019, T020 can run in parallel (different test files)
- T032, T033 can run in parallel (different validation tasks)

---

## Parallel Example: User Story 2

```bash
# Launch test file creation in parallel:
Task: "Create new-ticket-modal.test.tsx in tests/integration/components/"
Task: "Create comment-form.test.tsx in tests/integration/components/"

# Then implement tests sequentially within each file
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005)
3. Complete Phase 3: User Story 1 (T006-T011)
4. Complete Phase 4: User Story 2 (T012-T018)
5. **STOP and VALIDATE**: Run `bun run test:integration` and verify form component tests pass
6. MVP delivers: Working component test infrastructure + form component tests

### Incremental Delivery

1. Complete Setup + Foundational + US1 → Infrastructure ready
2. Add User Story 2 → Form tests (NewTicketModal, CommentForm) → Validate
3. Add User Story 3 → Search tests (TicketSearch, MentionInput) → Validate
4. Add User Story 4 → Modal tests → Validate
5. Complete Polish phase → Full validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story delivers independently testable component tests
- US2 and US3 are both high-value (form and search components are most complex)
- Verify each component has 3+ tests before marking story complete (per SC-001)
- Component tests should execute in <500ms each (per SC-002)
