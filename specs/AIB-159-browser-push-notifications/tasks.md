# Tasks: Browser Push Notifications

**Input**: Design documents from `/specs/AIB-159-browser-push-notifications/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/push-api.yaml

**Tests**: Not requested in feature specification - omitted per task generation rules.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and environment configuration

- [ ] T001 Install web-push dependency via `bun add web-push` and `bun add -D @types/web-push`
- [ ] T002 [P] Add VAPID environment variables to `.env.example` with placeholder values (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
- [ ] T003 [P] Create Zod validation schema for push subscription input in app/lib/push/subscription-schema.ts
- [ ] T004 [P] Create VAPID configuration module in app/lib/push/web-push-config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Add PushSubscription model to prisma/schema.prisma with User relation
- [ ] T006 Add pushSubscriptions relation to User model in prisma/schema.prisma
- [ ] T007 Run Prisma migration via `bunx prisma migrate dev --name add_push_subscriptions`
- [ ] T008 Create database query functions in lib/db/push-subscriptions.ts (upsertPushSubscription, getUserPushSubscriptions, deletePushSubscription, deletePushSubscriptionById, hasActiveSubscription)
- [ ] T009 Create service worker for push events in public/sw.js

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Enable Push Notifications (Priority: P1)

**Goal**: Allow project owners to opt-in to push notifications via a floating prompt

**Independent Test**: Visit ai-board, see opt-in prompt, click Enable, grant browser permission, verify subscription is saved to database

### Implementation for User Story 1

- [ ] T010 [P] [US1] Create POST /api/push/subscribe endpoint in app/api/push/subscribe/route.ts
- [ ] T011 [P] [US1] Create GET /api/push/status endpoint in app/api/push/status/route.ts
- [ ] T012 [US1] Create usePushNotifications hook with TanStack Query in app/components/push-notifications/use-push-notifications.ts
- [ ] T013 [US1] Create PushOptInPrompt component with shadcn/ui Card in app/components/push-notifications/push-opt-in-prompt.tsx
- [ ] T014 [US1] Add PushOptInPrompt to app/layout.tsx (render for authenticated users only)

**Checkpoint**: User Story 1 is fully functional - users can enable push notifications via opt-in prompt

---

## Phase 4: User Story 2 - Receive Job Completion Notification (Priority: P1)

**Goal**: Send browser notification when jobs reach terminal states (COMPLETED, FAILED, CANCELLED)

**Independent Test**: Enable notifications, trigger a job, verify browser notification appears when job reaches terminal state

### Implementation for User Story 2

- [ ] T015 [P] [US2] Create sendNotification function in app/lib/push/send-notification.ts
- [ ] T016 [P] [US2] Create NotificationListener component for service worker messages in app/components/push-notifications/notification-listener.tsx
- [ ] T017 [US2] Create sendJobCompletionNotification function in app/lib/push/send-notification.ts
- [ ] T018 [US2] Integrate job completion trigger in app/api/jobs/[id]/status/route.ts (call sendJobCompletionNotification after terminal state update)
- [ ] T019 [US2] Add NotificationListener to app/layout.tsx for handling notification click navigation

**Checkpoint**: User Story 2 is fully functional - job completion triggers push notifications for project owners

---

## Phase 5: User Story 3 - Receive @mention Notification (Priority: P2)

**Goal**: Send browser notification when user is @mentioned in a comment

**Independent Test**: Enable notifications, have another user @mention the owner in a comment, verify browser notification appears

### Implementation for User Story 3

- [ ] T020 [US3] Create sendMentionNotification function in app/lib/push/send-notification.ts
- [ ] T021 [US3] Integrate @mention trigger in app/api/projects/[projectId]/tickets/[id]/comments/route.ts (call sendMentionNotification after creating in-app notification)

**Checkpoint**: User Story 3 is fully functional - @mentions trigger push notifications for project owners

---

## Phase 6: User Story 4 - Manage Notification Preferences (Priority: P3)

**Goal**: Allow users to view and manage their push notification settings

**Independent Test**: Access notification settings, toggle push on/off, verify subscription status changes accordingly

### Implementation for User Story 4

- [ ] T022 [US4] Create POST /api/push/unsubscribe endpoint in app/api/push/unsubscribe/route.ts
- [ ] T023 [US4] Create PushNotificationManager component for settings UI in app/components/push-notifications/push-notification-manager.tsx
- [ ] T024 [US4] Add PushNotificationManager to user settings page or notification dropdown

**Checkpoint**: User Story 4 is fully functional - users can manage push notification settings

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, edge cases, and browser compatibility

- [ ] T025 [P] Add browser support detection to hide opt-in prompt on unsupported browsers in app/components/push-notifications/push-opt-in-prompt.tsx
- [ ] T026 [P] Add graceful error handling for failed push delivery in app/lib/push/send-notification.ts (delete invalid subscriptions on 404/410)
- [ ] T027 Handle subscription expiration cleanup in lib/db/push-subscriptions.ts
- [ ] T028 Verify push notifications work when browser tab is minimized/backgrounded

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001 for web-push types)
- **User Story 1 (Phase 3)**: Depends on Foundational (T005-T009)
- **User Story 2 (Phase 4)**: Depends on Foundational (T005-T009), can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on US2 (T015 for sendNotification base)
- **User Story 4 (Phase 6)**: Depends on US1 (T010-T011 for API endpoints)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Independent of US1
- **User Story 3 (P2)**: Depends on US2 (shares send-notification.ts file)
- **User Story 4 (P3)**: Can start after US1 (needs status endpoint)

### Within Each User Story

- API routes before UI components
- Hooks before components that use them
- Integration (route modifications) after core implementation

### Parallel Opportunities

- T002, T003, T004 can run in parallel (different files)
- T010, T011 can run in parallel (different API routes)
- T015, T016 can run in parallel (different files)
- T025, T026 can run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch API routes together:
Task: "Create POST /api/push/subscribe endpoint in app/api/push/subscribe/route.ts"
Task: "Create GET /api/push/status endpoint in app/api/push/status/route.ts"

# Then sequentially:
Task: "Create usePushNotifications hook" (depends on API routes)
Task: "Create PushOptInPrompt component" (depends on hook)
Task: "Add PushOptInPrompt to layout" (depends on component)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (database, service worker)
3. Complete Phase 3: User Story 1 (opt-in flow)
4. Complete Phase 4: User Story 2 (job completion notifications)
5. **STOP and VALIDATE**: Test end-to-end: opt-in → job completes → notification received
6. Deploy/demo if ready - core functionality works

### Incremental Delivery

1. **Setup + Foundational** → Infrastructure ready
2. **Add User Story 1** → Users can enable notifications (MVP increment 1)
3. **Add User Story 2** → Job completion triggers notifications (MVP increment 2)
4. **Add User Story 3** → @mentions trigger notifications (Enhancement)
5. **Add User Story 4** → Settings management (Quality of life)
6. **Polish** → Error handling, edge cases

### Parallel Execution Strategy

ai-board can execute user stories in parallel after Foundational phase:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - Parallel task 1: User Story 1 (opt-in flow)
   - Parallel task 2: User Story 2 (job notifications)
3. After US2 completes:
   - User Story 3 (mention notifications - shares file with US2)
4. After US1 completes:
   - User Story 4 (settings management)
5. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- VAPID keys must be generated once per environment (`npx web-push generate-vapid-keys`)
- Service worker must be at root scope (`/sw.js`) for full site coverage
- Push payloads limited to ~3KB per Web Push spec
