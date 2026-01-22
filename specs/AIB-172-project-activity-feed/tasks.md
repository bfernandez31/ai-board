# Tasks: Project Activity Feed

**Input**: Design documents from `/specs/AIB-172-project-activity-feed/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/activity-api.yaml ✓

**Tests**: Explicitly requested in spec.md (Testing Requirements section). Test tasks are included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create type definitions and utility functions that all user stories depend on

- [ ] T001 [P] Define ActivityEvent discriminated union types in app/lib/types/activity-event.ts
- [ ] T002 [P] Define Zod validation schema for API query params in app/lib/types/activity-event.ts
- [ ] T003 [P] Implement event transformation utilities in app/lib/utils/activity-events.ts
- [ ] T004 [P] Add activity query key to app/lib/query-keys.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Implement event ID generation utilities in app/lib/utils/activity-events.ts
- [ ] T006 Implement mergeAndSortEvents function in app/lib/utils/activity-events.ts
- [ ] T007 Implement command display name mapping in app/lib/utils/activity-events.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Recent Project Activity (Priority: P1) 🎯 MVP

**Goal**: Users can view a chronological timeline of all project activity at `/projects/{projectId}/activity`

**Independent Test**: Navigate to `/projects/{projectId}/activity` and verify events are displayed chronologically with correct formatting (icon, actor, action, ticket reference, timestamp)

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T008 [P] [US1] Unit test for event transformation utilities in tests/unit/activity-event-mapping.test.ts
- [ ] T009 [P] [US1] Integration test for activity API authorization in tests/integration/activity/activity-api.test.ts
- [ ] T010 [P] [US1] Integration test for activity API pagination in tests/integration/activity/activity-api.test.ts
- [ ] T011 [P] [US1] Integration test for 30-day window filtering in tests/integration/activity/activity-api.test.ts

### Implementation for User Story 1

- [ ] T012 [US1] Implement GET /api/projects/[projectId]/activity API endpoint in app/api/projects/[projectId]/activity/route.ts
- [ ] T013 [US1] Implement useActivityFeed TanStack Query hook in app/lib/hooks/queries/use-activity-feed.ts
- [ ] T014 [P] [US1] Create ActivityEventItem component in components/activity/activity-event-item.tsx
- [ ] T015 [P] [US1] Create ActivityEventIcons mapping in components/activity/activity-event-icons.tsx
- [ ] T016 [P] [US1] Create ActivityEmptyState component in components/activity/activity-empty-state.tsx
- [ ] T017 [US1] Create ActivityFeed container component in components/activity/activity-feed.tsx
- [ ] T018 [US1] Create activity page at app/projects/[projectId]/activity/page.tsx
- [ ] T019 [P] [US1] RTL component test for ActivityFeed rendering in tests/unit/components/activity-feed.test.tsx
- [ ] T020 [P] [US1] RTL component test for ActivityEventItem variations in tests/unit/components/activity-feed.test.tsx

**Checkpoint**: User Story 1 complete - users can view activity feed with all event types, proper formatting, and authorization

---

## Phase 4: User Story 2 - Navigate from Activity to Ticket (Priority: P2)

**Goal**: Users can click ticket references in activity events to open the ticket detail modal

**Independent Test**: Click a ticket reference (e.g., "ABC-42") in any activity event and verify the ticket modal opens on the board view

### Tests for User Story 2

- [ ] T021 [P] [US2] RTL component test for ticket reference click in tests/unit/components/activity-feed.test.tsx

### Implementation for User Story 2

- [ ] T022 [US2] Add ticket reference click handler to ActivityEventItem in components/activity/activity-event-item.tsx
- [ ] T023 [US2] Implement navigation to board with ticket modal open in components/activity/activity-event-item.tsx

**Checkpoint**: User Story 2 complete - clicking ticket references opens ticket modal on board

---

## Phase 5: User Story 3 - See Real-Time Activity Updates (Priority: P3)

**Goal**: Activity feed automatically refreshes every 15 seconds to show new events

**Independent Test**: Post a comment on a ticket, verify it appears in the activity feed within 15 seconds without manual refresh

### Tests for User Story 3

- [ ] T024 [P] [US3] E2E test for polling behavior in tests/e2e/activity-feed.spec.ts

### Implementation for User Story 3

- [ ] T025 [US3] Configure 15-second polling interval in use-activity-feed.ts hook in app/lib/hooks/queries/use-activity-feed.ts
- [ ] T026 [US3] Implement scroll position preservation during polling updates in components/activity/activity-feed.tsx

**Checkpoint**: User Story 3 complete - feed auto-updates every 15 seconds without disrupting scroll position

---

## Phase 6: User Story 4 - Load Older Activity (Priority: P4)

**Goal**: Users can load more historical events through pagination when there are more than 50 events

**Independent Test**: Scroll to bottom of feed with 50+ events, click "Load more", verify additional events append

### Tests for User Story 4

- [ ] T027 [P] [US4] RTL component test for Load more button visibility in tests/unit/components/activity-feed.test.tsx
- [ ] T028 [P] [US4] RTL component test for Load more click behavior in tests/unit/components/activity-feed.test.tsx

### Implementation for User Story 4

- [ ] T029 [US4] Implement pagination state management in useActivityFeed hook in app/lib/hooks/queries/use-activity-feed.ts
- [ ] T030 [US4] Add Load more button with visibility logic in components/activity/activity-feed.tsx
- [ ] T031 [US4] Implement event appending on Load more click in components/activity/activity-feed.tsx

**Checkpoint**: User Story 4 complete - users can paginate through full 30-day history

---

## Phase 7: User Story 5 - Navigate to Activity from Header (Priority: P5)

**Goal**: Users can access activity feed via header navigation link from any project page

**Independent Test**: From any project page (board, analytics, settings), click "Activity" link in header, verify navigation to activity page

### Tests for User Story 5

- [ ] T032 [P] [US5] E2E test for header navigation flow in tests/e2e/activity-feed.spec.ts

### Implementation for User Story 5

- [ ] T033 [US5] Add Activity navigation link to project header in components/layout/header.tsx
- [ ] T034 [US5] Add "Back to Board" button to activity page in app/projects/[projectId]/activity/page.tsx

**Checkpoint**: User Story 5 complete - activity discoverable via header navigation

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, edge cases, and E2E validation

- [ ] T035 [P] Handle deleted ticket edge case (show "(deleted)" non-clickable) in components/activity/activity-event-item.tsx
- [ ] T036 [P] Handle deleted user edge case (show "Deleted user" with default avatar) in components/activity/activity-event-item.tsx
- [ ] T037 [P] Implement responsive layout (desktop full-width, mobile compact) in components/activity/activity-feed.tsx
- [ ] T038 [P] E2E test for full navigation flow (header → activity → ticket modal → back) in tests/e2e/activity-feed.spec.ts
- [ ] T039 Run type-check and lint, fix any errors
- [ ] T040 Run all tests (unit, integration, E2E) and ensure passing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (needs ActivityEventItem component) but extends it
- **User Story 3 (P3)**: Depends on US1 (needs useActivityFeed hook and ActivityFeed component)
- **User Story 4 (P4)**: Depends on US1 (needs useActivityFeed hook and ActivityFeed component)
- **User Story 5 (P5)**: Can start after Foundational - only needs activity page to exist

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types before utilities
- API before hooks
- Hooks before components
- Components before page
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001-T004) can run in parallel
- All Foundational tasks (T005-T007) should run sequentially (shared file)
- US1 tests (T008-T011) can run in parallel
- US1 components (T014-T016) can run in parallel
- US2, US4, US5 can run in parallel after US1 (different files)
- All Polish tasks (T035-T038) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for event transformation utilities in tests/unit/activity-event-mapping.test.ts"
Task: "Integration test for activity API authorization in tests/integration/activity/activity-api.test.ts"
Task: "Integration test for activity API pagination in tests/integration/activity/activity-api.test.ts"
Task: "Integration test for 30-day window filtering in tests/integration/activity/activity-api.test.ts"

# After tests written, launch parallel component creation:
Task: "Create ActivityEventItem component in components/activity/activity-event-item.tsx"
Task: "Create ActivityEventIcons mapping in components/activity/activity-event-icons.tsx"
Task: "Create ActivityEmptyState component in components/activity/activity-empty-state.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (clickable tickets)
4. Add User Story 3 → Test independently → Deploy/Demo (real-time updates)
5. Add User Story 4 → Test independently → Deploy/Demo (pagination)
6. Add User Story 5 → Test independently → Deploy/Demo (header navigation)
7. Complete Polish → Full feature ready

### Parallel Execution Strategy

ai-board can execute user stories in parallel after MVP:

1. Complete Setup + Foundational + User Story 1 sequentially (MVP)
2. Once US1 is done, remaining stories can run in parallel:
   - Parallel task 1: User Story 2 (ticket navigation)
   - Parallel task 2: User Story 3 (polling)
   - Parallel task 3: User Story 4 (pagination)
   - Parallel task 4: User Story 5 (header nav)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
