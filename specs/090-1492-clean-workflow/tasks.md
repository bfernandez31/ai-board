# Tasks: Clean Workflow

**Input**: Design documents from `/specs/090-1492-clean-workflow/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - only included if explicitly requested. This feature specification does NOT explicitly request TDD/tests, so test tasks are NOT included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and project initialization

- [ ] T001 Add CLEAN value to WorkflowType enum in prisma/schema.prisma
- [ ] T002 Add activeCleanupJobId nullable field to Project model in prisma/schema.prisma
- [ ] T003 Add index on activeCleanupJobId field in prisma/schema.prisma
- [ ] T004 Generate and apply Prisma migration with command: npx prisma migrate dev --name add_cleanup_workflow
- [ ] T005 Verify migration applied successfully by checking Project table has activeCleanupJobId column

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Create shipped-branches.ts utility file in lib/db/shipped-branches.ts with getLastCleanupDate function
- [ ] T007 [P] Add getShippedBranchesSinceLastClean function to lib/db/shipped-branches.ts
- [ ] T008 [P] Add validateBranches function to lib/db/shipped-branches.ts
- [ ] T009 [P] Create transition-lock.ts utility file in lib/transition-lock.ts with isProjectLocked function
- [ ] T010 [P] Add clearCleanupLock function to lib/transition-lock.ts
- [ ] T011 [P] Create getNextTicketNumber helper function in lib/db/tickets.ts (if not exists)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Trigger Project Cleanup (Priority: P1) 🎯 MVP

**Goal**: Enable project maintainers to trigger cleanup workflow from the UI to analyze and fix technical debt from recently shipped features

**Independent Test**: Click "Clean Project" menu option, verify new cleanup ticket is created in BUILD stage with correct title format "Clean YYYY-MM-DD", description lists shipped branches, and initial job with status PENDING is created. Verify project.activeCleanupJobId is set.

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create cleanup API route file at app/api/projects/[projectId]/clean/route.ts with POST handler skeleton
- [ ] T013 [US1] Implement authorization check using verifyProjectAccess in app/api/projects/[projectId]/clean/route.ts
- [ ] T014 [US1] Add existing cleanup validation check (409 if activeCleanupJobId exists with PENDING/RUNNING job) in app/api/projects/[projectId]/clean/route.ts
- [ ] T015 [US1] Add shipped branches retrieval logic using getLastCleanupDate and getShippedBranchesSinceLastClean in app/api/projects/[projectId]/clean/route.ts
- [ ] T016 [US1] Add validation for empty shipped branches (400 if no branches found) in app/api/projects/[projectId]/clean/route.ts
- [ ] T017 [US1] Implement atomic transaction to create cleanup ticket + job + set activeCleanupJobId in app/api/projects/[projectId]/clean/route.ts
- [ ] T018 [US1] Add workflow dispatch logic to trigger cleanup.yml with shipped branches in app/api/projects/[projectId]/clean/route.ts
- [ ] T019 [US1] Return 201 response with ticket, job, shippedBranches, and lastCleanDate in app/api/projects/[projectId]/clean/route.ts
- [ ] T020 [P] [US1] Create CleanupConfirmDialog component at components/cleanup/CleanupConfirmDialog.tsx
- [ ] T021 [US1] Add POST /api/projects/{projectId}/clean API call handler with loading and error states in components/cleanup/CleanupConfirmDialog.tsx
- [ ] T022 [US1] Add success toast notification in components/cleanup/CleanupConfirmDialog.tsx
- [ ] T023 [US1] Find ProjectMenu component in app/(dashboard)/projects/[id]/components/ProjectMenu.tsx
- [ ] T024 [US1] Add "Clean Project" menu option with Sparkles icon to ProjectMenu dropdown in app/(dashboard)/projects/[id]/components/ProjectMenu.tsx
- [ ] T025 [US1] Add state management for CleanupConfirmDialog visibility in app/(dashboard)/projects/[id]/components/ProjectMenu.tsx
- [ ] T026 [US1] Render CleanupConfirmDialog component conditionally in app/(dashboard)/projects/[id]/components/ProjectMenu.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - users can trigger cleanup from menu, cleanup ticket is created in BUILD stage, job is created with PENDING status, and project lock is applied

---

## Phase 4: User Story 2 - Execute Automated Cleanup Analysis (Priority: P2)

**Goal**: System automatically analyzes code changes from shipped branches to identify and fix technical debt without breaking existing functionality

**Independent Test**: Dispatch cleanup workflow with predefined shipped branches, monitor workflow execution logs, verify analysis runs on code/tests/docs from specified branches, confirm cleanup PR is created with fixes, verify tests pass, and ticket transitions to VERIFY stage upon completion.

### Implementation for User Story 2

- [ ] T027 [P] [US2] Create cleanup.yml workflow file at .github/workflows/cleanup.yml with workflow_dispatch trigger
- [ ] T028 [US2] Add workflow inputs (ticket_id, project_id, job_id, shipped_branches, githubRepository) to cleanup.yml
- [ ] T029 [US2] Configure workflow environment with WORKFLOW_API_TOKEN, timeout 45 minutes, PostgreSQL service in cleanup.yml
- [ ] T030 [US2] Add checkout step for main branch with full history (fetch-depth: 0) in cleanup.yml
- [ ] T031 [US2] Add Node.js setup, dependency installation, and Prisma generation steps in cleanup.yml
- [ ] T032 [US2] Add Playwright installation step for test validation in cleanup.yml
- [ ] T033 [US2] Add step to create cleanup branch (cleanup-YYYYMMDD) in cleanup.yml
- [ ] T034 [US2] Add step to prepare cleanup payload JSON file with shipped branches in cleanup.yml
- [ ] T035 [US2] Add Claude CLI installation and execution step with /cleanup command in cleanup.yml
- [ ] T036 [US2] Add test validation step (bun run test) after cleanup in cleanup.yml
- [ ] T037 [US2] Add PR creation step with gh pr create (no auto-merge) in cleanup.yml
- [ ] T038 [US2] Add job status update steps (RUNNING at start, COMPLETED/FAILED at end) in cleanup.yml
- [ ] T039 [US2] Add ticket transition to VERIFY stage on successful completion in cleanup.yml
- [ ] T040 [P] [US2] Create cleanup.md Claude command at .claude/commands/cleanup.md
- [ ] T041 [US2] Add instructions to parse shipped_branches from JSON payload in .claude/commands/cleanup.md
- [ ] T042 [US2] Add git diff analysis instructions for each shipped branch in .claude/commands/cleanup.md
- [ ] T043 [US2] Add technical debt identification rules (code, tests, documentation) in .claude/commands/cleanup.md
- [ ] T044 [US2] Add safety constraints (no behavior changes, test-first validation, incremental fixes) in .claude/commands/cleanup.md
- [ ] T045 [US2] Add instructions to commit fixes incrementally and validate tests after each change in .claude/commands/cleanup.md
- [ ] T046 [US2] Add final validation step to ensure all tests pass before creating PR in .claude/commands/cleanup.md

**Checkpoint**: At this point, User Story 2 should be fully functional - cleanup workflow executes when triggered, analyzes shipped branches, applies fixes with test validation, creates PR for review, and transitions ticket to VERIFY stage

---

## Phase 5: User Story 3 - Prevent Conflicts During Cleanup (Priority: P3)

**Goal**: While cleanup workflow executes, system prevents stage transitions on all tickets to avoid conflicts, while still allowing users to update ticket content

**Independent Test**: Start cleanup workflow, attempt to transition any ticket (expect 423 Locked response), verify UI shows informative banner, update ticket description/documents/preview (expect success), complete cleanup workflow, attempt transition again (expect success), verify banner disappears.

### Implementation for User Story 3

- [ ] T047 [US3] Locate transition API route at app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T048 [US3] Add cleanup lock check after ticket fetch in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T049 [US3] Query project.activeCleanupJobId and associated job status in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T050 [US3] Return 423 Locked response if cleanup job is PENDING or RUNNING in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T051 [US3] Add self-healing logic to clear lock if job is in terminal state (COMPLETED/FAILED/CANCELLED) in app/api/projects/[projectId]/tickets/[id]/transition/route.ts
- [ ] T052 [US3] Locate job status update API route at app/api/jobs/[id]/status/route.ts
- [ ] T053 [US3] Add cleanup lock release logic after job status update in app/api/jobs/[id]/status/route.ts
- [ ] T054 [US3] Query project where activeCleanupJobId matches current job ID in app/api/jobs/[id]/status/route.ts
- [ ] T055 [US3] Clear activeCleanupJobId when job reaches terminal state (COMPLETED/FAILED/CANCELLED) in app/api/jobs/[id]/status/route.ts
- [ ] T056 [US3] Add console log for lock release confirmation in app/api/jobs/[id]/status/route.ts
- [ ] T057 [P] [US3] Create CleanupInProgressBanner component at components/cleanup/CleanupInProgressBanner.tsx
- [ ] T058 [US3] Use useJobPolling hook to monitor cleanup job status in components/cleanup/CleanupInProgressBanner.tsx
- [ ] T059 [US3] Render Alert component with warning variant when job is PENDING or RUNNING in components/cleanup/CleanupInProgressBanner.tsx
- [ ] T060 [US3] Display message about transitions being disabled and content updates being allowed in components/cleanup/CleanupInProgressBanner.tsx
- [ ] T061 [US3] Return null when job is in terminal state to hide banner in components/cleanup/CleanupInProgressBanner.tsx
- [ ] T062 [US3] Locate board component (likely at app/(dashboard)/projects/[id]/board.tsx or components/board/board.tsx)
- [ ] T063 [US3] Add CleanupInProgressBanner component at top of board layout with project.activeCleanupJobId prop
- [ ] T064 [US3] Add conditional rendering to show banner only when activeCleanupJobId is not null
- [ ] T065 [US3] Update project data fetching to include activeCleanupJobId field in board query
- [ ] T066 [US3] Locate drag-and-drop transition handler in board component
- [ ] T067 [US3] Add cleanup lock check before allowing drag-and-drop transition
- [ ] T068 [US3] Show toast notification with "Transition blocked" message when lock is active
- [ ] T069 [US3] Include helpful message in toast about content updates being allowed

**Checkpoint**: All user stories should now be independently functional - transitions are blocked during cleanup, users see clear feedback via banner and toast messages, content updates remain allowed, and lock is automatically released when cleanup completes

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T070 [P] Update CLAUDE.md with cleanup workflow documentation including trigger, workflow type, and lock behavior
- [ ] T071 [P] Add TypeScript type definitions for CleanupTriggerResponse and CleanupLockError in types/api.ts
- [ ] T072 [P] Add Zod validation schema for cleanup API request in lib/validation/cleanup.ts
- [ ] T073 [P] Update Project type definition to include activeCleanupJobId field in types/project.ts
- [ ] T074 [P] Update WorkflowType enum in types/ticket.ts to include CLEAN value
- [ ] T075 Verify all API error codes match OpenAPI specification in cleanup-api.yaml
- [ ] T076 Verify workflow inputs match workflow-dispatch.yaml contract specification
- [ ] T077 Run TypeScript type check with bun run type-check and fix any errors
- [ ] T078 Run existing test suite with bun run test to ensure no regressions
- [ ] T079 Manually test cleanup trigger, lock behavior, and workflow execution end-to-end
- [ ] T080 Update quickstart.md with actual implementation timings and any troubleshooting notes discovered

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion
- **User Story 3 (Phase 5)**: Depends on Foundational phase + User Story 1 (needs cleanup API endpoint)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1, but US1 provides cleanup trigger
- **User Story 3 (P3)**: Depends on User Story 1 (needs cleanup API to create activeCleanupJobId) - Otherwise independent

### Within Each User Story

- **User Story 1**: API tasks (T012-T019) before UI tasks (T020-T026), but T020 can start in parallel with T013-T019
- **User Story 2**: Workflow file (T027-T039) and Claude command (T040-T046) can be developed in parallel
- **User Story 3**: Backend tasks (T047-T056) before UI tasks (T057-T069), but T057 can start in parallel with T048-T056

### Parallel Opportunities

- **Setup**: T001, T002, T003 can run in parallel (different schema sections)
- **Foundational**: T006-T010 can all run in parallel (different files)
- **User Story 1**: T012-T019 (API) and T020-T021 (UI component) can run in parallel
- **User Story 2**: T027-T039 (workflow) and T040-T046 (command) can run in parallel
- **User Story 3**: T047-T056 (backend) and T057-T061 (component) can run in parallel
- **Polish**: T070-T076 can all run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch API implementation and UI component in parallel:
Task: "Create cleanup API route file at app/api/projects/[projectId]/clean/route.ts"
Task: "Create CleanupConfirmDialog component at components/cleanup/CleanupConfirmDialog.tsx"

# Then integrate:
Task: "Add POST /api/projects/{projectId}/clean API call handler in CleanupConfirmDialog.tsx"
Task: "Add 'Clean Project' menu option to ProjectMenu"
```

