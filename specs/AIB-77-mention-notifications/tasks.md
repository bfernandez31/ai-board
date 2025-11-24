# Tasks: Mention Notifications

**Input**: Design documents from `/specs/077-mention-notifications/`
**Prerequisites**: plan.md (complete), spec.md (complete), data-model.md (complete), contracts/api.md (complete)

**Tests**: Tests are OPTIONAL. This spec does NOT explicitly request TDD, so test tasks are minimal.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Web app (Next.js App Router)**: `app/`, `components/`, `lib/`, `prisma/`, `tests/`
- Paths follow Next.js 15 App Router structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and utility functions needed by all user stories

- [X] T001 Add Notification model to `prisma/schema.prisma` with fields (id, recipientId, actorId, commentId, ticketId, read, readAt, createdAt, deletedAt) and indexes
- [X] T002 Add notification relations to User model in `prisma/schema.prisma` (notificationsReceived, notificationsCreated)
- [X] T003 Add notifications relation to Comment model in `prisma/schema.prisma`
- [X] T004 Add notifications relation to Ticket model in `prisma/schema.prisma`
- [X] T005 Create and apply Prisma migration with `bun run npx prisma migrate dev --name add_notifications`
- [X] T006 [P] Create `lib/date-utils.ts` with `formatNotificationTime()` function (handles "just now", relative time, absolute dates)
- [X] T007 [P] Verify `lib/mention-parser.ts` exists with `extractMentionUserIds()` function (or create if missing)
- [X] T008 [P] Create `lib/db/notifications.ts` with database query functions (createNotificationForMention, getNotificationsForUser, getUnreadCount, markNotificationAsRead, markAllNotificationsAsRead)

**Checkpoint**: Database schema ready, utility functions available

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API endpoints and notification creation logic - MUST complete before UI work

**⚠️ CRITICAL**: No user story UI work can begin until notification creation is working

- [X] T009 Create `app/api/notifications/route.ts` with GET handler (list notifications with limit/offset, returns NotificationsResponse)
- [X] T010 Create `app/api/notifications/[id]/mark-read/route.ts` with PATCH handler (mark single notification as read)
- [X] T011 Create `app/api/notifications/mark-all-read/route.ts` with POST handler (bulk mark as read)
- [X] T012 Enhance `app/api/comments/route.ts` POST handler to detect @mentions, filter valid recipients (project members, no self-mentions), create Notification records via Prisma transaction

**Checkpoint**: Foundation ready - all API endpoints functional, notifications created on comment post

---

## Phase 3: User Story 1 - Receive Notification When Mentioned (Priority: P1) 🎯 MVP

**Goal**: When user is mentioned in a comment, they receive a notification visible via bell icon within 15 seconds

**Independent Test**: Post comment with @mention, wait 15 seconds, verify notification appears in bell dropdown for mentioned user

### Implementation for User Story 1

- [X] T013 [P] [US1] Create `components/notifications/use-notifications.ts` with TanStack Query hooks (useNotifications with 15s polling, useMarkNotificationRead, useMarkAllNotificationsRead)
- [X] T014 [P] [US1] Create `components/notifications/notification-bell.tsx` with Bell icon, Badge showing unread count (1-9 or "9+"), Popover trigger
- [X] T015 [US1] Create `components/notifications/notification-dropdown.tsx` with header (title + "Mark all as read" button), ScrollArea content, notification items list, footer with "View all" link
- [X] T016 [US1] Create `components/notifications/notification-item.tsx` component displaying actor avatar, actor name, action text ("mentioned you in [TICKET-KEY]"), comment preview (80 chars), relative timestamp, unread indicator (blue dot)
- [X] T017 [US1] Add NotificationBell component to dashboard layout header in `components/layout/header.tsx`

**Checkpoint**: User Story 1 complete - users see notifications in bell dropdown within 15 seconds of being mentioned

---

## Phase 4: User Story 2 - View and Navigate to Mentioned Comments (Priority: P1)

**Goal**: User can click notification to navigate to ticket detail page with comment visible

**Independent Test**: Click notification in dropdown, verify navigation to `/projects/{projectId}/tickets/{ticketKey}#comment-{commentId}` and notification marked as read

### Implementation for User Story 2

