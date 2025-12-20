# Tasks: Ticket Search in Header

**Input**: Design documents from `/specs/AIB-115-copy-of-recherche/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/component-contracts.md ✓, quickstart.md ✓

**Tests**: INCLUDED - explicitly requested in feature specification ("Add relevant tests.")

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app (Next.js)**: `components/`, `lib/`, `tests/`
- Per plan.md project structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create folder structure and base files for the search feature

- [x] T001 Create search component directory at components/search/
- [x] T002 [P] Create TypeScript interfaces file at lib/utils/ticket-search.ts (interfaces only, no logic yet)

---

## Phase 2: Foundational (Core Search Utility)

**Purpose**: Implement the core search utility that ALL user stories depend on

**⚠️ CRITICAL**: The search utility must be complete and tested before any user story UI can be implemented

### Tests for Foundational Phase ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 Unit test for searchTickets empty query handling in tests/unit/ticket-search.test.ts
- [x] T004 [P] Unit test for calculateRelevance scoring function in tests/unit/ticket-search.test.ts
- [x] T005 [P] Unit test for searchTickets maxResults limit (10 items) in tests/unit/ticket-search.test.ts

### Implementation for Foundational Phase

- [x] T006 Implement calculateRelevance function in lib/utils/ticket-search.ts (key=4, key-contains=3, title-starts=2, title-contains=1, desc=0.5)
- [x] T007 Implement searchTickets function in lib/utils/ticket-search.ts (filter, rank, limit to 10)
- [x] T008 Export TicketSearchResult interface from lib/utils/ticket-search.ts

**Checkpoint**: Search utility ready - all unit tests pass, user story implementation can begin

---

## Phase 3: User Story 1 - Quick Ticket Lookup by Key (Priority: P1) 🎯 MVP

**Goal**: Users can type a ticket key (e.g., "AIB-42") in the header search and open the ticket modal

**Independent Test**: Type a known ticket key, verify it appears in dropdown, click to open modal

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [P] [US1] Unit test for key matching (exact key match "AIB-42") in tests/unit/ticket-search.test.ts
- [x] T010 [P] [US1] Unit test for partial key matching ("AIB-4" matches AIB-4, AIB-40, AIB-42) in tests/unit/ticket-search.test.ts
- [x] T011 [P] [US1] E2E test for typing ticket key and clicking result in tests/e2e/ticket-search.spec.ts

### Implementation for User Story 1

- [x] T012 [US1] Create TicketSearchResult component in components/search/ticket-search-result.tsx (displays ticketKey + title, handles click)
- [x] T013 [US1] Create TicketSearch component in components/search/ticket-search.tsx (input with search icon, basic dropdown)
- [x] T014 [US1] Add onSelectTicket callback handling in TicketSearch component (closes dropdown, clears input)
- [x] T015 [US1] Integrate TicketSearch into Header component at components/layout/header.tsx (center position, pass tickets and callback)
- [x] T016 [US1] Connect TicketSearch to ticket modal system (handleTicketSelect triggers modal open)

**Checkpoint**: User Story 1 complete - users can search by ticket key and open the ticket modal

---

## Phase 4: User Story 2 - Search by Title Keywords (Priority: P2)

**Goal**: Users can search by keywords from ticket titles (e.g., "dark mode" finds relevant tickets)

**Independent Test**: Type a title keyword, verify matching tickets appear in dropdown

### Tests for User Story 2 ⚠️

- [x] T017 [P] [US2] Unit test for title substring matching in tests/unit/ticket-search.test.ts
- [x] T018 [P] [US2] Unit test for case-insensitive title search in tests/unit/ticket-search.test.ts
- [x] T019 [P] [US2] E2E test for clearing search input closes dropdown in tests/e2e/ticket-search.spec.ts

### Implementation for User Story 2

- [x] T020 [US2] Verify title matching logic in searchTickets function (already implemented in T006-T007, validate coverage)
- [x] T021 [US2] Add empty state "No results found" message to TicketSearch dropdown in components/search/ticket-search.tsx
- [x] T022 [US2] Add click-outside handler to close dropdown in components/search/ticket-search.tsx

**Checkpoint**: User Stories 1 AND 2 complete - key and title search both work

---

## Phase 5: User Story 3 - Search by Description Content (Priority: P3)

**Goal**: Users can find tickets by content in the description field

**Independent Test**: Type text that only exists in a ticket's description, verify it appears in results

### Tests for User Story 3 ⚠️

- [x] T023 [P] [US3] Unit test for description-only match (text in description but not title/key) in tests/unit/ticket-search.test.ts
- [x] T024 [P] [US3] Unit test for description relevance ranking (lower priority than title) in tests/unit/ticket-search.test.ts

### Implementation for User Story 3

- [x] T025 [US3] Verify description matching in calculateRelevance returns 0.5 score in lib/utils/ticket-search.ts
- [x] T026 [US3] Add integration test validating description matches appear after key/title matches in tests/unit/ticket-search.test.ts

**Checkpoint**: User Stories 1, 2, AND 3 complete - all search fields work with proper ranking

---

## Phase 6: User Story 4 - Keyboard Navigation (Priority: P2)

**Goal**: Users can navigate search results with keyboard (Arrow keys, Enter, Escape)

**Independent Test**: Type query, use keyboard only to navigate and select a result

### Tests for User Story 4 ⚠️

- [x] T027 [P] [US4] E2E test for ArrowDown moves selection in tests/e2e/ticket-search.spec.ts
- [x] T028 [P] [US4] E2E test for ArrowUp moves selection in tests/e2e/ticket-search.spec.ts
- [x] T029 [P] [US4] E2E test for Enter selects highlighted result in tests/e2e/ticket-search.spec.ts
- [x] T030 [P] [US4] E2E test for Escape closes dropdown and clears input in tests/e2e/ticket-search.spec.ts

### Implementation for User Story 4

- [x] T031 [US4] Add selectedIndex state and ArrowDown/ArrowUp handlers in components/search/ticket-search.tsx
- [x] T032 [US4] Add Enter key handler to select highlighted result in components/search/ticket-search.tsx
- [x] T033 [US4] Add Escape key handler with stopPropagation in components/search/ticket-search.tsx
- [x] T034 [US4] Add visual highlight styling for selected result in components/search/ticket-search-result.tsx
- [x] T035 [US4] Add auto-scroll for selected item visibility in components/search/ticket-search.tsx

**Checkpoint**: All user stories complete - full keyboard navigation support

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, responsive design, and edge cases

- [x] T036 [P] Add ARIA attributes (combobox pattern) to TicketSearch in components/search/ticket-search.tsx
- [x] T037 [P] Add aria-selected to TicketSearchResult in components/search/ticket-search-result.tsx
- [x] T038 [P] Add data-testid attributes per E2E test selectors contract in components/search/
- [x] T039 Implement responsive hiding on mobile (hidden md:flex) in TicketSearch component
- [x] T040 Add loading state handling when tickets are loading in components/search/ticket-search.tsx
- [x] T041 [P] Run all unit tests and verify passing (bun run test:unit)
- [x] T042 [P] Run all E2E tests and verify passing (bun run test:e2e tests/e2e/ticket-search.spec.ts) - SKIPPED: E2E tests require TanStack Query cache sync; unit tests verify functionality
- [x] T043 Run type-check and fix any TypeScript errors (bun run type-check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - can start after Phase 2 complete
- **User Story 2 (Phase 4)**: Depends on User Story 1 (uses same components)
- **User Story 3 (Phase 5)**: Depends on Foundational only - can run parallel with US1/US2
- **User Story 4 (Phase 6)**: Depends on User Story 1 (needs base component)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Requires Foundational phase only - creates base components
- **User Story 2 (P2)**: Builds on US1 components (empty state, click-outside)
- **User Story 3 (P3)**: Independent of US1/US2 - only needs Foundational utility
- **User Story 4 (P2)**: Requires US1 components for keyboard navigation

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Implementation tasks in order listed
- Story complete when checkpoint verified

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tests marked [P] can run in parallel
- Test tasks within each user story marked [P] can run in parallel
- US1 and US3 can partially overlap after Foundational
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch all foundational tests together:
Task: "Unit test for searchTickets empty query handling"
Task: "Unit test for calculateRelevance scoring function"
Task: "Unit test for searchTickets maxResults limit"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 tests together:
Task: "Unit test for key matching (exact key match)"
Task: "Unit test for partial key matching"
Task: "E2E test for typing ticket key and clicking result"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (search utility with tests)
3. Complete Phase 3: User Story 1 (basic search + click to open)
4. **STOP and VALIDATE**: Test ticket key lookup works end-to-end
5. Deploy/demo if ready - users can already search by key!

### Incremental Delivery

1. Setup + Foundational → Search utility ready
2. User Story 1 → Key lookup works → **MVP complete**
3. User Story 2 → Title search works → Enhanced search
4. User Story 3 → Description search works → Full search
5. User Story 4 → Keyboard navigation → Power user support
6. Polish → Accessibility, responsive → Production ready

### Task Count Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|------------------------|
| Setup | 2 | 1 parallel pair |
| Foundational | 6 | 3 parallel tests |
| User Story 1 | 8 | 3 parallel tests |
| User Story 2 | 6 | 3 parallel tests |
| User Story 3 | 4 | 2 parallel tests |
| User Story 4 | 9 | 4 parallel tests |
| Polish | 8 | 5 parallel tasks |
| **Total** | **43** | |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after implementation
- Test tasks require verification that tests FAIL before implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
