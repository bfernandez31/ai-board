# Tasks: Fix Command Autocomplete Behavior and Dropdown Positioning

**Input**: Design documents from `/specs/AIB-143-copy-of-fix/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Not requested in feature specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed - this is a bug fix in an existing codebase

N/A - All changes are modifications to existing files.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add new state and helper function that user stories depend on

- [x] T001 Add `completedCommandPosition` state variable in components/comments/mention-input.tsx
- [x] T002 Add `calculateViewportAwarePosition` helper function in components/comments/mention-input.tsx

**Checkpoint**: ✅ DONE - Foundation ready - state and helper function are available for user story implementation

---

## Phase 3: User Story 1 - Command Autocomplete Dismissal After Selection (Priority: P1)

**Goal**: Command autocomplete closes after selection and does not reappear for the same trigger position

**Independent Test**: Type `@ai-board /`, select a command, continue typing - autocomplete should NOT reopen

### Implementation for User Story 1

- [x] T003 [US1] Update `handleSelectCommand` to set `completedCommandPosition` when a command is selected in components/comments/mention-input.tsx
- [x] T004 [US1] Update `handleInputChange` command detection to check `completedCommandPosition` and skip re-triggering in components/comments/mention-input.tsx

**Checkpoint**: ✅ DONE - User Story 1 complete - command selection properly closes autocomplete and prevents re-triggering

---

## Phase 4: User Story 2 - Command Autocomplete Closes on Space (Priority: P1)

**Goal**: Command autocomplete closes when user types a space after the `/` trigger character

**Independent Test**: Type `@ai-board /` then type a space - autocomplete should close immediately

### Implementation for User Story 2

- [x] T005 [US2] Add space detection check for command autocomplete in `handleInputChange` in components/comments/mention-input.tsx (matching existing @ and # behavior)

**Checkpoint**: ✅ DONE - User Story 2 complete - typing space closes command autocomplete consistent with other autocomplete types

---

## Phase 5: User Story 3 - Viewport-Aware Dropdown Positioning (Priority: P2)

**Goal**: Autocomplete dropdowns remain visible within viewport boundaries, adjusting position near modal edges

**Independent Test**: Trigger autocomplete near right/bottom edge of modal - dropdown should reposition to remain visible

### Implementation for User Story 3

- [x] T006 [US3] Update positioning `useEffect` to call `calculateViewportAwarePosition` with textarea rect in components/comments/mention-input.tsx
- [x] T007 [US3] Add horizontal overflow adjustment in `calculateViewportAwarePosition` in components/comments/mention-input.tsx
- [x] T008 [US3] Add vertical overflow adjustment in `calculateViewportAwarePosition` in components/comments/mention-input.tsx

**Checkpoint**: ✅ DONE - User Story 3 complete - dropdowns remain visible near all modal edges

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and state management across all user stories

- [x] T009 Add reset logic for `completedCommandPosition` when input changes and no command trigger is found in components/comments/mention-input.tsx
- [x] T010 Run type-check to verify no TypeScript errors
- [x] T011 Run quickstart.md validation scenarios

**Checkpoint**: ✅ DONE - All polish tasks complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A - no setup needed
- **Foundational (Phase 2)**: No dependencies - can start immediately
- **User Story 1 (Phase 3)**: Depends on T001 (completedCommandPosition state)
- **User Story 2 (Phase 4)**: Depends on T001 (completedCommandPosition state for combined fix)
- **User Story 3 (Phase 5)**: Depends on T002 (calculateViewportAwarePosition function)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after T001 (Foundational) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after T001 (Foundational) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after T002 (Foundational) - No dependencies on other stories

### Within Each User Story

- All tasks modify the same file (`mention-input.tsx`), so tasks within a story must be sequential
- Stories can be executed in priority order: US1 + US2 (both P1), then US3 (P2)

### Parallel Opportunities

- T001 and T002 (Foundational) modify different sections of the file - can be done in sequence or combined
- US1 and US2 both depend on T001 and modify `handleInputChange` - best done sequentially
- US3 is independent of US1/US2 - can be done in parallel after T002

---

## Parallel Example: Foundational Phase

```bash
# These tasks can be combined into a single edit session:
Task: "Add completedCommandPosition state variable in components/comments/mention-input.tsx"
Task: "Add calculateViewportAwarePosition helper function in components/comments/mention-input.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 2: Foundational (add state and helper)
2. Complete Phase 3: User Story 1 (command selection closes autocomplete)
3. Complete Phase 4: User Story 2 (space closes autocomplete)
4. **STOP and VALIDATE**: Test command autocomplete dismissal works correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Foundational → Foundation ready
2. Add User Story 1 → Test independently → Core bug fix (MVP!)
3. Add User Story 2 → Test independently → Space dismissal working
4. Add User Story 3 → Test independently → Positioning fixed
5. Each story adds value without breaking previous stories

### Recommended Execution Order

Since all changes are in a single file (`mention-input.tsx`), execute sequentially:

1. T001 → T002 (Foundational)
2. T003 → T004 (User Story 1)
3. T005 (User Story 2)
4. T006 → T007 → T008 (User Story 3)
5. T009 → T010 → T011 (Polish)

---

## Notes

- All tasks modify `components/comments/mention-input.tsx` - sequential execution recommended
- No test tasks included (not requested in spec)
- Verify each user story independently before proceeding to next
- Commit after each user story phase completes
- Reference quickstart.md for exact implementation code
- Reference research.md for root cause analysis and implementation rationale
