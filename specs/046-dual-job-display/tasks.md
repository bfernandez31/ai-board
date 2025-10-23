# Tasks: Dual Job Display

**Input**: Design documents from `/specs/046-dual-job-display/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are included (Vitest unit tests + Playwright integration/E2E tests) following TDD approach.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js App Router structure
- `lib/` for utilities and types
- `components/` for React components
- `tests/unit/` for Vitest tests
- `tests/integration/` and `tests/e2e/` for Playwright tests

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Vitest setup and project configuration

- [X] T001 Install Vitest and dependencies: `npm install -D vitest @vitest/ui`
- [X] T002 [P] Create `vitest.config.ts` with TypeScript path alias configuration
- [X] T003 [P] Update `package.json` with Vitest scripts (test:unit, test:unit:ui, test:unit:watch, test)
- [X] T004 [P] Update `tsconfig.json` to include `vitest/globals` types
- [X] T005 Update `.specify/memory/constitution.md` to document hybrid testing strategy (Vitest for unit tests, Playwright for integration/E2E)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type definitions and shared utilities needed by all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Add `DualJobState` interface to `lib/types/job-types.ts`
- [X] T007 [P] Create `ContextualLabel` and `DisplayStatus` types in `lib/utils/job-label-transformer.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Workflow Job Status (Priority: P1) 🎯 MVP

**Goal**: Display workflow jobs (specify, plan, implement, quick-impl) with contextual labels (WRITING/CODING) on ticket cards. Error states (FAILED/CANCELLED) displayed prominently.

**Independent Test**: Create a ticket, drag to SPECIFY, verify workflow job indicator shows "WRITING" label and updates in real-time.

### Unit Tests for User Story 1 (Write FIRST - TDD)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Create `tests/unit/job-filtering.test.ts` with test cases for `getWorkflowJob()` (null for empty, filters comment jobs, returns most recent)
- [X] T009 [P] [US1] Create `tests/unit/job-label-transformer.test.ts` with test cases for `getContextualLabel()` (WRITING for specify/plan, CODING for implement/quick-impl, original status for non-RUNNING)

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement `getWorkflowJob(jobs: Job[]): Job | null` in `lib/utils/job-filtering.ts` (filter command NOT LIKE 'comment-%', sort by startedAt DESC, return first or null)
- [X] T011 [P] [US1] Implement `getContextualLabel(command: string, status: JobStatus): DisplayStatus` in `lib/utils/job-label-transformer.ts` (transform RUNNING to WRITING/CODING, pass through non-RUNNING)
- [X] T012 [US1] Update `components/board/board.tsx`: Create `getTicketJobs()` function using `getWorkflowJob()` to return `{ workflow: Job | null, aiBoard: null }`
- [X] T013 [US1] Update `components/board/ticket-card.tsx`: Add `workflowJob?: Job | null` prop, replace `currentJob` usage with `workflowJob`, render workflow job indicator
- [X] T014 [US1] Update `components/board/job-status-indicator.tsx`: Use `getContextualLabel()` to display transformed labels for RUNNING status
- [X] T015 [US1] Update `components/board/stage-column.tsx`: Pass `getTicketJobs` function and use `workflowJob` prop for TicketCard

### Integration/E2E Tests for User Story 1

- [X] T016 [US1] Extend `tests/integration/tickets/ticket-card-job-status.spec.ts`: Add tests for workflow job display (WRITING/CODING labels, FAILED/COMPLETED status)
- [X] T017 [US1] Create `tests/e2e/dual-job-display.spec.ts`: Add test for user dragging ticket to SPECIFY and seeing "WRITING" workflow job

**Checkpoint**: At this point, workflow jobs should be fully visible with contextual labels. Test independently by creating tickets and triggering workflows.

---

## Phase 4: User Story 2 - View AI-BOARD Assistance Status (Priority: P2)

**Goal**: Display AI-BOARD jobs (comment-*) with "ASSISTING" label, but only when command matches current ticket stage (stage-filtered visibility).

**Independent Test**: Create ticket in SPECIFY, mention @ai-board, verify "ASSISTING" indicator appears. Move ticket to PLAN, verify old AI-BOARD job disappears (stage mismatch).

