# Tasks: Manual Vercel Deploy Preview

**Input**: Design documents from `/specs/080-1490-deploy-preview/`
**Prerequisites**: plan.md, spec.md (user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema changes

- [X] T001 Add `previewUrl` field to Ticket model in prisma/schema.prisma (String?, max 500 chars)
- [X] T002 Create Prisma migration for preview URL field: `npx prisma migrate dev --name add_ticket_preview_url`
- [X] T003 [P] Generate Prisma client: `npx prisma generate`
- [X] T004 [P] Create Zod validation schema for preview URL in app/lib/schemas/deploy-preview.ts (HTTPS-only, Vercel domain pattern)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create deployment eligibility validation utility in app/lib/utils/deploy-preview-eligibility.ts (stage=VERIFY, branch exists, latest job COMPLETED)
- [X] T006 [P] Create GitHub workflow dispatcher function in app/lib/workflows/dispatch-deploy-preview.ts (uses @octokit/rest)
- [X] T007 [P] Create GitHub Actions workflow file .github/workflows/deploy-preview.yml (with Vercel CLI deployment steps)
- [X] T008 Create workflow-only API endpoint PATCH /api/projects/[projectId]/tickets/[id]/preview-url/route.ts (Bearer auth, updates previewUrl field)
- [X] T009 Create deploy trigger API endpoint POST /api/projects/[projectId]/tickets/[id]/deploy/route.ts (session auth, creates Job, dispatches workflow)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Active Preview Deployment (Priority: P1) 🎯 MVP

**Goal**: Users can see and access active preview deployments via clickable preview icon on ticket cards

**Independent Test**: Create a ticket with a preview URL, render the ticket card, verify the preview icon is clickable and opens the correct URL in a new tab

### Tests for User Story 1 (Write tests FIRST, ensure they FAIL before implementation)

- [ ] T010 [P] [US1] Unit test for preview icon visibility logic in tests/unit/preview-icon-visibility.test.ts (Vitest: show when previewUrl exists, hide when null)
- [ ] T011 [P] [US1] Integration test for preview icon rendering in tests/integration/deploy-preview/preview-icon.spec.ts (Playwright: icon visible with preview URL)
- [ ] T012 [P] [US1] Integration test for preview icon click behavior in tests/integration/deploy-preview/preview-icon.spec.ts (Playwright: opens new tab with correct URL)

### Implementation for User Story 1

- [X] T013 [P] [US1] Create preview icon component in components/board/ticket-card-preview-icon.tsx (shadcn/ui ExternalLink icon, clickable)
- [X] T014 [US1] Integrate deploy job indicator into ticket card component in components/board/ticket-card.tsx (positioned in bottom job section, right side, next to AI-BOARD icon)
- [X] T015 [US1] Add preview icon conditional rendering logic in components/board/ticket-card.tsx (show only when ticket.previewUrl !== null and job status is COMPLETED)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Trigger Manual Deploy Preview (Priority: P1) 🎯 MVP

**Goal**: Users can manually trigger Vercel preview deployments with confirmation modal and single-preview enforcement

**Independent Test**: Create a ticket in VERIFY stage with completed job and no preview URL, click the deploy icon, confirm the modal, verify the deployment job is created and workflow is triggered

### Tests for User Story 2 (Write tests FIRST, ensure they FAIL before implementation)

- [ ] T016 [P] [US2] Unit test for deployment eligibility logic in tests/unit/deploy-preview-eligibility.test.ts (Vitest: 6 scenarios per data-model.md)
- [ ] T017 [P] [US2] Integration test for deploy icon visibility in tests/integration/deploy-preview/deploy-icon.spec.ts (Playwright: show when ticket deployable)
- [ ] T018 [P] [US2] Integration test for confirmation modal flow in tests/integration/deploy-preview/confirmation-modal.spec.ts (Playwright: modal appears, warning when existing preview)
- [ ] T019 [P] [US2] Contract test for POST /api/projects/:projectId/tickets/:id/deploy in tests/api/deploy-preview.spec.ts (Playwright: 201 success, 400 validation errors, 403 forbidden)

### Implementation for User Story 2

- [X] T020 [P] [US2] Create TanStack Query mutation hook in app/lib/hooks/mutations/useDeployPreview.ts (handles POST /deploy, invalidates queries)
- [X] T021 [P] [US2] Create deploy icon component in components/board/ticket-card-deploy-icon.tsx (shadcn/ui Button with deploy icon, positioned in bottom job section)
- [X] T022 [P] [US2] Create confirmation modal component in components/board/deploy-confirmation-modal.tsx (shadcn/ui Dialog, warning when existing preview, stopPropagation on all buttons)
- [X] T023 [US2] Integrate deploy icon into ticket card component in components/board/ticket-card.tsx (conditional rendering based on eligibility, shown in bottom job section)
- [X] T024 [US2] Add deploy icon click handler in components/board/ticket-card.tsx (opens confirmation modal with isRetry prop for failed/cancelled jobs)
- [X] T025 [US2] Implement single-preview enforcement in POST /api/projects/[projectId]/tickets/[id]/deploy/route.ts (transaction: clear existing previews before creating job)
- [X] T025a [US2] Add stopPropagation to modal Cancel and Deploy/Retry buttons in components/board/deploy-confirmation-modal.tsx (prevent ticket detail modal from opening)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Monitor Deployment Progress (Priority: P2)

**Goal**: Users can see visual progress indicators while deployment is in progress and preview icon appears automatically when complete

**Independent Test**: Create a PENDING deployment job, verify the loading indicator appears, then update job status to COMPLETED and verify the preview icon appears

### Tests for User Story 3 (Write tests FIRST, ensure they FAIL before implementation)

- [ ] T026 [P] [US3] Integration test for job status polling in tests/integration/deploy-preview/job-polling.spec.ts (Playwright: loading indicator shown during PENDING/RUNNING)
- [ ] T027 [P] [US3] E2E test for full deployment workflow in tests/e2e/deploy-preview-workflow.spec.ts (Playwright: click deploy → modal → job created → status updates → preview icon appears)
- [ ] T028 [P] [US3] E2E test for single-preview enforcement in tests/e2e/deploy-preview-workflow.spec.ts (Playwright: deploy ticket A → deploy ticket B → ticket A preview cleared)

### Implementation for User Story 3

- [X] T029 [P] [US3] Add deployment job status indicator to ticket card in components/board/ticket-card.tsx (rocket icon with bounce animation for PENDING/RUNNING, positioned in bottom job section)
- [X] T030 [US3] Update existing job polling hook integration in components/board/board.tsx (already polls jobs, no changes needed - just document usage)
- [X] T031 [US3] Add preview icon auto-display logic in components/board/ticket-card.tsx (show clickable rocket icon when previewUrl appears and job.status = COMPLETED)
- [X] T031a [US3] Implement click-to-open behavior for COMPLETED deploy jobs in components/board/ticket-card.tsx (clicking rocket icon opens preview URL in new tab)

**Checkpoint**: All core user stories (US1, US2, US3) should now be independently functional

---

## Phase 6: User Story 4 - Handle Deployment Failures (Priority: P3)

**Goal**: Users can see clear error indicators when deployments fail and can retry failed deployments

**Independent Test**: Create a FAILED deployment job, verify error indicator appears, and allow user to trigger a new deployment attempt

### Tests for User Story 4 (Write tests FIRST, ensure they FAIL before implementation)

- [ ] T032 [P] [US4] Integration test for failure indicator in tests/integration/deploy-preview/failure-handling.spec.ts (Playwright: error indicator shown when job.status = FAILED)
- [ ] T033 [P] [US4] Integration test for retry flow in tests/integration/deploy-preview/failure-handling.spec.ts (Playwright: deploy icon remains clickable after failure)

### Implementation for User Story 4

- [X] T034 [P] [US4] Add retry button logic to ticket card in components/board/ticket-card.tsx (show deploy button instead of job indicator when job.status = FAILED or CANCELLED)
- [X] T035 [US4] Add isRetry prop to confirmation modal in components/board/deploy-confirmation-modal.tsx (changes title to "Retry Preview" and button to "Retry Deploy")
- [X] T036 [US4] Ensure deploy icon triggers retry flow in components/board/ticket-card.tsx (clicking deploy button after FAILED/CANCELLED opens modal with isRetry=true)
- [X] T036a [BUG] Fix AI-BOARD job visibility issue by ensuring projectId is set when creating AI-BOARD assistance jobs in app/api/projects/[projectId]/tickets/[id]/comments/route.ts

**Checkpoint**: All user stories (US1-US4) should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T037 [P] Add TypeScript type exports for deploy preview schemas in app/lib/schemas/deploy-preview.ts (export previewUrlSchema type)
- [ ] T038 [P] Add comprehensive error handling and logging to all API endpoints in app/api/projects/[projectId]/tickets/[id]/deploy/route.ts and preview-url/route.ts
- [ ] T039 [P] Update query keys factory in app/lib/query-keys.ts (add deploy preview mutation keys)
- [ ] T040 [P] Add workflow authentication validation in .github/workflows/deploy-preview.yml (verify WORKFLOW_API_TOKEN before API calls)
- [ ] T041 Code review: Verify all deploy preview components use shadcn/ui primitives (Button, Dialog, ExternalLink)
- [ ] T042 Code review: Verify all API endpoints have explicit Zod request/response schemas
- [ ] T043 Security review: Verify VERCEL_TOKEN and WORKFLOW_API_TOKEN are in GitHub secrets (never committed)
- [ ] T044 Security review: Verify preview URL validation enforces HTTPS-only URLs
- [ ] T045 [P] Update CLAUDE.md with deploy preview patterns (job tracking, single-preview constraint)
- [ ] T046 [P] Add deploy preview feature documentation to README.md
- [ ] T047 Run quickstart.md validation (follow setup steps in specs/080-1490-deploy-preview/quickstart.md)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Independent from US1 (but both are MVP)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent from US1/US2 but enhances UX
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent from US1/US2/US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Red-Green-Refactor)
- Components can be developed in parallel (marked with [P])
- Integration tasks depend on component tasks completing
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T003 and T004 can run in parallel (different files)
- **Phase 2**: T006 and T007 can run in parallel (different files)
- **User Story 1 Tests**: T010, T011, T012 can run in parallel
- **User Story 1 Implementation**: T013 can start while T014-T015 are planned
- **User Story 2 Tests**: T016, T017, T018, T019 can run in parallel
- **User Story 2 Implementation**: T020, T021, T022 can run in parallel (different files)
- **User Story 3 Tests**: T026, T027, T028 can run in parallel
- **User Story 3 Implementation**: T029 can be developed independently
- **User Story 4 Tests**: T032, T033 can run in parallel
- **User Story 4 Implementation**: T034 can be developed independently
- **Polish Phase**: T037, T038, T039, T040, T045, T046 can run in parallel (different files)

