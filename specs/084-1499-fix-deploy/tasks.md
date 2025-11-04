# Tasks: Unified Deploy Preview Icon

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/specs/084-1499-fix-deploy/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/component-interface.ts

**Tests**: Tests are REQUIRED for this feature per the specification (unit + integration tests documented in quickstart.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Project Type**: Next.js web application
- **Structure**: `components/board/`, `lib/utils/`, `tests/unit/`, `tests/integration/board/`
- All paths are from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Search for existing tests and validate refactor scope

- [X] T001 Search for existing tests referencing TicketCardPreviewIcon or TicketCardDeployIcon using Grep tool in tests/ directory
- [X] T002 Read existing test file tests/integration/deploy/deploy-icon-colors.spec.ts to understand current test coverage
- [X] T003 Verify no other components import ticket-card-preview-icon.tsx or ticket-card-deploy-icon.tsx using Grep tool
- [X] T004 Read components/board/ticket-card.tsx lines 167-203 to understand current icon rendering logic

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create type definitions and utility functions that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create getDeployIconState() utility function in specs/084-1499-fix-deploy/contracts/component-interface.ts (already exists, verify imports work)
- [X] T006 Verify DeployIconState type, DEPLOY_ICON_CONFIG_MAP, and type guards are exported from specs/084-1499-fix-deploy/contracts/component-interface.ts
- [X] T007 Add lucide-react ExternalLink and Rocket icon imports to components/board/ticket-card.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View and Open Active Preview Deployment (Priority: P1) 🎯 MVP

**Goal**: Display green clickable icon when ticket has preview URL and open preview in new tab on click

**Independent Test**: Create ticket with previewUrl, verify green ExternalLink icon visible and opens URL in new tab

### Tests for User Story 1 (Red-Green-Refactor)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T008 [P] [US1] Create unit test for preview state priority in tests/unit/unified-deploy-icon.test.ts - test that previewUrl !== null returns 'preview' state
- [ ] T009 [P] [US1] Create unit test for preview state with deployable ticket in tests/unit/unified-deploy-icon.test.ts - test that preview state takes precedence over deployable
- [X] T010 [US1] Update existing test in tests/integration/deploy/deploy-icon-colors.spec.ts to use unified icon testid 'unified-deploy-icon' instead of separate 'preview-icon' (lines 141-142)
- [X] T011 [US1] Update existing test in tests/integration/deploy/deploy-icon-colors.spec.ts to verify green icon opens URL in new tab (add click test to lines 266-307)

### Implementation for User Story 1

- [X] T012 [US1] Add React.useMemo() hook in components/board/ticket-card.tsx to compute deployIconState using getDeployIconState(ticket, deployJob, isDeployable)
- [X] T013 [US1] Implement preview state rendering in components/board/ticket-card.tsx - green ExternalLink button with text-green-400 class
- [X] T014 [US1] Add onClick handler for preview state in components/board/ticket-card.tsx - window.open(ticket.previewUrl, '_blank', 'noopener,noreferrer')
- [X] T015 [US1] Add accessibility labels for preview state in components/board/ticket-card.tsx - aria-label="Open preview deployment for {ticketKey}" and title="Open preview deployment"
- [X] T016 [US1] Add data-testid="unified-deploy-icon" to preview state button in components/board/ticket-card.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - green icon shows for tickets with preview URLs and opens them in new tabs

---

## Phase 4: User Story 2 - Trigger New Preview Deployment (Priority: P2)

**Goal**: Display deploy icon for deployable tickets and trigger confirmation modal on click

**Independent Test**: Create deployable ticket (VERIFY stage, has branch, completed job), verify Rocket icon visible and opens modal on click

### Tests for User Story 2 (Red-Green-Refactor)

- [ ] T017 [P] [US2] Create unit test for deployable state in tests/unit/unified-deploy-icon.test.ts - test that isDeployable === true returns 'deployable' state
- [ ] T018 [P] [US2] Create unit test for deployable state with no preview in tests/unit/unified-deploy-icon.test.ts - test that deployable state shows when previewUrl is null
- [X] T019 [US2] Update existing test in tests/integration/deploy/deploy-icon-colors.spec.ts to verify unified icon shows Rocket icon for deployable ticket (lines 223-264)
- [ ] T020 [US2] Create integration test in tests/integration/deploy/deploy-icon-colors.spec.ts to verify clicking deployable icon opens DeployConfirmationModal

### Implementation for User Story 2

- [X] T021 [US2] Implement deployable state rendering in components/board/ticket-card.tsx - neutral Rocket button with text-[#a6adc8] class
- [X] T022 [US2] Add onClick handler for deployable state in components/board/ticket-card.tsx - setShowDeployModal(true) with e.stopPropagation()
- [X] T023 [US2] Add accessibility labels for deployable state in components/board/ticket-card.tsx - aria-label="Deploy preview for {ticketKey}" and dynamic title
- [X] T024 [US2] Add conditional tooltip text for deployable state in components/board/ticket-card.tsx - "Retry deployment" if deployJob?.status === FAILED/CANCELLED, else "Deploy preview"
- [X] T025 [US2] Verify deployable state only shows when preview state is NOT active (state priority logic already in getDeployIconState)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - preview icon for deployed tickets, deploy icon for deployable tickets

---

## Phase 5: User Story 3 - Monitor Deployment Progress (Priority: P3)

**Goal**: Display blue bounce animation when deploy job is PENDING or RUNNING and disable interaction

**Independent Test**: Create ticket with PENDING deploy job, verify blue bounce animation visible and icon is disabled

### Tests for User Story 3 (Red-Green-Refactor)

- [ ] T026 [P] [US3] Create unit test for deploying state with PENDING job in tests/unit/unified-deploy-icon.test.ts - test that deployJob.status === 'PENDING' returns 'deploying' state
- [ ] T027 [P] [US3] Create unit test for deploying state with RUNNING job in tests/unit/unified-deploy-icon.test.ts - test that deployJob.status === 'RUNNING' returns 'deploying' state
- [X] T028 [US3] Update existing tests in tests/integration/deploy/deploy-icon-colors.spec.ts to verify unified icon shows blue bounce animation for PENDING/RUNNING (lines 29-67, 69-105)
- [X] T029 [US3] Update existing test in tests/integration/deploy/deploy-icon-colors.spec.ts to verify icon is disabled during deployment (lines 309-349)

### Implementation for User Story 3

- [X] T030 [US3] Implement deploying state rendering in components/board/ticket-card.tsx - blue Rocket button with text-blue-400 and animate-bounce classes
- [X] T031 [US3] Add disabled attribute to deploying state button in components/board/ticket-card.tsx - disabled={true} and cursor-not-allowed class
- [X] T032 [US3] Add accessibility labels for deploying state in components/board/ticket-card.tsx - aria-label="Deployment in progress" and title="Deployment in progress..."
- [X] T033 [US3] Verify deploying state takes precedence over deployable state but NOT over preview state (state priority logic already in getDeployIconState)

**Checkpoint**: All three states now work independently - preview (green), deploying (blue bounce), deployable (neutral)

---

## Phase 6: User Story 4 - Handle Deployment Failures (Priority: P4)

**Goal**: Display deploy icon (retry) when deploy job status is FAILED or CANCELLED

**Independent Test**: Create ticket with FAILED deploy job, verify Rocket icon visible and allows retry

### Tests for User Story 4 (Red-Green-Refactor)

- [ ] T034 [P] [US4] Create unit test for deployable state with FAILED job in tests/unit/unified-deploy-icon.test.ts - test that deployJob.status === 'FAILED' returns 'deployable' state
- [ ] T035 [P] [US4] Create unit test for deployable state with CANCELLED job in tests/unit/unified-deploy-icon.test.ts - test that deployJob.status === 'CANCELLED' returns 'deployable' state
- [X] T036 [US4] Update existing tests in tests/integration/deploy/deploy-icon-colors.spec.ts to verify unified icon shows deploy icon for FAILED/CANCELLED (lines 149-184, 186-221)
- [ ] T037 [US4] Create integration test in tests/integration/deploy/deploy-icon-colors.spec.ts to verify clicking retry icon after failure opens modal and creates new job

### Implementation for User Story 4

- [X] T038 [US4] Verify deployable state rendering already handles FAILED/CANCELLED jobs (reuses T021-T024 implementation)
- [X] T039 [US4] Verify tooltip shows "Retry deployment" when deployJob?.status === FAILED or CANCELLED (implemented in T024)
- [X] T040 [US4] Test manual retry flow: FAILED job → click icon → modal opens → confirm → new job created

**Checkpoint**: All four icon states now work independently with proper error recovery

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Remove deprecated components, update tests, and verify all edge cases

- [X] T041 [P] Remove deprecated file components/board/ticket-card-preview-icon.tsx
- [X] T042 [P] Remove deprecated file components/board/ticket-card-deploy-icon.tsx
- [X] T043 Remove import statements for TicketCardPreviewIcon and TicketCardDeployIcon from components/board/ticket-card.tsx
- [ ] T044 [P] Create unit test for hidden state in tests/unit/unified-deploy-icon.test.ts - test that no conditions met returns 'hidden' state
- [ ] T045 [P] Create unit test for edge cases in tests/unit/unified-deploy-icon.test.ts - test null values, undefined jobs, empty strings
- [ ] T046 Run all unit tests with bun run test:unit to verify state logic correctness
- [X] T047 Run all integration tests with bun run test:e2e tests/integration/deploy/ to verify rendering and interactions
- [ ] T048 Manual testing: Create ticket with preview URL, verify green icon works across all stages (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
- [ ] T049 Manual testing: Verify icon respects stage transitions (BUILD → VERIFY shows deploy icon if deployable)
- [ ] T050 Manual testing: Verify keyboard navigation works (Tab to icon, Enter/Space activates)
- [ ] T051 [P] Update quickstart.md with actual implementation notes if changes were needed from original plan
- [ ] T052 Run full test suite with bun test to verify no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independently testable (different state than US1)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independently testable (different state than US1/US2)
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - Reuses US2 implementation, adds retry logic

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Red-Green-Refactor)
- Unit tests before integration tests (faster feedback loop)
- State logic before rendering logic
- Rendering before click handlers
- Accessibility labels after functionality works
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001-T004) can run in parallel - reading different files
- All Foundational tasks (T005-T007) can run in parallel - different files
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All unit tests within a user story can run in parallel (marked [P])
- Integration tests for different stories can run in parallel
- Polish tasks marked [P] can run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch all unit tests for User Story 1 together:
Task: "Create unit test for preview state priority in tests/unit/unified-deploy-icon.test.ts"
Task: "Create unit test for preview state with deployable ticket in tests/unit/unified-deploy-icon.test.ts"

# Then sequentially:
Task: "Update existing test in tests/integration/deploy/deploy-icon-colors.spec.ts" (depends on implementation)
```

---

## Parallel Example: User Story 3

```bash
# Launch all unit tests for User Story 3 together:
Task: "Create unit test for deploying state with PENDING job in tests/unit/unified-deploy-icon.test.ts"
Task: "Create unit test for deploying state with RUNNING job in tests/unit/unified-deploy-icon.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T007) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T008-T016) - Preview icon state
4. **STOP and VALIDATE**: Test User Story 1 independently with tickets that have preview URLs
5. Deploy/demo if ready (basic preview access works)

**Estimated Time**: 50-70 minutes (per quickstart.md)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (15 minutes)
2. Add User Story 1 → Test independently → Deploy/Demo (20 minutes) - **MVP!**
3. Add User Story 2 → Test independently → Deploy/Demo (20 minutes) - Deploy trigger works
4. Add User Story 3 → Test independently → Deploy/Demo (15 minutes) - Loading state works
5. Add User Story 4 → Test independently → Deploy/Demo (10 minutes) - Retry works
6. Polish phase → Final cleanup (10 minutes)
7. Each story adds value without breaking previous stories

**Total Estimated Time**: 90-110 minutes for full feature

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (15 minutes)
2. Once Foundational is done:
   - Developer A: User Story 1 (preview state)
   - Developer B: User Story 2 (deployable state)
   - Developer C: User Story 3 (deploying state)
   - Developer D: User Story 4 (retry after failure)
3. Stories complete and integrate independently (state priority logic handles conflicts)
4. Team reconvenes for Polish phase

**Parallel Estimated Time**: 40-50 minutes with 4 developers

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red-Green-Refactor cycle)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Icon state priority prevents conflicts between stories: Preview > Deploying > Deployable > Hidden
- Existing tests in tests/integration/deploy/deploy-icon-colors.spec.ts must be updated for unified icon
- testid changes: 'preview-icon' and 'deploy-icon' → 'unified-deploy-icon'
- No new API endpoints or database changes required (UI-only refactor)
- Uses existing useJobPolling hook for real-time job status updates
