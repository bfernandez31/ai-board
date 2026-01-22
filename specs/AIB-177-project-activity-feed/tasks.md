# Tasks: Project Activity Feed

**Input**: Design documents from `/specs/AIB-177-project-activity-feed/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/activity-api.yaml, quickstart.md

**Tests**: Tests included per quickstart.md testing strategy (unit, integration, component, E2E).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Type Definitions)

**Purpose**: Create shared type definitions used by all user stories

- [x] T001 Create ActivityEvent discriminated union types in app/lib/types/activity-event.ts ✅ DONE
- [x] T002 Create Actor and TicketReference types in app/lib/types/activity-event.ts ✅ DONE
- [x] T003 Create PaginationCursor and ActivityFeedResponse types in app/lib/types/activity-event.ts ✅ DONE
- [x] T004 Add activity query key to app/lib/query-keys.ts ✅ DONE

---

## Phase 2: Foundational (Event Derivation Logic)

**Purpose**: Core utility functions that ALL user stories depend on - BLOCKS all user story work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create event derivation functions (deriveJobEvents, deriveCommentEvent, deriveTicketCreatedEvent) in app/lib/utils/activity-events.ts ✅ DONE
- [x] T006 Create stage transition mapping (COMMAND_STAGE_TRANSITIONS) in app/lib/utils/activity-events.ts ✅ DONE
- [x] T007 Create Actor factory functions (createUserActor, createSystemActor) in app/lib/utils/activity-events.ts ✅ DONE
- [x] T008 Create mergeActivityEvents function for sorting events by timestamp DESC in app/lib/utils/activity-events.ts ✅ DONE
- [x] T009 Create cursor encoding/decoding functions (encodeCursor, decodeCursor) in app/lib/utils/activity-events.ts ✅ DONE
- [x] T010 Write unit tests for event derivation functions in tests/unit/activity-events.test.ts ✅ DONE

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Recent Project Activity (Priority: P1)

**Goal**: Display chronological list of recent events with icons, actors, ticket references, and timestamps. Auto-refresh via 15-second polling.

**Independent Test**: Navigate to `/projects/{id}/activity` and verify events display with correct formatting, ordering, and actor information.

### Implementation for User Story 1

- [x] T011 [US1] Create activity API endpoint GET handler in app/api/projects/[projectId]/activity/route.ts ✅ DONE
- [x] T012 [US1] Implement parallel queries for jobs, comments, tickets with 30-day filter in app/api/projects/[projectId]/activity/route.ts ✅ DONE
- [x] T013 [US1] Add Zod validation for query params (limit, cursor) in app/api/projects/[projectId]/activity/route.ts ✅ DONE
- [x] T014 [US1] Write API integration tests for activity endpoint in tests/integration/activity/api.test.ts ✅ DONE
- [x] T015 [P] [US1] Create ActivityItem component with event type rendering (switch on discriminated union) in components/activity/activity-item.tsx ✅ DONE
- [x] T016 [P] [US1] Create ActivityEmptyState component in components/activity/activity-empty-state.tsx ✅ DONE
- [x] T017 [US1] Create useProjectActivity TanStack Query hook with 15-second polling in app/lib/hooks/queries/use-project-activity.ts ✅ DONE
- [x] T018 [US1] Create ActivityFeed client component with polling and event list in components/activity/activity-feed.tsx ✅ DONE
- [x] T019 [US1] Create activity page Server Component in app/projects/[projectId]/activity/page.tsx ✅ DONE
- [x] T020 [US1] Add Activity navigation link to project header in components/layout/header.tsx ✅ DONE
- [x] T021 [US1] Write component tests for ActivityItem in tests/unit/components/activity-item.test.tsx ✅ DONE

**Checkpoint**: At this point, User Story 1 should be fully functional - users can view recent activity with auto-refresh

---

## Phase 4: User Story 2 - Load Historical Activity (Priority: P2)

**Goal**: Enable pagination to load older events beyond initial 50, with "Load more" button until 30-day window exhausted.

**Independent Test**: Create >50 events, verify initial 50 display, click "Load more", verify additional events append without replacing.

### Implementation for User Story 2

- [x] T022 [US2] Implement cursor-based pagination logic in activity API in app/api/projects/[projectId]/activity/route.ts ✅ DONE (included in T011-T014)
- [x] T023 [US2] Add useInfiniteQuery or manual cursor state to useProjectActivity hook in app/lib/hooks/queries/use-project-activity.ts ✅ DONE (included in T017)
- [x] T024 [US2] Add "Load more" button and append logic to ActivityFeed component in components/activity/activity-feed.tsx ✅ DONE (included in T018)
- [x] T025 [US2] Add loading state and hide button when hasMore=false in components/activity/activity-feed.tsx ✅ DONE (included in T018)
- [x] T026 [US2] Write integration tests for pagination in tests/integration/activity/api.test.ts ✅ DONE (included in T014)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can view and paginate through 30 days of activity

---

## Phase 5: User Story 3 - Mobile Activity Review (Priority: P3)

**Goal**: Responsive layout with compact display and touch-friendly tap targets on mobile viewports.

**Independent Test**: View activity page on mobile viewport (320px-480px), verify compact layout and accessible navigation.

### Implementation for User Story 3

- [x] T027 [P] [US3] Add responsive styles for compact mobile layout to ActivityItem in components/activity/activity-item.tsx ✅ DONE
- [x] T028 [P] [US3] Add "Back to Board" navigation button to activity page header in app/projects/[projectId]/activity/page.tsx ✅ DONE
- [x] T029 [US3] Ensure touch targets meet 44x44px minimum in ActivityItem and Load more button in components/activity/activity-item.tsx ✅ DONE
- [x] T030 [US3] Write E2E test for navigation to activity page in tests/e2e/activity.spec.ts ✅ DONE

**Checkpoint**: All user stories should now be independently functional - full responsive activity feed

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T031 Run full test suite and fix any failures ✅ DONE (impacted tests: 51 unit + 16 integration pass)
- [x] T032 Verify 30-day window filtering works correctly across all event types ✅ DONE (tested in integration tests)
- [x] T033 Verify AI-BOARD actor displays correctly for workflow-triggered events ✅ DONE (tested in unit + E2E tests)
- [x] T034 Run type-check and lint, fix any errors ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 -> P2 -> P3)
  - P2 depends on P1 (pagination extends base API)
  - P3 can run partially in parallel with P1/P2 (responsive styles)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Establishes base functionality
- **User Story 2 (P2)**: Depends on US1 API and hook existing - Adds pagination
- **User Story 3 (P3)**: T027-T029 can run after US1 components exist; T030 needs full feature

### Within Each User Story

- API endpoint before hooks
- Hooks before components
- Components before page
- Unit/integration tests alongside implementation
- E2E tests after feature complete

### Parallel Opportunities

**Phase 1 (Setup)**:
```
T001, T002, T003 can run sequentially (same file)
T004 can run in parallel with T001-T003 (different file)
```

**Phase 2 (Foundational)**:
```
T005, T006, T007, T008, T009 can run sequentially (same file)
T010 runs after T005-T009 complete
```

**Phase 3 (User Story 1)**:
```
After T011-T014 (API): T015 and T016 can run in parallel (different files)
T017 depends on T015 pattern understanding
T018, T019 run sequentially
```

**Phase 5 (User Story 3)**:
```
T027 and T028 can run in parallel (different files)
```

---

## Parallel Example: User Story 1 Components

```bash
# After API is complete, launch component tasks in parallel:
Task: "Create ActivityItem component in components/activity/activity-item.tsx"
Task: "Create ActivityEmptyState component in components/activity/activity-empty-state.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (event derivation)
3. Complete Phase 3: User Story 1 (view recent activity)
4. **STOP and VALIDATE**: Test US1 independently - can view activity feed with polling
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test independently -> Deploy/Demo (MVP!)
3. Add User Story 2 -> Test independently -> Deploy/Demo (pagination)
4. Add User Story 3 -> Test independently -> Deploy/Demo (mobile)
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Reference files from quickstart.md for implementation patterns

