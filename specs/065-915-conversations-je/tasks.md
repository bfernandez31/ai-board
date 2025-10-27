# Tasks: GitHub-Style Ticket Conversations

**Input**: Design documents from `/specs/065-915-conversations-je/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in the specification. Test tasks are OMITTED per spec-kit guidelines.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app (Next.js)**: Repository root with `app/`, `components/`, `lib/`, `tests/`
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and create foundational TypeScript types

- [X] T001 Create ConversationEvent discriminated union types in lib/types/conversation-event.ts
- [X] T002 [P] Create JobEventType and TimelineItemType helper types in lib/types/conversation-event.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement getJobDisplayName() mapping function in lib/utils/job-display-names.ts
- [X] T004 [P] Implement createCommentEvent() transformation in lib/utils/conversation-events.ts
- [X] T005 [P] Implement createJobEvents() transformation in lib/utils/conversation-events.ts
- [X] T006 Implement mergeConversationEvents() merge and sort logic in lib/utils/conversation-events.ts (depends on T004, T005)
- [X] T007 [P] Implement getJobEventType() status mapper in lib/utils/conversation-events.ts
- [X] T008 [P] Implement getJobEventMessage() message generator in lib/utils/conversation-events.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Ticket Conversation Timeline (Priority: P1) 🎯 MVP

**Goal**: Display all ticket activity (comments and workflow events) in a unified conversation view, so users can quickly understand the ticket's progress without switching contexts.

**Independent Test**: Create a ticket with mixed comments and job events, then verify the timeline displays chronologically with correct formatting.

### Backend for User Story 1

- [ ] T009 [US1] Create timeline API route handler in app/api/projects/[projectId]/tickets/[ticketId]/timeline/route.ts
- [ ] T010 [US1] Add session validation and project ownership check in timeline API route
- [ ] T011 [US1] Add ticket existence and projectId validation in timeline API route
- [ ] T012 [US1] Implement Comment query with user relation in timeline API route
- [ ] T013 [US1] Implement Job query with VERIFY/SHIP exclusion filter in timeline API route
- [ ] T014 [US1] Add mergeConversationEvents() call and JSON response in timeline API route

### Frontend Data Layer for User Story 1

- [ ] T015 [P] [US1] Create fetchConversationTimeline() API client function in lib/hooks/queries/useConversationTimeline.ts
- [ ] T016 [P] [US1] Create useConversationTimeline() TanStack Query hook with 10-second polling in lib/hooks/queries/useConversationTimeline.ts
- [ ] T017 [P] [US1] Add timeline query key to queryKeys factory in lib/query-keys.ts

### UI Components for User Story 1

- [ ] T018 [P] [US1] Create Timeline layout wrapper component in components/timeline/timeline.tsx
- [ ] T019 [P] [US1] Create TimelineBadge wrapper component in components/timeline/timeline-badge.tsx
- [ ] T020 [P] [US1] Create TimelineContent wrapper component in components/timeline/timeline-content.tsx
- [ ] T021 [US1] Create TimelineItem dispatcher component with discriminated union switch in components/timeline/timeline-item.tsx
- [ ] T022 [US1] Create CommentTimelineItem display component with Avatar badge in components/timeline/comment-timeline-item.tsx
- [ ] T023 [US1] Create JobEventIcon helper component with lucide-react icons in components/timeline/job-event-timeline-item.tsx
- [ ] T024 [US1] Create JobEventTimelineItem display component with icon and message in components/timeline/job-event-timeline-item.tsx
- [ ] T025 [US1] Create ConversationTimeline container component with loading/error/empty states in components/ticket/conversation-timeline.tsx

### Integration for User Story 1

- [ ] T026 [US1] Add ConversationTimeline component to ticket detail modal/page
- [ ] T027 [US1] Add timeline query invalidation to comment creation mutation onSuccess handler
- [ ] T028 [US1] Add timeline query invalidation to job status update mutation onSuccess handler (if applicable)

**Checkpoint**: At this point, User Story 1 should be fully functional - timeline displays comments and job events chronologically with correct styling

---

## Phase 4: User Story 2 - Understand Job Lifecycle Events (Priority: P2)

**Goal**: Display when automated workflows start and complete, so users can track ticket progress and identify any delays or failures.

**Independent Test**: Trigger a workflow (e.g., INBOX → SPECIFY transition) and verify start/complete events appear with correct stage terminology.

### Implementation for User Story 2

- [ ] T029 [US2] Add getJobDisplayName() integration to JobEventTimelineItem message generation in components/timeline/job-event-timeline-item.tsx
- [ ] T030 [US2] Add quick workflow indicator (⚡) conditional rendering in JobEventTimelineItem message in components/timeline/job-event-timeline-item.tsx
- [ ] T031 [US2] Implement FAILED status event rendering with XCircle icon and "failed" message in components/timeline/job-event-timeline-item.tsx
- [ ] T032 [US2] Implement CANCELLED status event rendering with Ban icon and "cancelled" message in components/timeline/job-event-timeline-item.tsx
- [ ] T033 [US2] Add eventType="start" rendering logic with PlayCircle icon and "started" message in components/timeline/job-event-timeline-item.tsx
- [ ] T034 [US2] Add eventType="complete" rendering logic with CheckCircle icon and "completed" message in components/timeline/job-event-timeline-item.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - all job lifecycle events display with correct icons, messages, and stage terminology

---

## Phase 5: User Story 3 - GitHub-Like Visual Experience (Priority: P3)

**Goal**: Make the conversation view visually resemble GitHub's issue/PR timeline, so users can leverage existing mental models and reduce learning curve.

**Independent Test**: Visual regression testing or manual UX review comparing to GitHub conversation layout.

### Implementation for User Story 3

- [ ] T035 [US3] Add vertical timeline connector line with absolute positioning in Timeline component in components/timeline/timeline.tsx
- [ ] T036 [US3] Style Timeline with pl-10 and space-y-4 for GitHub-like spacing in components/timeline/timeline.tsx
- [ ] T037 [US3] Style TimelineBadge with circular event badge (w-8 h-8 rounded-full) for system events in components/timeline/timeline-badge.tsx
- [ ] T038 [US3] Style CommentTimelineItem with bordered box (border rounded-lg bg-mantle p-4 shadow-sm) for comments in components/timeline/comment-timeline-item.tsx
- [ ] T039 [US3] Style JobEventTimelineItem with condensed minimal styling (text-sm text-subtext0) in components/timeline/job-event-timeline-item.tsx
- [ ] T040 [US3] Add relative time formatting (formatRelativeTime) to comment timestamps in components/timeline/comment-timeline-item.tsx
- [ ] T041 [US3] Add relative time formatting (formatRelativeTime) to job event timestamps in components/timeline/job-event-timeline-item.tsx
- [ ] T042 [US3] Add semantic HTML (ol, li, time elements) with ARIA labels for accessibility in components/timeline/timeline.tsx

**Checkpoint**: All user stories should now be independently functional - visual experience matches GitHub timeline patterns with proper spacing, borders, and icon styling

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T043 [P] Add React.memo optimization to CommentTimelineItem in components/timeline/comment-timeline-item.tsx
- [ ] T044 [P] Add React.memo optimization to JobEventTimelineItem in components/timeline/job-event-timeline-item.tsx
- [ ] T045 [P] Add useMemo optimization for event key generation in Timeline component in components/timeline/timeline.tsx
- [ ] T046 Add TimelineSkeleton loading state component in components/ticket/conversation-timeline.tsx
- [ ] T047 [P] Add empty state UI ("No activity yet") in ConversationTimeline component in components/ticket/conversation-timeline.tsx
- [ ] T048 [P] Add error state UI with error message in ConversationTimeline component in components/ticket/conversation-timeline.tsx
- [ ] T049 Verify quickstart.md validation and manual testing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 components but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US1/US2 visual styling but independently testable

### Within Each User Story

- Backend (API route) before Frontend (data layer)
- Data layer (hooks) before UI components
- Layout components (Timeline, Badge, Content) before event-specific components (CommentItem, JobEventItem)
- Event components before container component (ConversationTimeline)
- Container component before integration into ticket detail modal

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel (different type definitions)
- **Phase 2**: T004/T005 can run in parallel, T007/T008 can run in parallel (different utility functions)
- **Phase 3 (US1)**:
  - T015, T016, T017 can run in parallel (data layer)
  - T018, T019, T020 can run in parallel (layout components)
- **Phase 4 (US2)**: All tasks modify same file sequentially (no parallelization)
- **Phase 5 (US3)**: T040 and T041 can run in parallel (different files), T043/T044/T045/T047/T048 can run in parallel (different files/sections)
- **Phase 6**: T043, T044, T045, T047, T048 can run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch data layer tasks together:
Task: "Create fetchConversationTimeline() API client function in lib/hooks/queries/useConversationTimeline.ts"
Task: "Create useConversationTimeline() TanStack Query hook in lib/hooks/queries/useConversationTimeline.ts"
Task: "Add timeline query key to queryKeys factory in lib/query-keys.ts"

# Launch layout components together:
Task: "Create Timeline layout wrapper component in components/timeline/timeline.tsx"
Task: "Create TimelineBadge wrapper component in components/timeline/timeline-badge.tsx"
Task: "Create TimelineContent wrapper component in components/timeline/timeline-content.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (utilities - CRITICAL, blocks all stories)
3. Complete Phase 3: User Story 1 (backend + frontend + integration)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Create ticket with comments and jobs
   - Verify timeline displays chronologically
   - Verify correct formatting (avatars, icons, messages)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
   - Users can view unified conversation timeline
3. Add User Story 2 → Test independently → Deploy/Demo
   - Users can understand job lifecycle events (start/complete/fail/cancel)
4. Add User Story 3 → Test independently → Deploy/Demo
   - Users get polished GitHub-like visual experience
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (backend + frontend)
   - Developer B: User Story 2 (event message enhancements)
   - Developer C: User Story 3 (visual styling polish)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are OMITTED (not requested in specification)
- No database schema changes required (read-only from Comment and Job tables)
- VERIFY and SHIP stages excluded from timeline (out of scope)
- Quick workflow indicator (⚡) only for quick-impl jobs with workflowType=QUICK
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Summary

**Total Tasks**: 49 tasks across 6 phases

**Task Count by Phase**:
- Phase 1 (Setup): 2 tasks
- Phase 2 (Foundational): 6 tasks
- Phase 3 (User Story 1): 20 tasks
- Phase 4 (User Story 2): 6 tasks
- Phase 5 (User Story 3): 8 tasks
- Phase 6 (Polish): 7 tasks

**Parallel Opportunities**:
- Phase 1: 1 opportunity (T002)
- Phase 2: 4 opportunities (T004, T005, T007, T008)
- Phase 3: 8 opportunities (T015-T020)
- Phase 5: 2 opportunities (T040/T041)
- Phase 6: 5 opportunities (T043-T048)

**MVP Scope** (User Story 1 only): 28 tasks (Phases 1-3)

**Implementation Strategy**: MVP first → Incremental delivery → Parallel team execution possible after Foundational phase
