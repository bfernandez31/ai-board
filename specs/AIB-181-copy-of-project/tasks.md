# Tasks: Project Activity Feed

**Input**: Design documents from `/specs/AIB-181-copy-of-project/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/activity-api.yaml

**Tests**: Integration tests for API (Vitest) and E2E test for ticket modal navigation (Playwright) as specified in plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js App Router at repository root
- `app/` for pages and API routes
- `components/` for React components
- `tests/` for test files

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [ ] T001 [P] Define ActivityEvent types and discriminated union in app/lib/types/activity-event.ts
- [ ] T002 [P] Add activity query key to app/lib/query-keys.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create activity event aggregation utility in app/lib/utils/activity-events.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Recent Project Activity (Priority: P1) 🎯 MVP

**Goal**: Display unified timeline of recent events (jobs, comments, ticket changes) with icon, actor, action, and relative timestamp

**Independent Test**: Navigate to `/projects/{projectId}/activity` and see a chronological list of events from the last 30 days

### Implementation for User Story 1

- [ ] T004 [US1] Implement GET handler for activity API in app/api/projects/[projectId]/activity/route.ts
- [ ] T005 [US1] Create ActivityEventItem component in components/activity/activity-event-item.tsx
- [ ] T006 [US1] Create ActivityEmptyState component in components/activity/activity-empty-state.tsx
- [ ] T007 [US1] Create ActivityFeed client component (basic list rendering) in components/activity/activity-feed.tsx
- [ ] T008 [US1] Create activity page (Server Component) in app/projects/[projectId]/activity/page.tsx

### Tests for User Story 1

- [ ] T009 [US1] Integration test for activity API (GET, auth, event format) in tests/integration/activity/activity-api.test.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - users can view recent activity

---

## Phase 4: User Story 2 - Load More Historical Activity (Priority: P2)

**Goal**: Enable pagination to load older events within 30-day window

**Independent Test**: Click "Load more" button to load additional events

### Implementation for User Story 2

- [ ] T010 [US2] Add pagination state and "Load more" button to components/activity/activity-feed.tsx
- [ ] T011 [US2] Test pagination in activity API (limit, offset, hasMore) in tests/integration/activity/activity-api.test.ts

**Checkpoint**: At this point, Users can view recent activity AND load more historical events

---

## Phase 5: User Story 3 - Navigate to Ticket from Activity (Priority: P2)

**Goal**: Click ticket reference to open ticket modal on board page

**Independent Test**: Click a ticket reference (e.g., "AIB-42") and verify the ticket modal opens

### Implementation for User Story 3

- [ ] T012 [US3] Add ticket reference click handler with navigation in components/activity/activity-event-item.tsx

### Tests for User Story 3

- [ ] T013 [US3] E2E test for ticket modal navigation from activity feed in tests/e2e/activity-navigation.spec.ts

**Checkpoint**: At this point, User Stories 1, 2, AND 3 are functional - full activity viewing with navigation

---

## Phase 6: User Story 4 - Real-Time Activity Updates (Priority: P3)

**Goal**: New events appear automatically within 15 seconds via polling

**Independent Test**: Create activity in another tab, verify it appears within 15 seconds

### Implementation for User Story 4

- [ ] T014 [US4] Create useActivityFeed hook with 15-second polling in app/lib/hooks/queries/use-activity-feed.ts
- [ ] T015 [US4] Integrate useActivityFeed hook in components/activity/activity-feed.tsx

**Checkpoint**: At this point, activity feed updates automatically with new events

---

## Phase 7: User Story 5 - Access Activity Feed via Navigation (Priority: P3)

**Goal**: Navigate to activity feed from project header with Activity icon

**Independent Test**: Click Activity icon in header, verify navigation to activity page

### Implementation for User Story 5

- [ ] T016 [P] [US5] Add Activity icon link to project header in components/layout/header.tsx
- [ ] T017 [P] [US5] Add Activity link to mobile menu in components/layout/mobile-menu.tsx

**Checkpoint**: All user stories are now functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and validation

- [ ] T018 Run type-check and lint to verify no errors
- [ ] T019 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1) should complete first as MVP
  - US2, US3 (P2) can proceed after US1
  - US4, US5 (P3) can proceed after US1
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (activity-feed.tsx must exist to add pagination)
- **User Story 3 (P2)**: Depends on US1 (activity-event-item.tsx must exist to add click handler)
- **User Story 4 (P3)**: Depends on US1 (activity-feed.tsx must exist to integrate hook)
- **User Story 5 (P3)**: Can start after Foundational - Independent of other stories

### Parallel Opportunities

- T001 and T002 in Setup can run in parallel (different files)
- T016 and T017 in US5 can run in parallel (different files)
- US5 can run in parallel with US2, US3, US4 (independent files)

---

## Parallel Example: Setup Phase

```bash
# Launch all setup tasks together:
Task: "Define ActivityEvent types in app/lib/types/activity-event.ts"
Task: "Add activity query key to app/lib/query-keys.ts"
```

## Parallel Example: User Story 5

```bash
# Launch all US5 tasks together (after Foundational):
Task: "Add Activity icon link to components/layout/header.tsx"
Task: "Add Activity link to components/layout/mobile-menu.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003)
3. Complete Phase 3: User Story 1 (T004-T009)
4. **STOP and VALIDATE**: Test activity feed displays events correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP!
3. Add User Story 2 → Pagination works
4. Add User Story 3 → Ticket navigation works
5. Add User Story 4 → Real-time updates work
6. Add User Story 5 → Navigation from header works
7. Polish → Type-check and validation

### Recommended Execution Order

For sequential execution, follow priority order:
1. Setup (Phase 1)
2. Foundational (Phase 2)
3. US1 (Phase 3) - MVP
4. US2 (Phase 4) - Pagination
5. US3 (Phase 5) - Navigation
6. US4 (Phase 6) - Polling
7. US5 (Phase 7) - Header links
8. Polish (Phase 8)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No new database tables required (FR-005) - all data comes from existing Job, Comment, Ticket tables
