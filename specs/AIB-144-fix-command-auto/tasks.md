# Tasks: Fix Command Autocomplete Behavior and Dropdown Positioning

**Input**: Design documents from `/specs/AIB-144-fix-command-auto/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included per constitution III (Vitest + RTL for interactive UI components)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup required - modifying existing components

This feature modifies existing files only; no new project structure or dependencies needed.

**Checkpoint**: Proceed directly to implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T001 Review existing autocomplete implementation in components/comments/mention-input.tsx
- [x] T002 Review existing tests in tests/unit/components/command-autocomplete.test.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 3 - Space Closes Command Autocomplete (Priority: P1)

**Goal**: Command autocomplete closes when space is typed after `/`, matching behavior of `@mention` and `#ticket` autocomplete

**Independent Test**: Simulate typing `@[id:AI-BOARD] / ` and verify dropdown closes when space is typed

### Tests for User Story 3

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 [P] [US3] Create test file tests/unit/components/mention-input.test.tsx with test setup and mock data
- [x] T004 [P] [US3] Add test case "should close command dropdown when space is typed after /" in tests/unit/components/mention-input.test.tsx
- [x] T005 [P] [US3] Add test case "should close command dropdown when space is typed after partial command" in tests/unit/components/mention-input.test.tsx

### Implementation for User Story 3

- [x] T006 [US3] Add space check `!query.includes(' ')` to command trigger logic at lines 264-270 in components/comments/mention-input.tsx

**Checkpoint**: User Story 3 complete - space closes command dropdown like other autocomplete types

---

## Phase 4: User Story 1 - Command Autocomplete Closes After Selection (Priority: P1)

**Goal**: After selecting a command, dropdown closes and typing additional text does not reopen the command dropdown

**Independent Test**: Simulate selecting `/compare` from dropdown, then type additional characters and verify dropdown does NOT reappear

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [P] [US1] Add test case "should not re-trigger autocomplete after command selection" in tests/unit/components/mention-input.test.tsx
- [x] T008 [P] [US1] Add test case "should insert command with trailing space after selection" in tests/unit/components/mention-input.test.tsx

### Implementation for User Story 1

- [x] T009 [US1] Verify existing handleCommandSelect behavior correctly closes dropdown and moves cursor in components/comments/mention-input.tsx
- [x] T010 [US1] Verify existing regex pattern prevents re-triggering after command selection in components/comments/mention-input.tsx

**Checkpoint**: User Story 1 complete - command selection behavior is robust and does not re-trigger

---

## Phase 5: User Story 2 - Dropdown Positioned Within Viewport (Priority: P2)

**Goal**: Autocomplete dropdowns remain fully visible within viewport/modal bounds regardless of cursor position

**Independent Test**: Render component in constrained container, verify dropdown coordinates stay within bounds

### Tests for User Story 2

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US2] Add test case "should shift dropdown left when near right edge" in tests/unit/components/mention-input.test.tsx
- [x] T012 [P] [US2] Add test case "should flip dropdown above cursor when near bottom edge" in tests/unit/components/mention-input.test.tsx
- [x] T013 [P] [US2] Add test case "should use default position when in center of viewport" in tests/unit/components/mention-input.test.tsx

### Implementation for User Story 2

- [x] T014 [US2] Add calculateBoundedPosition function after getCaretCoordinates function in components/comments/mention-input.tsx
- [x] T015 [US2] Update useEffect position calculation to use calculateBoundedPosition at lines 480-490 in components/comments/mention-input.tsx
- [x] T016 [US2] Add getBoundingClientRect call for textarea reference in components/comments/mention-input.tsx

**Checkpoint**: User Story 2 complete - dropdowns stay within visible viewport bounds

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T017 Run all autocomplete tests via `bun run test:unit -- --grep "autocomplete"`
- [x] T018 Run all MentionInput tests via `bun run test:unit -- --grep "MentionInput"`
- [x] T019 Run type-check via `bun run type-check`
- [x] T020 Verify no regression in existing ticket and mention autocomplete behavior
- [ ] T021 Run quickstart.md validation scenarios manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A - no setup required
- **Foundational (Phase 2)**: No dependencies - can start immediately
- **User Story 3 (Phase 3)**: Depends on Foundational phase completion
- **User Story 1 (Phase 4)**: Depends on Foundational phase completion
- **User Story 2 (Phase 5)**: Depends on Foundational phase completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Review existing code before modifying
- Implement changes
- Verify tests pass
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004, T005 (US3 tests) can run in parallel
- T007, T008 (US1 tests) can run in parallel
- T011, T012, T013 (US2 tests) can run in parallel
- User Stories 1, 2, 3 can all start in parallel after Foundational phase

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Add test case 'should shift dropdown left when near right edge' in tests/unit/components/mention-input.test.tsx"
Task: "Add test case 'should flip dropdown above cursor when near bottom edge' in tests/unit/components/mention-input.test.tsx"
Task: "Add test case 'should use default position when in center of viewport' in tests/unit/components/mention-input.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 3 Only)

1. Complete Phase 2: Foundational (review existing code)
2. Complete Phase 3: User Story 3 (space closes dropdown)
3. **STOP and VALIDATE**: Test User Story 3 independently
4. Deploy/demo if ready

### Recommended Order (by priority)

1. Complete Foundational (Phase 2) - Required for all stories
2. User Story 3 (P1) - Space closes command autocomplete (most impactful fix)
3. User Story 1 (P1) - Verify selection behavior (may need no changes)
4. User Story 2 (P2) - Viewport boundary detection (UX improvement)
5. Polish (Phase 6) - Final validation

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Foundational phase sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel task 1: User Story 3 (space closes)
   - Parallel task 2: User Story 1 (selection behavior)
   - Parallel task 3: User Story 2 (viewport positioning)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files or independent code sections, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All changes are to single file: `components/comments/mention-input.tsx`
- Tests go in new file: `tests/unit/components/mention-input.test.tsx`