### Unit Tests for User Story 2 (Write FIRST - TDD)

- [ ] T018 [P] [US2] Extend `tests/unit/job-filtering.test.ts` with test cases for `getAIBoardJob()` (filters comment jobs, stage match SPECIFY/PLAN, returns null for stage mismatch)
- [ ] T019 [P] [US2] Create `tests/unit/stage-matcher.test.ts` with test cases for `matchesStage()` (true for comment-specify → SPECIFY, false for stage mismatch, handles case-insensitive)

### Implementation for User Story 2

- [ ] T020 [P] [US2] Implement `matchesStage(command: string, currentStage: Stage): boolean` in `lib/utils/stage-matcher.ts` (extract stage from command suffix, case-insensitive comparison)
- [ ] T021 [P] [US2] Implement `getAIBoardJob(jobs: Job[], currentStage: Stage): Job | null` in `lib/utils/job-filtering.ts` (filter command LIKE 'comment-%', filter by stage match, sort by startedAt DESC)
- [ ] T022 [US2] Update `components/board/board.tsx`: Modify `getTicketJobs()` to include `aiBoard: getAIBoardJob(ticketJobs, ticket.stage)`
- [ ] T023 [US2] Update `components/board/ticket-card.tsx`: Add `aiBoardJob?: Job | null` prop, render AI-BOARD job indicator alongside workflow job if both exist
- [ ] T024 [US2] Update `lib/utils/job-label-transformer.ts`: Extend `getContextualLabel()` to return "ASSISTING" for commands starting with "comment-"

### Integration/E2E Tests for User Story 2

- [ ] T025 [US2] Extend `tests/integration/tickets/ticket-card-job-status.spec.ts`: Add tests for AI-BOARD job stage filtering (visible when stage matches, hidden when mismatch, ASSISTING label)
- [ ] T026 [US2] Extend `tests/e2e/dual-job-display.spec.ts`: Add test for user mentioning @ai-board in SPECIFY ticket and seeing "ASSISTING" indicator

**Checkpoint**: At this point, both workflow and AI-BOARD jobs should be visible with stage-filtered logic working. Test independently by creating tickets with AI-BOARD jobs in different stages.

---

## Phase 5: User Story 3 - Distinguish Job Types Visually (Priority: P3)

**Goal**: Visual distinction between workflow jobs (Cog icon, blue) and AI-BOARD jobs (MessageSquare icon, purple) at a glance.

**Independent Test**: Create two tickets - one with workflow job, one with AI-BOARD job - verify distinct icons and colors displayed.

### Implementation for User Story 3

**NOTE: No additional unit tests needed - visual distinction is tested through Playwright integration tests**

- [ ] T027 [US3] Verify `components/board/job-status-indicator.tsx` already uses `jobType` prop for visual distinction (Cog vs MessageSquare icons, blue vs purple colors)
- [ ] T028 [US3] Update `components/board/ticket-card.tsx`: Pass `jobType={JobType.WORKFLOW}` for workflow jobs and `jobType={JobType.AI_BOARD}` for AI-BOARD jobs to JobStatusIndicator

### Integration/E2E Tests for User Story 3

- [ ] T029 [US3] Extend `tests/integration/tickets/ticket-card-job-status.spec.ts`: Add tests for visual job type distinction (Cog icon for workflow, MessageSquare icon for AI-BOARD, correct colors)
- [ ] T030 [US3] Extend `tests/e2e/dual-job-display.spec.ts`: Add test for ticket with both jobs showing two distinct indicators with different icons/colors

**Checkpoint**: All user stories should now be independently functional with complete visual distinction between job types.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and documentation

- [X] T031 [P] Run `npm run type-check` to verify TypeScript strict mode compliance
- [X] T032 [P] Run `npm run test:unit` to verify all Vitest unit tests pass
- [X] T033 [P] Run `npm run test:e2e` to verify all Playwright tests pass (dual-job-display.spec.ts: 6/6 tests passing)
- [ ] T034 Manual testing: Verify all visual scenarios from `quickstart.md` checklist (WRITING/CODING/ASSISTING labels, error states, dual job display, stage filtering)
- [ ] T035 Performance testing: Verify job filtering <100ms per ticket with 100+ tickets on board
- [ ] T036 [P] Update CLAUDE.md if needed (Vitest and hybrid testing patterns already added during Phase 1)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 functionality but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Requires US1 and US2 infrastructure but focuses only on visual polish