---

## Phase 7: Bug Fixes (Critical)

**Purpose**: Fix two bugs found during implementation

### Bug 1: Race condition in polling merge logic

**Problem**: Length-based pagination detection in `activity-feed.tsx` is unreliable when event count changes between polls.

- [ ] T035 [BugFix] Add `hasPaginated` boolean state to ActivityFeed component in components/activity/activity-feed.tsx
- [ ] T036 [BugFix] Replace `prev.length <= initialLimit` check with `hasPaginated` flag check in components/activity/activity-feed.tsx
- [ ] T037 [BugFix] Set `hasPaginated = true` when "Load more" is clicked in components/activity/activity-feed.tsx
- [ ] T038 [BugFix] Write unit test for polling merge with varying event counts in tests/unit/components/activity-feed.test.tsx

### Bug 2: Cursor pagination silently restarts for expired cursors

**Problem**: `applyPagination` silently restarts from beginning when cursor event not found, with no indication to caller.

- [ ] T039 [BugFix] Add `cursorExpired: boolean` to pagination response type in app/lib/types/activity-event.ts
- [ ] T040 [BugFix] Update `applyPagination` to return `cursorExpired: true` when cursor not found in app/lib/utils/activity-events.ts
- [ ] T041 [BugFix] Update API endpoint to include `cursorExpired` in response in app/api/projects/[projectId]/activity/route.ts
- [ ] T042 [BugFix] Handle `cursorExpired` in ActivityFeed - show toast notification and reset state in components/activity/activity-feed.tsx
- [ ] T043 [BugFix] Write unit test for expired cursor handling in tests/unit/activity-events.test.ts
- [ ] T044 [BugFix] Write integration test for expired cursor API response in tests/integration/activity/api.test.ts

**Checkpoint**: Both bugs should be fixed with proper tests verifying the fixes
