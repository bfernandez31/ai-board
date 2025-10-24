# Tasks: Simplified Job Status Display

**Input**: Design documents from `/specs/047-design-job-status/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/component-interfaces.md

**Tests**: Constitution requires TDD with hybrid testing strategy (Vitest unit tests + Playwright integration tests)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Web application with Next.js App Router
- Components: `components/board/`
- Utilities: `lib/utils/`
- Tests: `tests/unit/` (Vitest), `tests/integration/` (Playwright)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify dependencies and prepare development environment

- [ ] T001 Verify shadcn/ui Tooltip component installed (run: `ls components/ui/tooltip.tsx` or install via `npx shadcn@latest add tooltip`)
- [ ] T002 Verify lucide-react BotMessageSquare icon availability (already installed, verify import works)
- [ ] T003 Search for existing test files covering JobStatusIndicator and TicketCard (run: `npx grep -r "JobStatusIndicator\|TicketCard" tests/`)

**Checkpoint**: Dependencies verified, test discovery complete

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utility function that ALL user stories depend on for timestamp tooltips

**⚠️ CRITICAL**: This phase MUST be complete before any user story implementation

### Tests for formatTimestamp Utility (TDD Required)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T004 [P] Create Vitest unit test file for formatTimestamp in tests/unit/format-timestamp.test.ts with 5 test cases: null input, current time ("just now"), recent time ("X minutes ago"), old time ("Oct 23, 3:42 PM"), invalid input

### Implementation for formatTimestamp Utility

- [ ] T005 Implement formatTimestamp utility function in lib/utils/format-timestamp.ts with TypeScript strict types, Intl API usage, error handling for null/invalid inputs

**Checkpoint**: formatTimestamp utility complete and tested - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Simplified Workflow Job Status (Priority: P1) 🎯 MVP

**Goal**: Remove redundant stage prefix from workflow job status display, showing only icon + label

**Independent Test**: View any ticket with a workflow job (SPECIFY, PLAN, BUILD). Success = status displays "✅ COMPLETED" without "🔧 BUILD :" prefix

### Tests for User Story 1 (TDD Required)

**NOTE: Write/update these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [US1] Search for existing JobStatusIndicator tests and update expectations to verify simplified workflow display (no stage prefix) in existing test file or create new tests/integration/job-status-indicator-workflow.spec.ts with Playwright
- [ ] T007 [P] [US1] Write Playwright test case "workflow job displays without stage prefix" verifying COMPLETED status shows only status text without "BUILD :" in tests/integration/job-status-display.spec.ts
- [ ] T008 [P] [US1] Write Playwright test case "workflow job maintains animation for RUNNING status" verifying pen icon animates without prefix in tests/integration/job-status-display.spec.ts

### Implementation for User Story 1

- [ ] T009 [US1] Modify JobStatusIndicator component in components/board/job-status-indicator.tsx to conditionally skip prefix rendering when jobType === JobType.WORKFLOW (remove Icon + Stage text + colon section)
- [ ] T010 [US1] Verify workflow job status displays only status icon + contextual label (e.g., "✅ COMPLETED", "✏️ WRITING") without any prefix
- [ ] T011 [US1] Verify RUNNING status maintains animate-quill-writing animation on icon for workflow jobs
- [ ] T012 [US1] Verify ARIA labels updated correctly for simplified workflow display ("Job [command] is [status]")

**Checkpoint**: User Story 1 complete - workflow jobs display simplified status without prefix

---

## Phase 4: User Story 2 - Compact AI-BOARD Status Indicator (Priority: P1)

**Goal**: Display AI-BOARD job status as compact icon-only indicator with color-coded states and tooltips

**Independent Test**: Mention @ai-board in ticket comment. Success = bot icon appears on right side with purple color and appropriate tooltip on hover

### Tests for User Story 2 (TDD Required)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US2] Write Playwright test case "AI-BOARD job displays compact icon with tooltip" verifying bot-message-square icon shows in purple with hover tooltip in tests/integration/job-status-display.spec.ts
- [ ] T014 [P] [US2] Write Playwright test case "AI-BOARD tooltip shows status-specific messages" verifying PENDING ("preparing..."), RUNNING ("working..."), COMPLETED (timestamp), FAILED, CANCELLED tooltips in tests/integration/job-status-display.spec.ts
- [ ] T015 [P] [US2] Write Playwright test case "AI-BOARD icon color changes by status" verifying purple (PENDING/RUNNING/COMPLETED), red (FAILED), gray (CANCELLED) colors in tests/integration/job-status-display.spec.ts

### Implementation for User Story 2

- [ ] T016 [US2] Add AI-BOARD compact icon-only mode to JobStatusIndicator component in components/board/job-status-indicator.tsx when jobType === JobType.AI_BOARD
- [ ] T017 [US2] Import BotMessageSquare icon from lucide-react and Tooltip components from @/components/ui/tooltip in components/board/job-status-indicator.tsx
- [ ] T018 [US2] Add completedAt prop to JobStatusIndicatorProps interface with type Date | string | null in components/board/job-status-indicator.tsx
- [ ] T019 [US2] Implement getAIBoardColor() helper function to map status to TailwindCSS color classes (purple/red/gray) in components/board/job-status-indicator.tsx
- [ ] T020 [US2] Implement getAIBoardTooltip() helper function to generate status-specific tooltip text with formatTimestamp for COMPLETED status in components/board/job-status-indicator.tsx
- [ ] T021 [US2] Implement getAIBoardAriaLabel() helper function for accessibility labels in components/board/job-status-indicator.tsx
- [ ] T022 [US2] Wrap BotMessageSquare icon in TooltipProvider → Tooltip → TooltipTrigger → TooltipContent structure with cursor-help class in components/board/job-status-indicator.tsx
- [ ] T023 [US2] Update TicketCard to pass completedAt prop from workflowJob and aiBoardJob to JobStatusIndicator in components/board/ticket-card.tsx
- [ ] T024 [US2] Verify keyboard navigation works for AI-BOARD tooltip (Tab to focus, Enter/Space to show, Escape to dismiss)

**Checkpoint**: User Story 2 complete - AI-BOARD jobs display as compact icon with tooltips

---

## Phase 5: Single-Line Layout Integration (Both P1 Stories)

**Goal**: Position workflow and AI-BOARD indicators on same horizontal line with proper spacing

**Independent Test**: View ticket with both workflow and AI-BOARD jobs. Success = both indicators on same line, AI-BOARD right-aligned

### Tests for Single-Line Layout (TDD Required)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T025 [US1] [US2] Write Playwright test case "jobs appear on single line" verifying flex layout with justify-between in tests/integration/job-status-display.spec.ts
- [ ] T026 [P] [US1] [US2] Write Playwright test case "AI-BOARD indicator right-aligned" verifying bot icon positioned at far right regardless of workflow text length in tests/integration/job-status-display.spec.ts
- [ ] T027 [P] [US1] [US2] Write Playwright test case "single job displays correctly" verifying layout works with only workflow job OR only AI-BOARD job in tests/integration/job-status-display.spec.ts

### Implementation for Single-Line Layout

- [ ] T028 [US1] [US2] Modify TicketCard job status section in components/board/ticket-card.tsx replacing dual-line vertical stack (space-y-2) with single-line horizontal flex layout
- [ ] T029 [US1] [US2] Add inner flex container with classes "flex items-center justify-between gap-3" to position jobs horizontally in components/board/ticket-card.tsx
- [ ] T030 [US1] [US2] Place workflowJob JobStatusIndicator as first child (left side, natural flow) in components/board/ticket-card.tsx
- [ ] T031 [US1] [US2] Place aiBoardJob JobStatusIndicator as second child (right side via justify-between) in components/board/ticket-card.tsx
- [ ] T032 [US1] [US2] Verify gap-3 (0.75rem) spacing maintained between indicators when both present
- [ ] T033 [US1] [US2] Verify edge cases: only workflow job (full width), only AI-BOARD job (right-aligned), no jobs (section hidden)

**Checkpoint**: User Stories 1 AND 2 integrated - single-line layout complete

---

## Phase 6: User Story 3 - AI-BOARD Status Differentiation (Priority: P2)

**Goal**: Ensure consistent visual distinction between workflow and AI-BOARD jobs through color coding and positioning

**Independent Test**: Create tickets with various job combinations. Success = purple icons consistently indicate AI-BOARD, positioning is stable across state transitions

### Tests for User Story 3 (TDD Required)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T034 [P] [US3] Write Playwright test case "multiple AI-BOARD jobs show consistent purple color" verifying color consistency across PENDING/RUNNING/COMPLETED states in tests/integration/job-status-display.spec.ts
- [ ] T035 [P] [US3] Write Playwright test case "AI-BOARD icon position stable during transitions" verifying right alignment maintained when status changes RUNNING → COMPLETED in tests/integration/job-status-display.spec.ts
- [ ] T036 [P] [US3] Write Playwright test case "tooltip timestamp formatting" verifying completed AI-BOARD job shows human-readable timestamp (relative or absolute) in tests/integration/job-status-display.spec.ts

### Implementation for User Story 3

- [ ] T037 [US3] Verify color coding consistency: purple (#a855f7) for PENDING/RUNNING/COMPLETED, red (#ef4444) for FAILED, gray (#6b7280) for CANCELLED in components/board/job-status-indicator.tsx
- [ ] T038 [US3] Verify AI-BOARD icon remains visible and right-aligned during status transitions (no layout shift)
- [ ] T039 [US3] Verify tooltip timestamp formatting uses formatTimestamp utility correctly for COMPLETED status
- [ ] T040 [US3] Test with multiple tickets having different AI-BOARD job states simultaneously on board to verify visual consistency

**Checkpoint**: User Story 3 complete - visual differentiation consistent across all states

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements, documentation, and full validation

- [ ] T041 [P] Run TypeScript compiler in strict mode (npm run type-check) and fix any type errors
- [ ] T042 [P] Run ESLint (npm run lint) and fix any warnings or errors
- [ ] T043 Run full unit test suite (npm run test:unit) and verify all formatTimestamp tests pass
- [ ] T044 Run full integration test suite (npm run test:e2e) and verify all Playwright tests pass
- [ ] T045 Manual accessibility testing: verify keyboard navigation (Tab, Enter/Space, Escape) for AI-BOARD tooltips
- [ ] T046 Manual accessibility testing: verify screen reader announces correct ARIA labels for workflow and AI-BOARD jobs
- [ ] T047 [P] Visual regression testing: verify no layout shift when job status updates (RUNNING → COMPLETED)
- [ ] T048 [P] Performance validation: verify <16ms render time (60fps) using React DevTools Profiler
- [ ] T049 Test edge cases: long workflow status text, only AI-BOARD job, only workflow job, no jobs
- [ ] T050 Validate quickstart.md implementation steps match actual code changes
- [ ] T051 Create pull request with descriptive title "feat: simplified job status display" and link to spec.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - **User Story 1 (Phase 3)**: Can start after Phase 2 - Independent MVP
  - **User Story 2 (Phase 4)**: Can start after Phase 2 - Parallel with US1
  - **Phase 5 (Integration)**: Depends on US1 + US2 implementation complete
  - **User Story 3 (Phase 6)**: Depends on Phase 5 (integration) complete
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - only needs formatTimestamp utility (Phase 2)
- **User Story 2 (P1)**: Independent - only needs formatTimestamp utility (Phase 2)
- **Integration (P1)**: Depends on US1 + US2 implementation (not tests) being done
- **User Story 3 (P2)**: Depends on integration complete (Phase 5)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Component modifications after tests written
- Helper functions before main component changes
- Visual verification after implementation

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 can run in parallel
- **Phase 2**: T004 (test) must complete before T005 (implementation)
- **Phase 3**: T006, T007, T008 (tests) can run in parallel; T009-T012 sequential after tests
- **Phase 4**: T013, T014, T015 (tests) can run in parallel; T016-T024 mostly sequential
- **Phase 5**: T025, T026, T027 (tests) can run in parallel; T028-T033 sequential after tests
- **Phase 6**: T034, T035, T036 (tests) can run in parallel; T037-T040 mostly sequential
- **Phase 7**: T041, T042, T047, T048 can run in parallel
- **User Stories 1 and 2 can be worked in parallel by different developers after Phase 2**

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all User Story 1 tests together (Phase 3):
Task: "Update existing JobStatusIndicator tests for simplified workflow display"
Task: "Write Playwright test case 'workflow job displays without stage prefix'"
Task: "Write Playwright test case 'workflow job maintains animation for RUNNING status'"

# Then implement US1 tasks sequentially (tests must pass):
Task: "Modify JobStatusIndicator to skip prefix rendering for WORKFLOW jobs"
Task: "Verify workflow status displays only icon + label"
Task: "Verify RUNNING animation maintained"
Task: "Verify ARIA labels updated"
```

