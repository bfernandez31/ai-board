# Tasks: React Component Testing with Testing Library

**Input**: Design documents from `/specs/AIB-120-copy-of-copy/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Tests are explicitly part of this feature (SC-001 requires 3+ component tests). Component test creation is a core deliverable.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify infrastructure and create directory structure

- [ ] T001 Verify RTL packages are installed (check package.json for @testing-library/react, @testing-library/dom, happy-dom)
- [ ] T002 Verify Vitest is configured with happy-dom environment in vitest.config.mts
- [ ] T003 Create tests/unit/components/ directory structure

---

## Phase 2: User Story 1 - Run Component Tests (Priority: P1) - MVP

**Goal**: AI agents can run component tests to verify React component behavior with `bun run test:unit`

**Independent Test**: Run `bun run test:unit tests/unit/components/` and verify RTL-based tests execute and pass

### Implementation for User Story 1

- [ ] T004 [P] [US1] Create CommentForm component test in tests/unit/components/comment-form.test.ts
  - Test keyboard shortcuts (Cmd+Enter to submit)
  - Test character limit validation
  - Test loading and error states from TanStack Query mutation
- [ ] T005 [P] [US1] Create NewTicketModal component test in tests/unit/components/new-ticket-modal.test.ts
  - Test Zod form validation
  - Test field error display
  - Test form submission handling
- [ ] T006 [P] [US1] Create TicketSearch component test in tests/unit/components/ticket-search.test.ts
  - Test keyboard navigation (ArrowUp/Down, Enter, Escape)
  - Test debounced input behavior
  - Test dropdown visibility states
- [ ] T007 [US1] Verify all component tests execute under 100ms each (SC-004 requirement)
- [ ] T008 [US1] Verify `bun run test:unit` passes with new component tests (SC-005 requirement)

**Checkpoint**: User Story 1 complete - 3+ component tests pass, meeting SC-001

---

## Phase 3: User Story 2 - Create Component Tests Using Skill (Priority: P1)

**Goal**: AI agents can invoke `/component-testing` skill to generate appropriate test files following established patterns

**Independent Test**: Invoke `/component-testing` skill in Claude and verify it provides correct RTL guidance

### Implementation for User Story 2

- [ ] T009 [US2] Create Claude skill file at .claude/commands/component-testing.md
  - Add YAML frontmatter with description, command (/component-testing), category (Testing & Quality)
  - Add trigger keywords: "component test", "RTL", "React testing", "testing library"
  - Document provider wrapping pattern (QueryClientProvider wrapper factory)
  - Document fetch mocking pattern (global.fetch = vi.fn())
  - Include example test structure from data-model.md
  - Reference tests/unit/components/ location
- [ ] T010 [US2] Verify skill is invocable and provides actionable testing guidance (SC-002 requirement)

**Checkpoint**: User Story 2 complete - Claude skill provides RTL testing patterns and guidance

---

## Phase 4: User Story 3 - Updated Documentation Guides Testing Decisions (Priority: P2)

**Goal**: Constitution and CLAUDE.md reflect RTL component testing strategy so AI agents make correct testing decisions

**Independent Test**: Read constitution.md and CLAUDE.md and confirm component testing guidance exists

### Implementation for User Story 3

- [ ] T011 [P] [US3] Update .specify/memory/constitution.md with RTL component testing
  - Add RTL to Testing Trophy table under Unit layer
  - Add component testing to Test Selection Decision Tree
  - Keep updates reference-style (not tutorial per VI. AI-First Development)
- [ ] T012 [P] [US3] Update CLAUDE.md Testing Guidelines section
  - Add component testing section explaining when to use RTL vs E2E
  - Reference the /component-testing skill
  - Document tests/unit/components/ location
- [ ] T013 [US3] Verify documentation is reference-style and not tutorial format (constitution VI requirement)

**Checkpoint**: User Story 3 complete - Documentation updated, meeting SC-003

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and verification across all stories

- [ ] T014 Run full test suite with `bun run test` to verify no regressions (SC-005)
- [ ] T015 Validate quickstart.md checklist items are complete
- [ ] T016 Verify all success criteria are met:
  - SC-001: 3+ component tests passing
  - SC-002: Skill invocable
  - SC-003: Docs updated
  - SC-004: Tests < 100ms
  - SC-005: No regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **User Story 1 (Phase 2)**: Depends on Phase 1 (directory structure must exist)
- **User Story 2 (Phase 3)**: No dependency on Phase 2 - can run in parallel with US1
- **User Story 3 (Phase 4)**: No dependency on Phase 2/3 - can run in parallel with US1/US2
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Setup - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Setup - Independent of US1 (skill doesn't require tests to exist)
- **User Story 3 (P2)**: Can start after Setup - Independent of US1/US2 (docs reference patterns, not specific tests)

### Within Each User Story

- T004, T005, T006 are parallelizable (different component files)
- T007, T008 depend on T004-T006 (verification after implementation)
- T011, T012 are parallelizable (different documentation files)

### Parallel Opportunities

Within User Story 1:
- T004, T005, T006 can all run in parallel (different test files)

Within User Story 3:
- T011, T012 can run in parallel (different documentation files)

Across User Stories:
- US1 (Phases 2) and US2 (Phase 3) and US3 (Phase 4) can all execute in parallel after Setup

---

## Parallel Example: User Story 1 Component Tests

```bash
# Launch all component tests together (different files, no dependencies):
Task: "Create CommentForm component test in tests/unit/components/comment-form.test.ts"
Task: "Create NewTicketModal component test in tests/unit/components/new-ticket-modal.test.ts"
Task: "Create TicketSearch component test in tests/unit/components/ticket-search.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify infrastructure)
2. Complete Phase 2: User Story 1 (create 3 component tests)
3. **STOP and VALIDATE**: Run `bun run test:unit` - all component tests pass under 100ms
4. MVP delivers: Working component testing capability

### Incremental Delivery

1. Complete Setup → Infrastructure verified
2. Add User Story 1 → Component tests work → MVP ready
3. Add User Story 2 → AI agents can use skill for guidance
4. Add User Story 3 → Documentation complete for long-term maintenance
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup phase sequentially
2. Once Setup is done, user stories can run in parallel:
   - Parallel task 1: User Story 1 (component tests)
   - Parallel task 2: User Story 2 (Claude skill)
   - Parallel task 3: User Story 3 (documentation)
3. Stories complete and validate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Test files must follow pattern from data-model.md (fresh QueryClient, vi.fn() for fetch)
- Skill must use allowed-tools: Read, Glob, Grep, Write
- Documentation updates must be reference-style per constitution VI
- All tests must execute under 100ms per SC-004
