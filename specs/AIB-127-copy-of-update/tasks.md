# Tasks: Real-Time Ticket Modal Data Synchronization

**Input**: Design documents from `/specs/AIB-127-copy-of-update/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ticket-jobs-api.yaml ✅, quickstart.md ✅

**Tests**: Tests are REQUIRED per spec.md success criteria SC-005 and constitution compliance.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Query key foundation and type definitions required by all features

- [ ] T001 Add `ticketJobs` query key to `app/lib/query-keys.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API endpoint and hook infrastructure that MUST be complete before user stories can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Enhance jobs endpoint to return telemetry fields in `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`
- [ ] T003 Create `useTicketJobs` query hook in `app/lib/hooks/queries/useTicketJobs.ts`
- [ ] T004 Add ticketJobs cache invalidation to terminal job detection in `app/lib/hooks/useJobPolling.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Updated Ticket After Job Completion (Priority: P1) 🎯 MVP

**Goal**: Users see branch name and "View Specification" button immediately after SPECIFY job completes without page refresh

**Independent Test**: Move a ticket to SPECIFY, wait for job completion, open modal and verify branch and Spec button visibility

### Tests for User Story 1

- [ ] T005 [P] [US1] Integration test for jobs endpoint with telemetry in `tests/integration/jobs/ticket-jobs.test.ts`
- [ ] T006 [P] [US1] Unit test for ticketJobs cache invalidation in `tests/unit/useJobPolling.test.ts` (extend existing)

### Implementation for User Story 1

- [ ] T007 [US1] Update board component to use `useTicketJobs` for modal fullJobs prop in `components/board/board.tsx`
- [ ] T008 [US1] Add cache seeding for initial jobs data in `components/board/board.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional - branch and Spec button visible after job completion

---

## Phase 4: User Story 2 - Real-Time Stats Updates in Ticket Modal (Priority: P2)

**Goal**: Stats tab displays accurate, up-to-date job telemetry data without page reload

**Independent Test**: Open ticket modal's Stats tab before and after job completion, verify stats update automatically

### Tests for User Story 2

- [ ] T009 [P] [US2] Component test for Stats tab reactivity when jobs change in `tests/unit/components/ticket-stats.test.tsx`

### Implementation for User Story 2

- [ ] T010 [US2] Verify Stats tab derives data from reactive `fullJobs` prop in `components/ticket/ticket-stats.tsx` (may only need verification, not changes)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - Stats tab updates reactively

---

## Phase 5: User Story 3 - Modal Updates During Open State (Priority: P2)

**Goal**: Users with modal open see real-time updates when job status changes in background

**Independent Test**: Open modal during RUNNING job, observe automatic updates when job reaches terminal state

### Tests for User Story 3

- [ ] T011 [P] [US3] Component test for modal reactivity to ticket prop changes in `tests/unit/components/ticket-detail-modal.test.tsx`
- [ ] T012 [P] [US3] Component test for View Specification button visibility in `tests/unit/components/ticket-detail-modal.test.tsx`

### Implementation for User Story 3

- [ ] T013 [US3] Verify modal `localTicket` useEffect correctly syncs with ticket prop updates in `components/board/ticket-detail-modal.tsx` (may only need verification, not changes)

**Checkpoint**: All user stories should now be independently functional - modal updates while open

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup across all stories

- [ ] T014 Run quickstart.md verification checklist to validate all scenarios
- [ ] T015 Verify all existing tests still pass (`bun run test`)
- [ ] T016 [P] TypeScript type-check (`bun run type-check`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel
  - Or sequentially in priority order (P1 → P2 → P2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core feature, no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses same `useTicketJobs` hook from US1 foundation
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Uses same reactive data flow from foundation

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD per constitution)
- Core implementation before integration verification
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 2**: T002, T003, T004 are sequential (T003 depends on T001, T004 depends on T003)
- **Phase 3**: T005 and T006 can run in parallel (different test files)
- **Phase 4**: T009 can run in parallel with Phase 3 after T003 exists
- **Phase 5**: T011 and T012 can run in parallel (same file but different tests)
- **Phase 6**: T016 can run in parallel with T14/T15

---

## Parallel Example: User Story Test Tasks

```bash
# After Foundational phase completes, launch all test tasks in parallel:
Task: "Integration test for jobs endpoint with telemetry in tests/integration/jobs/ticket-jobs.test.ts"
Task: "Unit test for ticketJobs cache invalidation in tests/unit/useJobPolling.test.ts"
Task: "Component test for Stats tab reactivity in tests/unit/components/ticket-stats.test.tsx"
Task: "Component test for modal reactivity in tests/unit/components/ticket-detail-modal.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T004) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T005-T008)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Move ticket to SPECIFY
   - Wait for job completion
   - Open modal → verify branch and Spec button visible
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Stats reactive)
4. Add User Story 3 → Test independently → Deploy/Demo (Full real-time)
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel after Foundational:

1. Complete Setup + Foundational phases sequentially (T001-T004)
2. Once Foundational is done, tests can run in parallel:
   - Parallel task: T005 + T006 (US1 tests)
   - Parallel task: T009 (US2 tests)
   - Parallel task: T011 + T012 (US3 tests)
3. Implementation tasks follow within each story

---

## File Summary

| File | Tasks | Type |
|------|-------|------|
| `app/lib/query-keys.ts` | T001 | Modify |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | T002 | Modify |
| `app/lib/hooks/queries/useTicketJobs.ts` | T003 | Create |
| `app/lib/hooks/useJobPolling.ts` | T004 | Modify |
| `tests/integration/jobs/ticket-jobs.test.ts` | T005 | Create |
| `tests/unit/useJobPolling.test.ts` | T006 | Modify |
| `components/board/board.tsx` | T007, T008 | Modify |
| `tests/unit/components/ticket-stats.test.tsx` | T009 | Create |
| `components/ticket/ticket-stats.tsx` | T010 | Verify/Modify |
| `tests/unit/components/ticket-detail-modal.test.tsx` | T011, T012 | Create |
| `components/board/ticket-detail-modal.tsx` | T013 | Verify/Modify |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD per Constitution III)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No database schema changes required (per data-model.md)
