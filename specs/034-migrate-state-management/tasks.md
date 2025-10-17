# Tasks: Migrate State Management to TanStack Query

**Input**: Design documents from `/specs/034-migrate-state-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested - migration must maintain existing test suite passing without modification (FR-008)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js monolithic application with App Router
- Paths: `app/`, `components/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create core TanStack Query infrastructure

- [X] T001 Install @tanstack/react-query and @tanstack/react-query-devtools dependencies via npm
- [X] T002 [P] Create query client configuration in app/lib/query-client.ts with makeQueryClient() and getQueryClient() functions
- [X] T003 [P] Create query keys factory in app/lib/query-keys.ts with hierarchical structure for projects, tickets, jobs, users
- [X] T004 [P] Create QueryProvider component in app/providers/query-provider.tsx with dev tools integration
- [X] T005 Update root layout in app/layout.tsx to wrap application with QueryProvider

**Checkpoint**: TanStack Query infrastructure ready - query and mutation hooks can now be created

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create shared test utilities and helper types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Create test query client utility in tests/helpers/test-query-client.ts with createTestQueryClient() function
- [X] T007 [P] Create TypeScript type definitions in app/lib/types/query-types.ts for TicketsByStage, mutation variables, and optimistic contexts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Viewing Real-time Job Status Updates (Priority: P1) 🎯 MVP

**Goal**: Replace useJobPolling hook with TanStack Query to maintain 2-second polling while enabling automatic stop on terminal states

**Independent Test**: Trigger a job and observe status updates appearing automatically within 2 seconds until completion

### Implementation for User Story 1

- [X] T008 [US1] Replace useJobPolling hook implementation in app/lib/hooks/useJobPolling.ts with useQuery using refetchInterval and conditional stop logic
- [X] T009 [US1] Update Board component in components/board/board.tsx to use new useJobPolling hook (verify same interface)
- [X] T010 [US1] Run existing E2E tests for job polling (tests/e2e/job-status-update.spec.ts) to verify backward compatibility
- [X] T011 [US1] Run existing contract tests (tests/api/polling/job-status.spec.ts) to ensure API integration unchanged

**Checkpoint**: At this point, job polling should work identically to before with TanStack Query, all existing tests passing

---

## Phase 4: User Story 2 - Creating and Managing Tickets (Priority: P1)

**Goal**: Implement optimistic updates for ticket operations (create, update, delete, drag-and-drop) using TanStack Query mutations

**Independent Test**: Create a ticket, edit its details, and drag between stages - all operations should show immediate UI feedback with automatic rollback on errors

### Implementation for User Story 2

