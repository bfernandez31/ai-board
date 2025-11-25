---
description: "Task list for Notification Click Navigation to Ticket Conversation Tab"
---

# Tasks: Notification Click Navigation to Ticket Conversation Tab

**Input**: Design documents from `/specs/AIB-80-show-ticket-conversation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included as per TDD requirements in quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js 15 App Router structure
- Components: `app/components/`, `components/`
- API: `app/api/`
- Utils: `lib/utils/`, `lib/validations/`
- Tests: `tests/unit/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create utility functions and API infrastructure needed by all user stories

- [ ] T001 [P] Create Zod validation schemas in lib/validations/notification.ts
- [ ] T002 [P] Create TypeScript interfaces file at lib/types/notification-navigation.ts (export from contracts/interfaces.ts)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create navigation utility functions in lib/utils/navigation-utils.ts
- [ ] T004 Implement mark-as-read API endpoint in app/api/notifications/[id]/read/route.ts
- [ ] T005 Add mark-as-read mutation hook in app/components/notifications/use-notifications.ts (if not exists)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Same-Project Notification Click (Priority: P1) 🎯 MVP

**Goal**: When a user clicks a notification for a ticket in the same project they're viewing, navigate directly to that ticket's conversation tab with the comment scrolled into view, all within the same browser window.

**Independent Test**: Create a mention notification within the same project, click it, and verify the ticket modal opens with the conversation tab active and scrolled to the comment.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [P] [US1] Write unit tests for navigation-utils.ts in tests/unit/navigation-utils.test.ts (test isSameProject, buildNotificationUrl, createNavigationContext)
- [ ] T007 [P] [US1] Write E2E test for same-project notification click in tests/e2e/notification-navigation.spec.ts

### Implementation for User Story 1

- [ ] T008 [US1] Modify notification-dropdown.tsx to extract current project ID from route using useParams in app/components/notifications/notification-dropdown.tsx (lines 21-27)
- [ ] T009 [US1] Update handleNotificationClick to use createNavigationContext in app/components/notifications/notification-dropdown.tsx
- [ ] T010 [US1] Implement same-window navigation with router.push() for same-project in app/components/notifications/notification-dropdown.tsx
- [ ] T011 [US1] Modify board.tsx to parse URL search params (modal, tab) and pass initialTab to TicketDetailModal in components/board/board.tsx
- [ ] T012 [US1] Add useEffect to auto-open modal when modal=open param present in components/board/board.tsx
- [ ] T013 [US1] Implement comment scroll behavior in conversation-timeline.tsx using useEffect and scrollIntoView in components/ticket/conversation-timeline.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - same-project notification clicks navigate to ticket conversation tab with comment visible

---

## Phase 4: User Story 2 - Cross-Project Notification Click (Priority: P2)

**Goal**: When a user clicks a notification for a ticket in a different project than they're viewing, open the target project's board with the ticket modal in a new browser tab, with the conversation tab selected.

**Independent Test**: Create a mention notification in Project B while viewing Project A, click it, and verify a new tab opens showing Project B's board with the ticket modal on conversation tab.

### Tests for User Story 2

- [ ] T014 [P] [US2] Write E2E test for cross-project notification click (new tab) in tests/e2e/notification-navigation.spec.ts
- [ ] T015 [P] [US2] Write E2E test verifying original tab remains unchanged after cross-project click in tests/e2e/notification-navigation.spec.ts

### Implementation for User Story 2

- [ ] T016 [US2] Implement cross-project detection logic (shouldOpenNewTab) in app/components/notifications/notification-dropdown.tsx
- [ ] T017 [US2] Add window.open() navigation for cross-project in app/components/notifications/notification-dropdown.tsx (with noopener,noreferrer)
- [ ] T018 [US2] Test that modal auto-opens with comments tab in new tab scenario

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - same-project uses same window, cross-project opens new tab

---

## Phase 5: User Story 3 - Notification Mark as Read (Priority: P3)

**Goal**: When a user clicks any notification (same-project or cross-project), the notification should be marked as read before navigation occurs, ensuring the unread count and visual indicators update immediately.

**Independent Test**: Verify that clicking any notification immediately marks it as read (visually and in database) before the navigation completes.

### Tests for User Story 3

- [ ] T019 [P] [US3] Write E2E test verifying notification marked as read before modal opens in tests/e2e/notification-navigation.spec.ts
- [ ] T020 [P] [US3] Write E2E test verifying unread count decrements immediately in tests/e2e/notification-navigation.spec.ts
- [ ] T021 [P] [US3] Write E2E test for rapid click race condition prevention in tests/e2e/notification-navigation.spec.ts