- [X] T018 [US2] Implement click handler in `components/notifications/notification-dropdown.tsx` that calls markAsRead mutation and navigates to ticket URL with comment anchor
- [X] T019 [US2] Verify ticket detail page `app/(dashboard)/projects/[projectId]/tickets/[ticketKey]/page.tsx` supports #comment-{id} anchor navigation (or implement if missing)
- [X] T020 [US2] Add scroll-to-comment behavior in ticket detail page (browser native or custom scroll + highlight)

**Checkpoint**: User Story 2 complete - clicking notification navigates to correct comment and marks as read

---

## Phase 5: User Story 3 - Manage Notification Read Status (Priority: P2)

**Goal**: User can mark individual notifications as read or mark all as read in one action

**Independent Test**: Click "Mark all as read" button, verify unread count becomes 0 and all notifications show as read (no blue dot)

### Implementation for User Story 3

- [X] T021 [US3] Implement "Mark all as read" button handler in `components/notifications/notification-dropdown.tsx` (already created in T015, just needs wiring)
- [X] T022 [US3] Add optimistic updates to useMarkNotificationRead mutation in `components/notifications/use-notifications.ts` (update local cache before API response)
- [X] T023 [US3] Add optimistic updates to useMarkAllNotificationsRead mutation in `components/notifications/use-notifications.ts` (set all notifications read=true, unreadCount=0)
- [X] T024 [US3] Add error rollback to both mutations (restore previous data on API failure)

**Checkpoint**: User Story 3 complete - users can manage read status with instant UI feedback

---

## Phase 6: User Story 4 - Continuous Notification Updates (Priority: P3)

**Goal**: While app is open, users receive new notifications via polling without manual refresh

**Independent Test**: With app open, create mention in separate session, verify notification appears within 15 seconds without page refresh

### Implementation for User Story 4

- [X] T025 [US4] Configure TanStack Query polling in `components/notifications/use-notifications.ts` with `refetchInterval: 15000` and `refetchIntervalInBackground: true`
- [X] T026 [US4] Add dynamic polling interval logic (15s with unread notifications, 30s when all read for efficiency)
- [X] T027 [US4] Verify badge updates automatically when polling detects new notifications
- [X] T028 [US4] Verify dropdown content updates automatically when open during polling (new notifications appear at top)