---

## Parallel Example: User Story 2 Implementation

```bash
# Launch all parallel tasks for User Story 2 together:
Task T020: "Create TanStack Query mutation hook in app/lib/hooks/mutations/useDeployPreview.ts"
Task T021: "Create deploy icon component in components/board/ticket-card-deploy-icon.tsx"
Task T022: "Create confirmation modal component in components/board/deploy-confirmation-modal.tsx"

# Then sequentially integrate:
Task T023: "Integrate deploy icon into ticket card component"
Task T024: "Add deploy icon click handler"
Task T025: "Implement single-preview enforcement in API"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (database schema + validation)
2. Complete Phase 2: Foundational (API endpoints + workflow)
3. Complete Phase 3: User Story 1 (view preview icon)
4. Complete Phase 4: User Story 2 (trigger deployment)
5. **STOP and VALIDATE**: Test US1 + US2 independently
6. Deploy/demo if ready

**Why this MVP?**: Users can trigger deployments and access previews - core value delivered. Progress monitoring (US3) and error handling (US4) are enhancements.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + User Story 2 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 3 → Test independently → Deploy/Demo (enhanced UX)
4. Add User Story 4 → Test independently → Deploy/Demo (error resilience)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T009)
2. Once Foundational is done:
   - Developer A: User Story 1 (T010-T015)
   - Developer B: User Story 2 (T016-T025)
   - Developer C: User Story 3 (T026-T031)
   - Developer D: User Story 4 (T032-T036)
3. Stories complete and integrate independently
4. Team reviews together in Polish phase (T037-T047)

---

## Task Summary

**Total Tasks**: 47
- **Setup**: 4 tasks
- **Foundational**: 5 tasks (BLOCKING)
- **User Story 1**: 6 tasks (3 tests + 3 implementation)
- **User Story 2**: 10 tasks (4 tests + 6 implementation)
- **User Story 3**: 6 tasks (3 tests + 3 implementation)
- **User Story 4**: 5 tasks (2 tests + 3 implementation)
- **Polish**: 11 tasks

**Parallel Opportunities**: 25 tasks marked [P] (53% of total)

**MVP Scope**: Phases 1-4 (29 tasks) = User Stories 1 + 2
**Full Feature**: All phases (47 tasks) = All user stories + polish

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests follow TDD workflow: Write test → Red → Implement → Green → Refactor
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- All API endpoints use Zod validation schemas (TypeScript-first)
- All UI components use shadcn/ui primitives (component-driven architecture)
- All secrets stored in GitHub repository secrets (security-first)
- All database operations use Prisma transactions for single-preview enforcement (database integrity)