- [X] T012 [P] [US2] Create useProjectTickets query hook in app/lib/hooks/queries/useTickets.ts with 5-second stale time
- [X] T013 [P] [US2] Create useTicketsByStage query hook in app/lib/hooks/queries/useTickets.ts to group tickets by stage
- [X] T014 [P] [US2] Create useCreateTicket mutation hook in app/lib/hooks/mutations/useCreateTicket.ts with optimistic update logic
- [X] T015 [P] [US2] Create useUpdateTicket mutation hook in app/lib/hooks/mutations/useUpdateTicket.ts with optimistic update and rollback
- [X] T016 [P] [US2] Create useDeleteTicket mutation hook in app/lib/hooks/mutations/useDeleteTicket.ts with optimistic update
- [X] T017 [P] [US2] Create useStageTransition mutation hook in app/lib/hooks/mutations/useStageTransition.ts for drag-and-drop with optimistic update
- [X] T018 [US2] Update Board component in components/board/board.tsx to use useTicketsByStage query instead of manual fetch
- [X] T019 [US2] Update Board component handleDragEnd in components/board/board.tsx to use useStageTransition mutation
- [X] T020 [US2] Update TicketCard component in components/board/ticket-card.tsx to use useUpdateTicket and useDeleteTicket mutations
- [X] T021 [US2] Update TicketForm component in components/forms/ticket-form.tsx to use useCreateTicket and useUpdateTicket mutations
- [X] T022 [US2] Run existing E2E tests for ticket management (tests/e2e/*.spec.ts) to verify all operations work with optimistic updates
- [X] T023 [US2] Verify optimistic update rollback by simulating API failures in dev tools

**Checkpoint**: At this point, all ticket operations should have instant UI feedback with automatic error handling, all existing tests passing

---

## Phase 5: User Story 3 - Tab Focus Behavior (Priority: P2)

**Goal**: Verify refetchOnWindowFocus: false configuration prevents unnecessary API calls when switching browser tabs

**Independent Test**: Open board in tab, switch to another tab and back, monitor network activity - should see zero refetch requests

### Implementation for User Story 3

- [X] T024 [US3] Verify query client configuration in app/lib/query-client.ts has refetchOnWindowFocus: false in defaultOptions
- [X] T025 [US3] Add manual refresh capability by exposing refetch function in Board component in components/board/board.tsx
- [X] T026 [US3] Add refresh button UI in Board component to allow users to manually update data
- [X] T027 [US3] Test tab switching behavior manually by monitoring network tab - verify zero refetches occur on focus changes

**Checkpoint**: Tab switching should produce zero API calls, manual refresh button provides explicit control

---

## Phase 6: User Story 4 - Project Settings Management (Priority: P2)

**Goal**: Add TanStack Query for project settings with optimistic updates and appropriate cache configuration

**Independent Test**: Change clarification policy setting and observe immediate UI update with server synchronization

### Implementation for User Story 4

- [X] T028 [P] [US4] Create useProjectDetails query hook in app/lib/hooks/queries/useProject.ts with 5-minute stale time for static data
- [X] T029 [P] [US4] Create useUpdateProjectSettings mutation hook in app/lib/hooks/mutations/useUpdateProject.ts with optimistic update
- [X] T030 [US4] Update project settings components to use useProjectDetails query and useUpdateProjectSettings mutation
- [X] T031 [US4] Run existing tests for project settings to verify backward compatibility

**Checkpoint**: Project settings should update immediately with optimistic feedback and server synchronization

---

## Phase 7: User Story 5 - Background Data Synchronization (Priority: P3)

**Goal**: Verify intelligent caching reduces duplicate API calls and shares data across components

**Independent Test**: Monitor network activity during various user interactions - verify request deduplication and cache sharing

### Implementation for User Story 5

- [X] T032 [US5] Add server-side prefetching to board page in app/projects/[projectId]/board/page.tsx using HydrationBoundary
- [X] T033 [US5] Prefetch tickets query on server using Prisma in app/projects/[projectId]/board/page.tsx
- [X] T034 [US5] Prefetch jobs query on server using Prisma in app/projects/[projectId]/board/page.tsx
- [X] T035 [US5] Verify cache deduplication by opening multiple components that request same data - should see single API call
- [X] T036 [US5] Monitor API call reduction metrics - verify 30%+ reduction compared to baseline (before migration)

**Checkpoint**: Server-side hydration improves initial load, client-side caching prevents duplicate requests

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and final validation across all user stories

- [X] T037 [P] Remove old useJobPolling implementation code if fully replaced (backup first)
- [X] T038 [P] Update CLAUDE.md active technologies section to document TanStack Query v5.90.5 usage patterns
- [X] T039 [P] Update constitution.md State Management section to establish TanStack Query as standard (FR-013)
- [X] T040 [P] Add TanStack Query usage examples to project documentation in docs/ or README
- [X] T041 Run full E2E test suite (npm run test:e2e) to verify zero regressions across all user stories
- [X] T042 Run type checking (npm run type-check) to ensure no TypeScript errors introduced
- [X] T043 Verify bundle size increase is under 50KB gzipped using npm run build and checking output
- [X] T044 [P] Enable React Query DevTools in development for debugging support
- [X] T045 Document query key conventions and mutation patterns for team in quickstart.md or team docs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel if staffed
  - Or sequentially in priority order (US1 → US2 → US3 → US4 → US5)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories (independent)
- **User Story 3 (P2)**: Can start after Foundational - Validates US1 and US2 configuration (weak dependency)
- **User Story 4 (P2)**: Can start after Foundational - No dependencies on other stories (independent)
- **User Story 5 (P3)**: Can start after US2 completed (needs ticket queries for prefetch testing)

### Within Each User Story

- Query hooks before component updates
- Mutation hooks before component integration
- Component updates after hooks ready
- Testing after implementation complete

### Parallel Opportunities

- **Setup Phase**: T002, T003, T004 can run in parallel (different files)
- **Foundational Phase**: T006, T007 can run in parallel
- **US1**: T010, T011 (tests) can run in parallel
- **US2**: T012-T017 (all hooks) can run in parallel - different files
- **US4**: T028, T029 can run in parallel
- **Polish**: T037, T038, T039, T040, T044 can run in parallel

**Team Strategy**: After Foundational phase completes, US1, US2, and US4 can be assigned to different developers simultaneously

---

## Parallel Example: User Story 2

```bash
# Launch all mutation hook creation tasks together:
Task: "Create useCreateTicket mutation hook in app/lib/hooks/mutations/useCreateTicket.ts"
Task: "Create useUpdateTicket mutation hook in app/lib/hooks/mutations/useUpdateTicket.ts"
Task: "Create useDeleteTicket mutation hook in app/lib/hooks/mutations/useDeleteTicket.ts"
Task: "Create useStageTransition mutation hook in app/lib/hooks/mutations/useStageTransition.ts"

# Then sequentially integrate into components after hooks complete
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (5 tasks)
2. Complete Phase 2: Foundational (2 tasks)
3. Complete Phase 3: User Story 1 - Job Polling (4 tasks)
4. Complete Phase 4: User Story 2 - Ticket Management (12 tasks)
5. **STOP and VALIDATE**: Run full test suite, verify all existing functionality works
6. Deploy/demo if ready

**MVP Delivers**: Real-time job updates + optimistic ticket operations with TanStack Query

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready (7 tasks)
2. Add US1 (Job Polling) → Test independently → Deploy/Demo (MVP foundation - 4 tasks)
3. Add US2 (Ticket Management) → Test independently → Deploy/Demo (Core value - 12 tasks)
4. Add US3 (Tab Focus) → Test independently → Deploy/Demo (Performance win - 4 tasks)
5. Add US4 (Settings) → Test independently → Deploy/Demo (Complete migration - 4 tasks)
6. Add US5 (Prefetch) → Test independently → Deploy/Demo (SSR optimization - 5 tasks)
7. Polish phase → Final validation and documentation (9 tasks)

### Parallel Team Strategy

With 2-3 developers:

1. Team completes Setup + Foundational together (1-2 hours)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (Job Polling) - 4 tasks
   - **Developer B**: User Story 2 (Ticket Management) - 12 tasks
   - **Developer C**: User Story 4 (Settings) - 4 tasks
3. Then sequentially complete US3 (validation) and US5 (optimization)
4. Finally Polish phase together

**Total Task Count**: 45 tasks

---

## Notes

- **[P] tasks**: Different files, no dependencies - safe for parallel execution
- **[Story] label**: Maps task to specific user story for traceability
- **No Tests Required**: Existing test suite must pass unchanged (FR-008) - migration maintains backward compatibility
- **Incremental Approach**: Each user story can be completed and validated independently
- **Rollback Safe**: Can stop after any user story and have working functionality
- **Constitution Alignment**: All tasks align with TypeScript-first, component-driven, and test-driven principles
- **Bundle Size**: Final validation (T043) ensures <50KB increase constraint met
- **Zero Breaking Changes**: All existing API contracts and component interfaces preserved