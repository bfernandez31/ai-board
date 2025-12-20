# Tasks: Ticket Search

**Input**: Design documents from `/specs/AIB-114-recherche-de-ticket/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification - test tasks are not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js App Router structure with `app/`, `components/`, `lib/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create TypeScript types and query key configuration for search feature

- [x] T001 [P] Create search types (SearchResult, SearchResponse, SearchParams) in app/lib/types/search.ts ✅ DONE
- [x] T002 [P] Add ticketSearch query key to app/lib/query-keys.ts ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create search API endpoint with Prisma query at app/api/projects/[projectId]/tickets/search/route.ts ✅ DONE
- [x] T004 Implement relevance sorting in search API (key exact match > key contains > title contains > description) ✅ DONE

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Quick Ticket Access by Key (Priority: P1) 🎯 MVP

**Goal**: Users can search for tickets by their key (e.g., "AIB-42") and open them in a modal

**Independent Test**: Type a known ticket key in the search input, verify the matching ticket appears in dropdown, click to open modal

### Implementation for User Story 1

- [x] T005 [P] [US1] Create TanStack Query hook with debouncing in app/lib/hooks/queries/useTicketSearch.ts ✅ DONE
- [x] T006 [P] [US1] Create SearchResults component (displays results list) in components/search/search-results.tsx ✅ DONE
- [x] T007 [US1] Create TicketSearch component with Popover, Input, and debounced state in components/search/ticket-search.tsx ✅ DONE
- [x] T008 [US1] Implement result selection that opens ticket modal via URL params in components/search/ticket-search.tsx ✅ DONE
- [x] T009 [US1] Clear search input and close dropdown after ticket selection in components/search/ticket-search.tsx ✅ DONE

**Checkpoint**: At this point, User Story 1 should be fully functional - users can search by key and open tickets

---

## Phase 4: User Story 2+3 - Search by Title/Description (Priority: P2/P3)

**Goal**: Users can search tickets by title or description content, with results ordered by relevance

**Independent Test**: Search for a keyword that appears only in titles, verify matching tickets appear. Search for a keyword only in descriptions, verify those tickets appear with lower priority.

**Note**: The core search implementation (Phase 2-3) already supports searching across all fields. This phase ensures proper display and ordering.

### Implementation for User Stories 2 & 3

- [x] T010 [US2] Verify search results show ticketKey and title for each match in components/search/search-results.tsx ✅ DONE
- [x] T011 [US2] Add visual styling for result items (font-mono for key, truncated title) in components/search/search-results.tsx ✅ DONE
- [x] T012 [US3] Verify description matches appear in results with correct ordering (after key and title matches) ✅ DONE

**Checkpoint**: Users can search by title or description and see relevant results in priority order

---

## Phase 5: User Story 4 - Keyboard Navigation (Priority: P2)

**Goal**: Users can navigate search results using keyboard (Arrow keys, Enter, Escape)

**Independent Test**: With search results visible, press ArrowDown to move selection, Enter to open ticket, Escape to close dropdown

### Implementation for User Story 4

- [x] T013 [US4] Implement keyboard event handler (ArrowUp, ArrowDown, Enter, Escape) in components/search/ticket-search.tsx ✅ DONE
- [x] T014 [US4] Add selectedIndex state management for keyboard navigation in components/search/ticket-search.tsx ✅ DONE
- [x] T015 [US4] Add visual highlight for selected item with data-selected attribute in components/search/search-results.tsx ✅ DONE
- [x] T016 [US4] Implement auto-scroll selected item into view in components/search/ticket-search.tsx ✅ DONE
- [x] T017 [US4] Handle Escape key: close dropdown if open, clear input if closed in components/search/ticket-search.tsx ✅ DONE

**Checkpoint**: Full keyboard navigation working - users can navigate without mouse

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Header integration, responsive design, and edge cases

- [x] T018 Import TicketSearch component in components/layout/header.tsx ✅ DONE
- [x] T019 Add TicketSearch to header center section, conditional on projectInfo availability in components/layout/header.tsx ✅ DONE
- [x] T020 Hide search input on mobile viewports (< md breakpoint) with hidden/md:flex classes in components/search/ticket-search.tsx ✅ DONE
- [x] T021 Add aria-label, aria-expanded, aria-haspopup attributes for accessibility in components/search/ticket-search.tsx ✅ DONE
- [x] T022 Add role="listbox" and role="option" to search results for accessibility in components/search/search-results.tsx ✅ DONE
- [x] T023 Handle loading state with "Searching..." message in components/search/search-results.tsx ✅ DONE
- [x] T024 Handle error state with "Search unavailable" message in components/search/search-results.tsx ✅ DONE
- [x] T025 Handle empty state with "No tickets found" message in components/search/search-results.tsx ✅ DONE
- [x] T026 Add Search icon (lucide-react) to input field in components/search/ticket-search.tsx ✅ DONE
- [x] T027 Run type-check to verify all TypeScript types are correct ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (needs types and query keys)
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - core search functionality
- **User Stories 2+3 (Phase 4)**: Depends on Phase 3 - builds on existing search UI
- **User Story 4 (Phase 5)**: Depends on Phase 3 - adds keyboard support to existing UI
- **Polish (Phase 6)**: Depends on Phase 5 - integrates into header and adds final touches

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Stories 2+3 (P2/P3)**: Can start after Phase 3 - Extends search to title/description
- **User Story 4 (P2)**: Can start after Phase 3 - Independent of US2/US3

### Within Each User Story

- Types before hooks
- Hooks before components
- Core component before features
- Core implementation before integration

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T005 and T006 can run in parallel (different files)
- Phase 4 and Phase 5 can be worked on in parallel after Phase 3
- Accessibility tasks (T021, T022) can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all setup tasks together:
Task: "Create search types in app/lib/types/search.ts"
Task: "Add ticketSearch query key to app/lib/query-keys.ts"
```

## Parallel Example: User Story 1 Components

```bash
# After Phase 2, launch component creation in parallel:
Task: "Create TanStack Query hook in app/lib/hooks/queries/useTicketSearch.ts"
Task: "Create SearchResults component in components/search/search-results.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types and query keys)
2. Complete Phase 2: Foundational (search API)
3. Complete Phase 3: User Story 1 (basic search and modal opening)
4. **STOP and VALIDATE**: Test searching by ticket key and opening modal
5. Integrate into header for immediate use

### Incremental Delivery

1. Complete Setup + Foundational → API ready
2. Add User Story 1 → Test independently → Basic search works (MVP!)
3. Add User Stories 2+3 → Test independently → Full search coverage
4. Add User Story 4 → Test independently → Keyboard navigation
5. Add Polish phase → Production ready with accessibility and edge cases

### Summary

- **Total tasks**: 27
- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 2 tasks
- **Phase 3 (US1)**: 5 tasks
- **Phase 4 (US2+3)**: 3 tasks
- **Phase 5 (US4)**: 5 tasks
- **Phase 6 (Polish)**: 10 tasks
- **Parallel opportunities**: 6 identified (T001+T002, T005+T006, T010+T011, T013+T14, T021+T022, Phase 4 || Phase 5)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The search API (Phase 2) supports all search fields simultaneously - US2/US3 focus on UI verification
