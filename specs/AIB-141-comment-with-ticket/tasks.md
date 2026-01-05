# Tasks: Comment with Ticket and Command Autocomplete

**Input**: Design documents from `/specs/AIB-141-comment-with-ticket/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Tests are included as they follow the project's testing guidelines (RTL for component interactions, Vitest integration for API).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create static data and type definitions used by all autocomplete features

- [ ] T001 [P] Create AI-BOARD command definitions in app/lib/data/ai-board-commands.ts
- [ ] T002 [P] Add TicketSearchResult and AIBoardCommand types to app/lib/types/mention.ts

**Checkpoint**: Foundation types and data ready for component development

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the ticket search hook that US1 depends on

**⚠️ CRITICAL**: User Story 1 cannot function without the search hook

- [ ] T003 Create useTicketSearch hook in app/lib/hooks/queries/use-ticket-search.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Ticket Reference Autocomplete (Priority: P1) 🎯 MVP

**Goal**: Enable `#` autocomplete to reference project tickets with format `#AIB-120`

**Independent Test**: Type `#AIB` in comment textarea → dropdown appears with matching tickets → select ticket → `#AIB-120` inserted

### Tests for User Story 1

- [ ] T004 [P] [US1] Create RTL component tests for TicketAutocomplete in tests/unit/components/ticket-autocomplete.test.tsx
- [ ] T005 [P] [US1] Create integration tests for ticket search in tests/integration/comments/autocomplete.test.ts

### Implementation for User Story 1

- [ ] T006 [US1] Create TicketAutocomplete component in components/comments/ticket-autocomplete.tsx
- [ ] T007 [US1] Add `#` trigger detection to MentionInput in components/comments/mention-input.tsx
- [ ] T008 [US1] Add ticket selection handler to insert `#TICKET_KEY` format in components/comments/mention-input.tsx

**Checkpoint**: User Story 1 fully functional - `#` autocomplete works independently

---

## Phase 4: User Story 2 - Command Autocomplete After AI-BOARD Mention (Priority: P2)

**Goal**: Enable `/` autocomplete after `@ai-board` mention to show available commands with descriptions

**Independent Test**: Type `@ai-board /` in comment textarea → dropdown appears with `/compare` command → select command → `/compare` inserted

### Tests for User Story 2

- [ ] T009 [P] [US2] Create RTL component tests for CommandAutocomplete in tests/unit/components/command-autocomplete.test.tsx

### Implementation for User Story 2

- [ ] T010 [US2] Create CommandAutocomplete component in components/comments/command-autocomplete.tsx
- [ ] T011 [US2] Add `/` trigger detection (after @ai-board only) to MentionInput in components/comments/mention-input.tsx
- [ ] T012 [US2] Add command selection handler to insert command name in components/comments/mention-input.tsx

**Checkpoint**: User Story 2 fully functional - `/` autocomplete after @ai-board works independently

---

## Phase 5: User Story 3 - Keyboard Navigation Consistency (Priority: P3)

**Goal**: Ensure consistent keyboard navigation (Arrow Up/Down, Enter, Escape) across all autocomplete dropdowns

**Independent Test**: Navigate each dropdown type (@mention, #ticket, /command) with keyboard only → verify identical behavior

### Tests for User Story 3

- [ ] T013 [US3] Add keyboard navigation tests to both autocomplete test files in tests/unit/components/

### Implementation for User Story 3

- [ ] T014 [US3] Verify and align keyboard handlers in TicketAutocomplete in components/comments/ticket-autocomplete.tsx
- [ ] T015 [US3] Verify and align keyboard handlers in CommandAutocomplete in components/comments/command-autocomplete.tsx
- [ ] T016 [US3] Ensure consistent selectedIndex behavior in MentionInput in components/comments/mention-input.tsx

**Checkpoint**: All autocomplete types have identical keyboard navigation behavior

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, validation, and refinements across all user stories

- [ ] T017 Add empty state handling ("No tickets found", "No commands available") in both autocomplete components
- [ ] T018 Add edge case handling for `#` inside existing mentions in components/comments/mention-input.tsx
- [ ] T019 Run quickstart.md validation scenarios to verify all features work together

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 types - BLOCKS User Story 1
- **User Story 1 (Phase 3)**: Depends on Foundational phase (useTicketSearch hook)
- **User Story 2 (Phase 4)**: Depends on Phase 1 (command data) - can run parallel to US1
- **User Story 3 (Phase 5)**: Depends on US1 and US2 completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on T003 (useTicketSearch hook) - First priority
- **User Story 2 (P2)**: Only depends on T001 (command data) - Can start after Phase 1
- **User Story 3 (P3)**: Depends on both US1 and US2 components existing

### Within Each User Story

- Tests written first (T004/T005, T009, T013)
- Components before MentionInput modifications
- MentionInput trigger detection before selection handlers

### Parallel Opportunities

- T001 and T002 can run in parallel (Phase 1)
- T004 and T005 can run in parallel (US1 tests)
- US1 and US2 can be developed in parallel after their prerequisites are met
- T014 and T015 can run in parallel (US3 keyboard handlers)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch both tests for User Story 1 together:
Task: "Create RTL component tests for TicketAutocomplete in tests/unit/components/ticket-autocomplete.test.tsx"
Task: "Create integration tests for ticket search in tests/integration/comments/autocomplete.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003)
3. Complete Phase 3: User Story 1 (T004-T008)
4. **STOP and VALIDATE**: Test `#` autocomplete independently
5. Deploy/demo if ready - users can reference tickets!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test `#` autocomplete → Deploy (MVP!)
3. Add User Story 2 → Test `/` autocomplete → Deploy
4. Add User Story 3 → Test keyboard navigation → Deploy
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute User Stories 1 and 2 in parallel after Phase 1:

1. Complete Phase 1 (Setup) - T001, T002
2. In parallel:
   - Path A: T003 → US1 (T004-T008)
   - Path B: US2 (T009-T012) - only needs T001
3. Once both paths complete, proceed to US3 (T013-T016)
4. Finish with Polish phase (T017-T019)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Existing `UserAutocomplete` component pattern should be followed for both new components
- Existing `/api/projects/[projectId]/tickets/search` endpoint serves ticket data (no backend changes)
- Commands are static client-side data (no API needed)
- Both dropdowns need `data-testid`, `role="listbox"`, and accessibility attributes
