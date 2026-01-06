# Tasks: Contrast on Search Closed Ticket

**Input**: Design documents from `/specs/AIB-150-contrast-on-search/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included per Constitution principle III (Test-Driven) and research.md decision 3.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Not Required)

**Purpose**: Project initialization and basic structure

No setup tasks required - this feature modifies existing files only.

---

## Phase 2: Foundational (Not Required)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

No foundational tasks required - existing infrastructure is sufficient:
- React Query cache management exists in board.tsx
- Search component styling exists in search-results.tsx
- CLOSED stage already defined in Stage enum
- Search API already returns CLOSED tickets

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - View Closed Ticket Details via Search (Priority: P1) 🎯 MVP

**Goal**: Users can click on closed tickets in search results and have the ticket detail modal open

**Independent Test**: Close a ticket, search for it, click on the result, verify the modal opens with full ticket details in read-only mode

### Implementation for User Story 1

- [ ] T001 [US1] Fix cache update logic to keep CLOSED tickets in components/board/board.tsx (line 923-928)

**Details**:
- Change `allTickets.filter(t => t.id !== ticket.id)` to `allTickets.map(t => t.id === ticket.id ? {...t, stage: Stage.CLOSED} : t)`
- This preserves closed tickets in the React Query cache for modal access via search
- Board columns already filter out CLOSED at display time (line 1074)

**Checkpoint**: User Story 1 is complete - closed tickets now accessible via search modal

---

## Phase 4: User Story 2 - Readable Closed Ticket in Search Dropdown (Priority: P1)

**Goal**: Users can clearly read closed ticket text when highlighted/selected in search dropdown, meeting WCAG AA contrast requirements

**Independent Test**: Type a search query that returns closed tickets, use keyboard navigation to select them, verify text remains readable with 4.5:1 minimum contrast

### Tests for User Story 2

- [ ] T002 [P] [US2] Create RTL component test file tests/unit/components/search-results.test.tsx

**Test Cases**:
1. Closed ticket default state has muted styling with opacity-60
2. Closed ticket selected state uses bg-muted/text-foreground (no opacity-60)
3. Open ticket selected state uses bg-primary/text-primary-foreground
4. All text elements meet WCAG AA contrast requirements

### Implementation for User Story 2

- [ ] T003 [US2] Fix contrast styling for selected closed tickets in components/search/search-results.tsx (line 61-63)

**Details**:
- Replace unconditional `isClosed && 'opacity-60'` with conditional styling:
  - Selected + closed: `bg-muted text-foreground` (8.4:1 contrast - PASSES AAA)
  - Not selected + closed: `opacity-60` (maintain visual distinction)
  - Selected + open: `bg-primary text-primary-foreground` (unchanged)

**Checkpoint**: User Story 2 is complete - closed tickets meet WCAG AA contrast in all states

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validate changes work together

- [ ] T004 Run quickstart.md validation steps in specs/AIB-150-contrast-on-search/quickstart.md

**Validation Steps**:
1. Run unit tests: `bun run test:unit`
2. Run integration tests: `bun run test:integration`
3. Manual verification:
   - Close a ticket
   - Search for the closed ticket
   - Navigate with keyboard (up/down arrows)
   - Verify text is readable when selected
   - Click closed ticket - verify modal opens

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Not required
- **Phase 2 (Foundational)**: Not required
- **Phase 3 (User Story 1)**: Can start immediately - no dependencies
- **Phase 4 (User Story 2)**: Can start immediately - no dependencies on US1
- **Phase 5 (Polish)**: Depends on US1 and US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Independent - modifies board.tsx cache logic
- **User Story 2 (P1)**: Independent - modifies search-results.tsx styling

### Within Each User Story

- Tests first (T002), then implementation (T003) for US2
- US1 has no tests (cache logic change is low-risk, covered by existing tests)

### Parallel Opportunities

- **US1 and US2 are fully parallel**: They modify different files (board.tsx vs search-results.tsx)
- **T002 and T003 are NOT parallel**: Test should be written first to verify it fails

---

## Parallel Example: User Story 1 + User Story 2

```bash
# These can run in parallel (different files, no dependencies):
Task: "T001 [US1] Fix cache update logic in components/board/board.tsx"
Task: "T002 [US2] Create RTL component test in tests/unit/components/search-results.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Skip Phase 1 + Phase 2 (not required)
2. Complete Phase 3: User Story 1 (T001)
3. **STOP and VALIDATE**: Search for closed ticket → modal opens
4. Deploy/demo if ready

### Incremental Delivery

1. Complete User Story 1 (T001) → Modal access works
2. Complete User Story 2 (T002, T003) → Contrast fixed
3. Complete Phase 5 (T004) → Full validation
4. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Parallel task 1: User Story 1 (T001)
2. Parallel task 2: User Story 2 (T002 → T003)
3. Stories complete and validate together in Phase 5

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 4 |
| **User Story 1 Tasks** | 1 |
| **User Story 2 Tasks** | 2 |
| **Polish Tasks** | 1 |
| **Parallel Opportunities** | US1 + US2 can run in parallel |
| **MVP Scope** | User Story 1 only (1 task) |
| **Files Modified** | 2 (board.tsx, search-results.tsx) |
| **New Files** | 1 (search-results.test.tsx) |

---

## Notes

- [P] tasks = different files, no dependencies
- [US1/US2] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- US1 and US2 are both P1 priority but can be delivered independently
- Commit after each task
- Avoid: same file conflicts (none in this feature)