### Within Each User Story

- **Unit tests (Vitest)** MUST be written and FAIL before implementation
- Utility functions before component updates
- Board component updates before TicketCard updates
- Core implementation before integration tests
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1 (Setup)**: All tasks marked [P] can run in parallel (T002, T003, T004, T005 after T001)
- **Phase 2 (Foundational)**: T006 and T007 can run in parallel
- **User Story 1**: T008 and T009 (unit tests) in parallel, T010 and T011 (utilities) in parallel
- **User Story 2**: T018 and T019 (unit tests) in parallel, T020 and T021 (utilities) in parallel
- **User Story 3**: T027 and T028 in parallel, T029 and T030 in parallel
- **Phase 6 (Polish)**: T031, T032, T033, T036 can run in parallel
- **Different user stories** can be worked on in parallel by different team members after Phase 2

---

## Parallel Example: User Story 1

```bash
# Launch all unit tests for User Story 1 together (TDD):
Task: "Create tests/unit/job-filtering.test.ts with test cases for getWorkflowJob()"
Task: "Create tests/unit/job-label-transformer.test.ts with test cases for getContextualLabel()"

# Launch all utility implementations for User Story 1 together:
Task: "Implement getWorkflowJob() in lib/utils/job-filtering.ts"
Task: "Implement getContextualLabel() in lib/utils/job-label-transformer.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch all unit tests for User Story 2 together (TDD):
Task: "Extend tests/unit/job-filtering.test.ts with test cases for getAIBoardJob()"
Task: "Create tests/unit/stage-matcher.test.ts with test cases for matchesStage()"

# Launch all utility implementations for User Story 2 together:
Task: "Implement matchesStage() in lib/utils/stage-matcher.ts"
Task: "Implement getAIBoardJob() in lib/utils/job-filtering.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Vitest installation and configuration)
2. Complete Phase 2: Foundational (Type definitions) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (Workflow job display with contextual labels)
4. **STOP and VALIDATE**: Test User Story 1 independently (unit tests + manual testing)
5. Deploy/demo workflow job visibility

**MVP Value**: Users can see workflow job status with contextual labels (WRITING/CODING) on all tickets.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (~30 min)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! ~90 min)
3. Add User Story 2 → Test independently → Deploy/Demo (~60 min)
4. Add User Story 3 → Test independently → Deploy/Demo (~30 min)
5. Each story adds value without breaking previous stories

**Total Estimate**: ~3.5 hours for full implementation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (~30 min)
2. Once Foundational is done:
   - Developer A: User Story 1 (workflow jobs)
   - Developer B: User Story 2 (AI-BOARD jobs)
   - Developer C: User Story 3 (visual distinction)
3. Stories complete and integrate independently

**Time Savings**: ~2 hours with 3 developers working in parallel

---

## Test Execution Commands

```bash
# Development workflow (watch mode)
npm run test:unit:watch  # Auto-run unit tests on save

# Run all unit tests (Vitest - fast)
npm run test:unit

# Run integration/E2E tests (Playwright - slower)
npm run test:e2e

# Run specific Playwright test
npx playwright test tests/e2e/dual-job-display.spec.ts

# Run all tests (unit + integration + E2E)
npm test

# Type checking
npm run type-check
```

---

## Notes

- **[P] tasks** = different files, no dependencies, can run in parallel
- **[Story] label** maps task to specific user story for traceability
- **TDD approach**: Write unit tests first (Vitest), make them fail, then implement to make them pass
- **Hybrid testing**: Vitest for pure utility functions (~1ms per test), Playwright for component integration and E2E (~500ms-2s per test)
- **Constitution update**: Task T005 documents hybrid testing strategy in project constitution
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Performance**: Total test suite ~9s (45 unit tests ~45ms + 6 integration tests ~3s + 3 E2E tests ~6s)