### Implementation for User Story 3

- [ ] T022 [US3] Call markAsRead.mutate() before navigation in app/components/notifications/notification-dropdown.tsx
- [ ] T023 [US3] Verify optimistic update behavior in TanStack Query mutation
- [ ] T024 [US3] Add isPending state to disable notification items during navigation in app/components/notifications/notification-dropdown.tsx
- [ ] T025 [US3] Add visual feedback (pointer-events: none, opacity) during navigation in app/components/notifications/notification-dropdown.tsx

**Checkpoint**: All user stories should now be independently functional - notifications mark as read, same-project and cross-project navigation work correctly

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T026 [P] Add error handling for deleted tickets (FR-008) across all navigation scenarios
- [ ] T027 [P] Add error handling for insufficient permissions (FR-009) across all navigation scenarios
- [ ] T028 [P] Add accessibility improvements: keyboard navigation, screen reader announcements
- [ ] T029 [P] Add TypeScript strict mode validation across all modified files
- [ ] T030 [P] Add error handling for network failures in mark-as-read mutation
- [ ] T031 Add loading states for async operations in notification dropdown
- [ ] T032 [P] Run quickstart.md validation checklist
- [ ] T033 [P] Performance testing: verify comment visible in viewport within 1 second (SC-005)
- [ ] T034 [P] Performance testing: verify unread count updates within 200ms (SC-007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 navigation logic but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances both US1 and US2 but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Utility functions before component modifications
- Navigation logic before modal state management
- Core implementation before visual feedback
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel
- T003, T004, T005 (Foundational) can run in parallel after Setup
- Once Foundational phase completes:
  - Tests for each user story (T006-T007, T014-T015, T019-T021) can run in parallel
  - User stories can be worked on in parallel by different team members
- All Polish tasks marked [P] (T026-T034) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T006: "Write unit tests for navigation-utils.ts in tests/unit/navigation-utils.test.ts"
Task T007: "Write E2E test for same-project notification click in tests/e2e/notification-navigation.spec.ts"

# After tests are failing, implement in sequence:
Task T008: "Modify notification-dropdown.tsx to extract current project ID"
Task T009: "Update handleNotificationClick to use createNavigationContext"
# ... etc.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T006-T013)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational (T001-T005) → Foundation ready
2. Add User Story 1 (T006-T013) → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 (T014-T018) → Test independently → Deploy/Demo
4. Add User Story 3 (T019-T025) → Test independently → Deploy/Demo
5. Add Polish (T026-T034) → Final validation → Deploy
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T005)
2. Once Foundational is done:
   - Developer A: User Story 1 (T006-T013)
   - Developer B: User Story 2 (T014-T018)
   - Developer C: User Story 3 (T019-T025)
3. Stories complete and integrate independently
4. Polish tasks distributed across team (T026-T034)

---

## Success Criteria Validation

After implementation, verify these success criteria from spec.md:

### Functional Requirements
- [ ] FR-001: System detects same-project vs cross-project (T009, T016)
- [ ] FR-002: Same-project navigation uses same window (T010)
- [ ] FR-003: Cross-project opens new tab (T017)
- [ ] FR-004: Modal auto-opens with comments tab (T011-T012)
- [ ] FR-005: Comment scrolls into view (T013)
- [ ] FR-006: Notification marked as read before navigation (T022)
- [ ] FR-007: Board state preserved (T010)
- [ ] FR-008: Deleted tickets handled gracefully (T026)
- [ ] FR-009: Insufficient permissions handled (T027)
- [ ] FR-010: Unread count updates immediately (T022-T023)

### Success Criteria
- [ ] SC-001: Access comment in under 2 clicks (1 click on notification)
- [ ] SC-002: Same-project navigation has no page reload
- [ ] SC-003: Cross-project notifications open new tab 100%
- [ ] SC-004: Conversation tab auto-selected 100%
- [ ] SC-005: Comment visible in viewport within 1 second (T033)
- [ ] SC-006: Notification marked read before modal opens (T022)
- [ ] SC-007: Unread count updates within 200ms (T034)
- [ ] SC-008: Zero user confusion about project/ticket context

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red-Green-Refactor TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests are required per quickstart.md workflow
- Follow TypeScript strict mode throughout
- Use TanStack Query patterns for mutations (optimistic updates)
- Leverage existing modal initialTab prop (no modal changes needed)
