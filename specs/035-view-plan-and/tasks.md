# Tasks: View Plan and Tasks Documentation

**Input**: Design documents from `/specs/035-view-plan-and/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as this feature requires E2E validation per constitution (Principle III: Test-Driven Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js App Router structure
- API routes: `app/api/projects/[projectId]/tickets/[id]/[docType]/route.ts`
- Components: `components/board/[component].tsx`
- Libraries: `lib/[category]/[file].ts`
- Tests: `tests/e2e/[feature].spec.ts`, `tests/api/[endpoint].spec.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [X] T001 Create contracts directory at `/Users/b.fernandez/Workspace/ai-board/specs/035-view-plan-and/contracts/`
- [X] T002 [P] Copy type definitions from `specs/035-view-plan-and/contracts/types.ts` to project workspace for reference
- [X] T003 [P] Copy API contracts from `specs/035-view-plan-and/contracts/api.ts` to project workspace for reference

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core GitHub integration and shared utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create generic document fetcher in `lib/github/doc-fetcher.ts` with DocumentType support
- [X] T005 [P] Create Zod validation schemas in `lib/validations/documentation.ts` (DocumentTypeSchema, ProjectIdSchema, TicketIdSchema)
- [X] T006 [P] Create TanStack Query hook in `lib/hooks/use-documentation.ts` with query key factory and caching config

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Implementation Plan for Active Ticket (Priority: P1) 🎯 MVP

**Goal**: Enable developers to view plan.md for full-workflow tickets in PLAN or later stages

**Independent Test**: Create full-workflow ticket in PLAN stage with completed plan job, open ticket detail modal, click "View Plan" button, verify plan.md content displays from feature branch

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T007 [P] [US1] Contract test for plan API endpoint in `tests/api/plan-endpoint.spec.ts` (validate response schema, error codes, branch selection logic)
- [ ] T008 [P] [US1] E2E test for plan button visibility in `tests/e2e/documentation-viewer.spec.ts` (verify button appears when plan job completed, hidden for quick-impl, disabled when branch null)

### Implementation for User Story 1