**Checkpoint**: User Story 4 complete - real-time-like experience via polling, all core functionality delivered

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T029 [P] Add data-testid attributes to notification components for E2E tests (`notification-bell`, `notification-badge`, `notification-item`, `notification-dropdown`)
- [ ] T030 [P] Add error handling for API failures in notification components (toast notifications or error states)
- [ ] T031 [P] Verify no self-mention notifications created (test in `app/api/comments/route.ts`)
- [ ] T032 [P] Verify no notifications for non-project members (test in `app/api/comments/route.ts`)
- [ ] T033 Add loading states to notification dropdown in `components/notifications/notification-dropdown.tsx` (skeleton or spinner)
- [ ] T034 Add empty state to notification dropdown ("No notifications" message)
- [ ] T035 Test multiple mentions in one comment (ensure deduplicated notifications)
- [ ] T036 Test notification behavior when source comment is deleted (notification remains but shows graceful message on navigation)
- [ ] T037 Add console logging for notification creation errors in `app/api/comments/route.ts` (don't block comment creation)
- [ ] T038 Verify 30-day retention policy is documented (implementation deferred to future cleanup job)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational (Phase 2) completion
  - User Story 1 (P1): Can start after Phase 2 - no dependencies on other stories
  - User Story 2 (P1): Builds on US1 components but can start in parallel if coordinated
  - User Story 3 (P2): Enhances US1 components (hooks need to exist from T013)
  - User Story 4 (P3): Enhances US1 polling configuration (hook needs to exist from T013)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Creates core UI components
- **User Story 2 (P1)**: Depends on T013-T017 (US1) being complete - Adds navigation behavior
- **User Story 3 (P2)**: Depends on T013 (US1) being complete - Enhances mutations with optimistic updates
- **User Story 4 (P3)**: Depends on T013 (US1) being complete - Configures polling behavior

### Within Each User Story

- **Phase 1**: T001-T005 sequential (schema changes), T006-T008 parallel with each other
- **Phase 2**: T009-T011 parallel, T012 can run parallel if API routes exist
- **Phase 3**: T013-T014 parallel, T015-T017 sequential (T015 depends on T013-T014, T017 depends on T015)
- **Phase 4**: T018 depends on T015, T019-T020 can run parallel
- **Phase 5**: T021 depends on T015, T022-T024 depend on T013
- **Phase 6**: T025-T028 all depend on T013
- **Phase 7**: Most tasks parallel except T033-T034 depend on T015

### Parallel Opportunities

**Phase 1**: T006, T007, T008 (all utility functions, different files)

**Phase 2**: T009, T010, T011 (all API routes, different directories)

**Phase 3**: T013, T014 (hooks vs bell component, different files)

**Phase 4**: T019, T020 (both in ticket detail page, may conflict - coordinate)

**Phase 7**: T029, T030, T031, T032, T037 (all different files/concerns)

---

## Parallel Example: Phase 1 (Setup)

After T005 (migration) completes, launch utilities in parallel:

```bash
# Launch all utility functions together:
Task: "Create lib/date-utils.ts with formatNotificationTime() function"
Task: "Verify lib/mention-parser.ts exists with extractMentionUserIds() function"
Task: "Create lib/db/notifications.ts with database query functions"
```

---

## Parallel Example: Phase 2 (Foundational)

Launch all API routes in parallel:

```bash
# Launch all API endpoints together:
Task: "Create app/api/notifications/route.ts with GET handler"
Task: "Create app/api/notifications/[id]/mark-read/route.ts with PATCH handler"
Task: "Create app/api/notifications/mark-all-read/route.ts with POST handler"
# Then launch comment enhancement:
Task: "Enhance app/api/comments/route.ts POST handler to create notifications"
```

---

## Parallel Example: Phase 3 (User Story 1)

Launch foundational UI components in parallel:

```bash
# Launch hooks and bell component together:
Task: "Create components/notifications/use-notifications.ts with TanStack Query hooks"
Task: "Create components/notifications/notification-bell.tsx with Bell icon and Badge"
# Then launch dropdown and item component together:
Task: "Create components/notifications/notification-dropdown.tsx with dropdown UI"
Task: "Create components/notifications/notification-item.tsx component"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (database + utilities)
2. Complete Phase 2: Foundational (API endpoints)
3. Complete Phase 3: User Story 1 (notification bell + dropdown)
4. Complete Phase 4: User Story 2 (navigation on click)
5. **STOP and VALIDATE**: Test end-to-end mention → notification → navigation flow
6. Deploy/demo if ready (core value delivered!)

### Incremental Delivery

1. **MVP Release** (US1 + US2): Users can see and act on mentions
2. **Enhancement Release** (US3): Add "mark all as read" convenience
3. **Polish Release** (US4): Add continuous polling for better UX
4. **Future Release** (Phase 7): Add E2E tests, error handling, edge case coverage

### Parallel Team Strategy

With 2 developers:

1. **Both**: Complete Phase 1 (Setup) together
2. **Both**: Complete Phase 2 (Foundational) together
3. **Split for Phase 3 (US1)**:
   - Developer A: T013 (hooks) + T014 (bell)
   - Developer B: T015 (dropdown) + T016 (item) - waits for T013/T014
4. **Developer A**: Phase 4 (US2) while **Developer B**: Phase 5 (US3)
5. **Either**: Phase 6 (US4) - minimal work
6. **Split Phase 7**: Divide polish tasks by developer preference

---

## Notes

- [P] tasks = different files, no dependencies on each other
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Stop at any checkpoint to validate story independently before proceeding
- Commit after each task or logical group of tasks
- Tests are OPTIONAL - this spec does not request TDD, so only manual testing via browser is expected
- The 30-day retention policy requires a future cleanup job (not in MVP scope)
- Full `/notifications` page is deferred to future enhancement (not in this spec)

---

## Total Task Count

- **Setup**: 8 tasks
- **Foundational**: 4 tasks (blocks all UI work)
- **User Story 1**: 5 tasks (core UI)
- **User Story 2**: 3 tasks (navigation)
- **User Story 3**: 4 tasks (read management)
- **User Story 4**: 4 tasks (polling)
- **Polish**: 10 tasks (testing, error handling, edge cases)

**Total**: 38 tasks

---

## MVP Scope (Suggested)

**Minimum Viable Product** = Setup + Foundational + User Story 1 + User Story 2 = 20 tasks

This delivers the core value: users are notified when mentioned and can navigate to the source comment.

User Stories 3 & 4 are enhancements that improve convenience and UX but are not strictly necessary for initial release.