---

## Parallel Example: User Story 2 Tests

```bash
# Launch all User Story 2 tests together (Phase 4):
Task: "Write Playwright test case 'AI-BOARD job displays compact icon with tooltip'"
Task: "Write Playwright test case 'AI-BOARD tooltip shows status-specific messages'"
Task: "Write Playwright test case 'AI-BOARD icon color changes by status'"

# Then implement US2 tasks (many can be done in sequence on same file):
Task: "Add AI-BOARD compact icon-only mode to JobStatusIndicator"
Task: "Import BotMessageSquare icon and Tooltip components"
# ... etc
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + Integration)

1. Complete Phase 1: Setup → Dependencies verified
2. Complete Phase 2: Foundational → formatTimestamp utility ready (CRITICAL)
3. Complete Phase 3: User Story 1 → Workflow jobs simplified
4. Complete Phase 4: User Story 2 → AI-BOARD compact icons
5. Complete Phase 5: Integration → Single-line layout
6. **STOP and VALIDATE**: Test both P1 stories independently and together
7. Deploy/demo if ready (P1 stories = MVP)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Works alone ✅
3. Add User Story 2 → Test independently → Works alone ✅
4. Integrate US1 + US2 (Phase 5) → Test together → Both work on same line ✅
5. Add User Story 3 → Polish visual consistency → MVP enhanced ✅
6. Each phase adds value without breaking previous work

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T005)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T006-T012) - Simplified workflow display
   - **Developer B**: User Story 2 (T013-T024) - AI-BOARD compact indicator
3. Both developers sync for Integration (T025-T033)
4. One developer completes User Story 3 (T034-T040)
5. Team completes Polish together (T041-T051)

---

## Task Summary

**Total Tasks**: 51
- Setup: 3 tasks
- Foundational: 2 tasks (1 test + 1 impl)
- User Story 1: 7 tasks (3 tests + 4 impl)
- User Story 2: 12 tasks (3 tests + 9 impl)
- Integration: 9 tasks (3 tests + 6 impl)
- User Story 3: 7 tasks (3 tests + 4 impl)
- Polish: 11 tasks

**Parallel Opportunities**: 15 tasks marked [P]

**Independent Test Criteria**:
- **US1**: View ticket with workflow job → No prefix visible
- **US2**: View ticket with AI-BOARD job → Bot icon with tooltip visible
- **Integration**: View ticket with both jobs → Single line, proper spacing
- **US3**: View multiple tickets → Consistent colors and positioning

**Suggested MVP Scope**: Phases 1-5 (Setup + Foundational + US1 + US2 + Integration) = 33 tasks

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Constitution requires TDD: Write tests first, ensure they fail, then implement
- Hybrid testing: Vitest for pure functions, Playwright for component behavior
- Each user story independently testable - can stop after any phase
- formatTimestamp utility is foundational - blocks all user stories
- Search for existing tests before creating new ones (constitution requirement)
- Commit after each task or logical group for easy rollback
- Validate independently at each checkpoint before proceeding