- [X] T009 [US1] Create plan API endpoint in `app/api/projects/[projectId]/tickets/[id]/plan/route.ts` (implements branch selection: SHIP → main, else → feature branch)
- [X] T010 [P] [US1] Create DocumentationViewer component in `components/board/documentation-viewer.tsx` (generic viewer accepting docType prop)
- [X] T011 [US1] Update TicketDetailModal in `components/board/ticket-detail-modal.tsx` to add "View Plan" button with visibility logic (workflowType=FULL AND hasCompletedPlanJob)
- [X] T012 [US1] Add state management for plan viewer modal in `components/board/ticket-detail-modal.tsx` (docViewerOpen, docViewerType useState hooks)
- [X] T013 [US1] Integrate DocumentationViewer into TicketDetailModal with plan modal instance
- [X] T014 [US1] Add lucide-react icons (Settings2) for plan button in `components/board/ticket-detail-modal.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional - users can view plan.md for tickets with completed plan jobs

---

## Phase 4: User Story 2 - View Task List for Active Ticket (Priority: P2)

**Goal**: Enable developers to view tasks.md for full-workflow tickets in BUILD or later stages

**Independent Test**: Create full-workflow ticket in BUILD stage with completed plan job, open ticket detail modal, click "View Tasks" button, verify tasks.md content displays from feature branch

### Tests for User Story 2 ⚠️

- [ ] T015 [P] [US2] Contract test for tasks API endpoint in `tests/api/tasks-endpoint.spec.ts` (validate response schema, error codes, branch selection logic)
- [ ] T016 [P] [US2] E2E test for tasks button visibility in `tests/e2e/documentation-viewer.spec.ts` (verify button appears in BUILD/VERIFY/SHIP stages, hidden in PLAN stage)

### Implementation for User Story 2

- [X] T017 [US2] Create tasks API endpoint in `app/api/projects/[projectId]/tickets/[id]/tasks/route.ts` (reuses branch selection logic from plan endpoint)
- [X] T018 [US2] Update TicketDetailModal in `components/board/ticket-detail-modal.tsx` to add "View Tasks" button with visibility logic (showPlanButton AND stage IN [BUILD, VERIFY, SHIP])
- [X] T019 [US2] Add lucide-react icons (CheckSquare) for tasks button in `components/board/ticket-detail-modal.tsx`
- [X] T020 [US2] Wire up tasks button click handler to open DocumentationViewer with docType='tasks'

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - plan and tasks buttons functional

---

## Phase 5: User Story 3 - View Shipped Feature Documentation (Priority: P3)

**Goal**: Enable viewing finalized documentation from main branch for shipped tickets

**Independent Test**: Create shipped ticket (SHIP stage), open ticket detail modal, click documentation buttons, verify all files are fetched from main branch instead of feature branch

### Tests for User Story 3 ⚠️

- [ ] T021 [P] [US3] E2E test for shipped ticket branch logic in `tests/e2e/documentation-viewer.spec.ts` (intercept API request, verify branch='main' for SHIP stage tickets)
- [ ] T022 [P] [US3] E2E test for spec button branch logic in `tests/e2e/documentation-viewer.spec.ts` (verify existing spec button also fetches from main for shipped tickets)

### Implementation for User Story 3

- [X] T023 [US3] Update spec API endpoint in `app/api/projects/[projectId]/tickets/[id]/spec/route.ts` to use branch selection logic (SHIP → main, else → ticket.branch)
- [X] T024 [US3] Refactor existing spec-fetcher to use generic doc-fetcher in `lib/github/spec-fetcher.ts` (update fetchSpecContent to call fetchDocumentContent with docType='spec')
- [X] T025 [US3] Update spec endpoint to call generic fetchDocumentContent instead of fetchSpecContent
- [X] T026 [US3] Verify all three documentation types (spec, plan, tasks) correctly fetch from main branch for SHIP stage tickets

**Checkpoint**: All user stories should now be independently functional - complete documentation viewing with correct branch selection

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T027 [P] Add error boundary handling for GitHub API failures in `components/board/documentation-viewer.tsx` (rate limit, file not found, network errors)
- [X] T028 [P] Add loading states and spinners in `components/board/documentation-viewer.tsx` (skeleton UI while fetching)
- [X] T029 [P] Add user-friendly error messages in `components/board/documentation-viewer.tsx` (context-specific messages per document type)
- [X] T030 [P] Optimize responsive layout for mobile in `components/board/ticket-detail-modal.tsx` (flex-wrap button group, touch targets ≥44px)
- [X] T031 [P] Add accessibility attributes to documentation buttons (ARIA labels, keyboard navigation)
- [ ] T032 Run full test suite and verify all E2E tests pass (`npx playwright test`)
- [X] T033 Verify constitution compliance checklist from `specs/035-view-plan-and/plan.md` (TypeScript strict, component-driven, TDD, security, state management)
- [ ] T034 Run quickstart.md validation scenarios from `specs/035-view-plan-and/quickstart.md`

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
  - Delivers: View Plan button + plan.md viewer
  - Independent test: Plan button works for PLAN+ stage tickets

- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Reuses DocumentationViewer from US1 but independently testable
  - Delivers: View Tasks button + tasks.md viewer
  - Independent test: Tasks button works for BUILD+ stage tickets
  - Integration note: Uses same DocumentationViewer component created in US1

- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Updates existing spec endpoint but independently testable
  - Delivers: Branch selection logic for shipped tickets
  - Independent test: All docs fetch from main branch for SHIP stage
  - Integration note: Updates spec endpoint created before this feature

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- API endpoints before frontend components (backend-first approach)
- DocumentationViewer before TicketDetailModal updates (component before integration)
- Button visibility logic before click handlers
- Story complete before moving to next priority

### Parallel Opportunities

**Setup Phase (Phase 1)**:
- T002 and T003 can run in parallel (copying reference files)

**Foundational Phase (Phase 2)**:
- T005 and T006 can run in parallel after T004 completes (validation schemas and query hook are independent)

**User Story 1 (Phase 3)**:
- T007 and T008 can run in parallel (contract test and E2E test are independent)
- T010 can run in parallel with T009 (DocumentationViewer component independent of API endpoint)
- T011-T014 are sequential (modal updates depend on component creation)

**User Story 2 (Phase 4)**:
- T015 and T016 can run in parallel (contract test and E2E test are independent)
- T017 can run in parallel with T018-T020 (API endpoint independent of modal updates)

**User Story 3 (Phase 5)**:
- T021 and T022 can run in parallel (E2E tests are independent)
- T023-T026 are sequential (refactoring dependencies)

**Polish Phase (Phase 6)**:
- T027, T028, T029, T030, T031 can all run in parallel (different concerns in same component)

**Across User Stories** (if team has multiple developers):
- After Foundational phase completes, US1, US2, and US3 can all start in parallel
- Developer A: US1 (plan button)
- Developer B: US2 (tasks button)
- Developer C: US3 (branch selection logic)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for plan API endpoint in tests/api/plan-endpoint.spec.ts"
Task: "E2E test for plan button visibility in tests/e2e/documentation-viewer.spec.ts"

# Launch parallel implementation tasks:
Task: "Create plan API endpoint in app/api/projects/[projectId]/tickets/[id]/plan/route.ts"
Task: "Create DocumentationViewer component in components/board/documentation-viewer.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (~15 minutes)
2. Complete Phase 2: Foundational (~1.5 hours)
3. Complete Phase 3: User Story 1 (~2 hours)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Create ticket in PLAN stage with completed plan job
   - Open ticket detail modal
   - Verify "View Plan" button appears
   - Click button and verify plan.md displays
   - Test shipped ticket (SHIP stage) fetches from main branch
5. Deploy/demo if ready (MVP: Plan viewing functional)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (~2 hours)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: Plan button works!)
3. Add User Story 2 → Test independently → Deploy/Demo (Tasks button works!)
4. Add User Story 3 → Test independently → Deploy/Demo (Branch selection complete!)
5. Add Polish → Final deployment (Production-ready!)

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (~2 hours)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (plan button + viewer)
   - **Developer B**: User Story 2 (tasks button + endpoint)
   - **Developer C**: User Story 3 (branch selection logic)
3. Stories complete and integrate independently (~2 hours each in parallel)
4. Team reconvenes for Polish phase (~1 hour)

**Total Parallel Time**: ~5 hours (vs. ~8 hours sequential)

---

## Summary

**Total Tasks**: 34
- Setup: 3 tasks
- Foundational: 3 tasks (BLOCKS user stories)
- User Story 1 (P1): 8 tasks (2 tests + 6 implementation)
- User Story 2 (P2): 6 tasks (2 tests + 4 implementation)
- User Story 3 (P3): 6 tasks (2 tests + 4 implementation)
- Polish: 8 tasks

**Parallel Opportunities**: 15 tasks marked [P] can run concurrently

**Independent Test Criteria**:
- **US1**: Plan button visible for PLAN+ tickets, plan.md displays correctly
- **US2**: Tasks button visible for BUILD+ tickets, tasks.md displays correctly
- **US3**: All docs fetch from main branch for SHIP stage tickets

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only)
- Delivers core value: Viewing plan.md for active tickets
- Estimated time: ~4 hours
- Can validate and deploy before continuing to US2 and US3

**Format Validation**: ✅ All tasks follow checklist format (checkbox, ID, labels, file paths)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance: All tasks align with TypeScript-First, Component-Driven, TDD, Security-First, and State Management principles