---

## Parallel Example: User Story 2

```bash
# Launch workflow and Claude command in parallel:
Task: "Create cleanup.yml workflow file at .github/workflows/cleanup.yml"
Task: "Create cleanup.md Claude command at .claude/commands/cleanup.md"

# Both can be developed independently and integrated via workflow step
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Database schema)
2. Complete Phase 2: Foundational (Utility functions)
3. Complete Phase 3: User Story 1 (Cleanup trigger UI + API)
4. **STOP and VALIDATE**: Manually trigger cleanup, verify ticket/job creation, verify activeCleanupJobId is set
5. Can demonstrate cleanup trigger functionality to stakeholders

### Incremental Delivery

1. **MVP**: Setup + Foundational + User Story 1 → Can trigger cleanup (creates ticket/job/lock)
2. **Phase 2**: Add User Story 2 → Cleanup actually executes, analyzes code, creates PR
3. **Phase 3**: Add User Story 3 → Transitions blocked during cleanup, users get clear feedback
4. **Complete**: Add Polish → Documentation, type safety, validation complete

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (1-2 hours)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (API + UI for cleanup trigger)
   - **Developer B**: User Story 2 (Workflow + Claude command)
   - **Developer C**: User Story 3 (Lock enforcement + UI feedback)
3. User Story 2 depends on User Story 1 for workflow dispatch code
4. User Story 3 depends on User Story 1 for activeCleanupJobId being set

### Critical Path

**Longest dependency chain**: Setup → Foundational → User Story 1 → User Story 3 (8-10 hours)

**Estimated Total Time**:
- Sequential: 12-15 hours (1.5-2 days)
- Parallel (3 developers): 6-8 hours (1 day)

---

## Notes

- **[P] tasks**: Different files, no dependencies, can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- Each user story should be independently testable (except US3 depends on US1 for setup)
- Database migration must complete before any API/workflow work
- Utility functions in Foundational phase are used by all user stories
- Tests are NOT included (not explicitly requested in specification)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Cleanup workflow follows existing patterns (quick-impl.yml, speckit.yml)
- All TypeScript must use strict mode with explicit types
- Use Prisma for all database queries (no raw SQL)
- Use shadcn/ui components for all UI elements
- Follow Next.js 15 App Router conventions for API routes
