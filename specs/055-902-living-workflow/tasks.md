# Tasks: Living Workflow Section

**Input**: Design documents from `/specs/055-902-living-workflow/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included per TDD constitution requirement (Principle III)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Web application: Next.js 15 App Router structure
- Components: `components/landing/`
- Utilities: `lib/utils/`, `lib/hooks/`
- Tests: `tests/unit/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic file structure for animation demo

- [X] T001 Create directory structure for landing page components in components/landing/
- [X] T002 [P] Create directory structure for animation utilities in lib/utils/
- [X] T003 [P] Create directory structure for custom hooks in lib/hooks/
- [X] T004 [P] Create directory structure for unit tests in tests/unit/
- [X] T005 [P] Create directory structure for E2E tests in tests/e2e/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities and hooks that ALL user stories depend on - MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Create TypeScript type definitions for DemoTicket in lib/utils/animation-helpers.ts
- [X] T007 [P] Create TypeScript type definitions for WorkflowStage in lib/utils/animation-helpers.ts
- [X] T008 [P] Create TypeScript type definitions for AnimationState in lib/utils/animation-helpers.ts
- [X] T009 [P] Create TypeScript type definitions for ColumnIndex in lib/utils/animation-helpers.ts
- [X] T010 Create Zod validation schemas in lib/schemas/demo-data.ts
- [X] T011 Create unit test file for animation helpers in tests/unit/animation-helpers.test.ts
- [X] T012 Write failing test for calculateNextColumn function (Red)
- [X] T013 Implement calculateNextColumn function in lib/utils/animation-helpers.ts (Green)
- [X] T014 Write failing test for shouldAnimate function (Red)
- [X] T015 Implement shouldAnimate function in lib/utils/animation-helpers.ts (Green)
- [X] T016 Write failing test for getColumnName function (Red)
- [X] T017 Implement getColumnName function in lib/utils/animation-helpers.ts (Green)
- [X] T018 Create unit test file for useReducedMotion hook in tests/unit/use-reduced-motion.test.ts
- [X] T019 Write failing tests for useReducedMotion hook with jsdom media query mocking (Red)
- [X] T020 Implement useReducedMotion hook in lib/hooks/use-reduced-motion.ts (Green)
- [X] T021 [P] Implement useIntersectionObserver hook in lib/hooks/use-intersection-observer.ts
- [X] T022 Create unit test file for useAnimationState hook in tests/unit/mini-kanban-animation.test.ts
- [X] T023 Write failing tests for useAnimationState hook state machine logic (Red)
- [X] T024 Implement useAnimationState hook in lib/hooks/use-animation-state.ts (Green)
- [X] T025 Create hardcoded DEMO_TICKETS constant in lib/utils/animation-helpers.ts
- [X] T026 Create hardcoded WORKFLOW_STAGES constant in lib/utils/animation-helpers.ts

**Checkpoint**: Foundation ready - all utilities and hooks tested and working, user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - First-Time Visitor Understanding Workflow (Priority: P1) 🎯 MVP

**Goal**: Display animated mini-Kanban with 6 columns and 2-3 tickets that automatically progress every 10 seconds, demonstrating the complete workflow

**Independent Test**: Load landing page and observe tickets moving through all 6 stages (INBOX → SHIP) within 60 seconds without any user interaction

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T027 [P] [US1] Create E2E test file for landing page workflow in tests/e2e/landing-page-workflow.spec.ts
- [ ] T028 [P] [US1] Write failing E2E test for 6-column mini-Kanban display (Red)
- [ ] T029 [P] [US1] Write failing E2E test for 2-3 tickets displayed across columns (Red)
- [ ] T030 [P] [US1] Write failing E2E test for automatic 10-second progression (Red)
- [ ] T031 [P] [US1] Write failing E2E test for complete INBOX → SHIP journey within 60 seconds (Red)
- [ ] T032 [P] [US1] Write failing E2E test for smooth CSS transitions (no jarring jumps) (Red)
- [ ] T033 [P] [US1] Write failing E2E test for prefers-reduced-motion accessibility (Red)

### Implementation for User Story 1

- [X] T034 [P] [US1] Create WorkflowColumnCard component in components/landing/workflow-column-card.tsx
- [X] T035 [P] [US1] Create DemoTicketCard component in components/landing/demo-ticket-card.tsx
- [X] T036 [US1] Create MiniKanbanDemo main component in components/landing/mini-kanban-demo.tsx (depends on T034, T035)
- [X] T037 [US1] Add CSS animations for smooth transitions in components/landing/mini-kanban-demo.tsx
- [X] T038 [US1] Add prefers-reduced-motion CSS media query support in components/landing/mini-kanban-demo.tsx
- [X] T039 [US1] Integrate useAnimationState hook with 10-second interval in components/landing/mini-kanban-demo.tsx
- [X] T040 [US1] Integrate useIntersectionObserver hook for viewport detection in components/landing/mini-kanban-demo.tsx
- [X] T041 [US1] Integrate useReducedMotion hook for accessibility in components/landing/mini-kanban-demo.tsx
- [X] T042 [US1] Add data attributes for E2E testing (data-ticket-id, data-column) in components/landing/demo-ticket-card.tsx
- [X] T043 [US1] Import and render MiniKanbanDemo in landing page app/page.tsx
- [ ] T044 [US1] Verify all US1 E2E tests pass (Green)

**Checkpoint**: At this point, User Story 1 should be fully functional - animated mini-Kanban displays and progresses tickets automatically

---

## Phase 4: User Story 2 - Interactive Hover Experience (Priority: P2)

**Goal**: Animation pauses when visitor hovers over the board, cursor indicates draggability, and simulated drag provides visual feedback

**Independent Test**: Hover over any ticket or column area, verify animation pauses and cursor changes to grab, attempt to drag and see visual feedback

### Tests for User Story 2

- [ ] T045 [P] [US2] Write failing E2E test for animation pause on hover (Red)
- [ ] T046 [P] [US2] Write failing E2E test for animation resume on mouse leave (Red)
- [ ] T047 [P] [US2] Write failing E2E test for cursor change to grab on ticket hover (Red)
- [ ] T048 [P] [US2] Write failing E2E test for visual drag feedback without position change (Red)
- [ ] T049 [P] [US2] Write failing E2E test for <100ms hover response time (Red)

### Implementation for User Story 2

- [ ] T050 [P] [US2] Add onMouseEnter handler to pause animation in components/landing/mini-kanban-demo.tsx
- [ ] T051 [P] [US2] Add onMouseLeave handler to resume animation in components/landing/mini-kanban-demo.tsx
- [ ] T052 [P] [US2] Add cursor-grab CSS class to tickets in components/landing/demo-ticket-card.tsx
- [ ] T053 [US2] Add hover lift effect (translateY -2px) CSS in components/landing/demo-ticket-card.tsx
- [ ] T054 [US2] Add active state (cursor-grabbing) CSS in components/landing/demo-ticket-card.tsx
- [ ] T055 [US2] Add box-shadow transition on hover (200ms ease) in components/landing/demo-ticket-card.tsx
- [ ] T056 [US2] Verify all US2 E2E tests pass (Green)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - animation pauses on hover with visual drag affordance

---

## Phase 5: User Story 3 - Visual Brand Consistency (Priority: P3)

**Goal**: Mini-Kanban visual design matches the actual AI Board application (colors, shadows, border-radius)

**Independent Test**: Compare mini-Kanban styling side-by-side with actual board at /projects/3/board and verify 95%+ visual match

### Tests for User Story 3

- [ ] T057 [P] [US3] Write failing E2E test for visual regression comparison (Red)
- [ ] T058 [P] [US3] Write failing E2E test for column background color match (Red)
- [ ] T059 [P] [US3] Write failing E2E test for ticket shadow property match (Red)
- [ ] T060 [P] [US3] Write failing E2E test for border-radius consistency (Red)

### Implementation for User Story 3

- [ ] T061 [US3] Inspect existing board column styling in components/board/board.tsx
- [ ] T062 [US3] Inspect existing ticket card styling in components/board/ticket-card.tsx
- [ ] T063 [US3] Extract Tailwind color classes from existing board components
- [ ] T064 [P] [US3] Apply column background colors to WorkflowColumnCard in components/landing/workflow-column-card.tsx
- [ ] T065 [P] [US3] Apply ticket shadow classes to DemoTicketCard in components/landing/demo-ticket-card.tsx
- [ ] T066 [P] [US3] Apply border-radius classes to match existing board in components/landing/workflow-column-card.tsx
- [ ] T067 [US3] Use shadcn/ui Card component primitives if applicable in components/landing/demo-ticket-card.tsx
- [ ] T068 [US3] Verify all US3 E2E visual regression tests pass (Green)

**Checkpoint**: All user stories should now be independently functional - mini-Kanban visually matches the real board

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [X] T069 [P] Add responsive CSS Grid layout for mobile (2 columns) in components/landing/mini-kanban-demo.tsx
- [X] T070 [P] Add responsive CSS Grid layout for tablet (3 columns) in components/landing/mini-kanban-demo.tsx
- [X] T071 [P] Add responsive CSS Grid layout for desktop (6 columns) in components/landing/mini-kanban-demo.tsx
- [ ] T072 Write E2E test for mobile viewport (320px width) rendering
- [ ] T073 Write E2E test for desktop viewport (2560px width) rendering
- [ ] T074 Verify E2E test for responsive layouts pass
- [X] T075 Add GPU acceleration hints (will-change: transform) to CSS
- [ ] T076 Verify 60fps animation performance in Chrome DevTools
- [X] T077 Add comprehensive JSDoc comments to all utility functions
- [X] T078 Add comprehensive JSDoc comments to all custom hooks
- [X] T079 Add comprehensive JSDoc comments to all components
- [ ] T080 Run quickstart.md validation (bun run dev, verify demo displays)
- [X] T081 Run full test suite (bun test) and verify all tests pass
- [ ] T082 Run Lighthouse audit and verify Performance Score > 90
- [X] T083 Code cleanup and remove any console.log debug statements
- [X] T084 Final visual inspection against all 12 functional requirements (FR-001 to FR-012)

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 components but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Refines US1/US2 styling but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD Red-Green-Refactor)
- Component dependencies: WorkflowColumnCard + DemoTicketCard → MiniKanbanDemo
- CSS animations after component structure
- Integration with hooks after hook implementation
- E2E test verification after implementation complete

### Parallel Opportunities

- **Phase 1 (Setup)**: All 5 tasks can run in parallel (T001-T005)
- **Phase 2 (Foundational)**: Type definitions (T006-T009) and Zod schemas (T010) can run in parallel
- **Within Phase 2**: Once types exist, all 3 unit test files (T011, T018, T022) can be created in parallel
- **US1 Tests**: All 7 E2E tests (T027-T033) can be written in parallel
- **US1 Implementation**: WorkflowColumnCard (T034) and DemoTicketCard (T035) can be developed in parallel
- **US2 Tests**: All 5 E2E tests (T045-T049) can be written in parallel
- **US2 Implementation**: Hover handlers (T050-T051) and CSS styling (T052-T055) can be developed in parallel
- **US3 Tests**: All 4 visual tests (T057-T060) can be written in parallel
- **US3 Implementation**: Column styling (T064), ticket styling (T065), and border-radius (T066) can be applied in parallel
- **Phase 6 (Polish)**: Responsive layouts (T069-T071) and documentation (T077-T079) can be done in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all E2E tests for User Story 1 together:
Task: "Write failing E2E test for 6-column mini-Kanban display (Red)"
Task: "Write failing E2E test for 2-3 tickets displayed across columns (Red)"
Task: "Write failing E2E test for automatic 10-second progression (Red)"
Task: "Write failing E2E test for complete INBOX → SHIP journey within 60 seconds (Red)"
Task: "Write failing E2E test for smooth CSS transitions (no jarring jumps) (Red)"
Task: "Write failing E2E test for prefers-reduced-motion accessibility (Red)"

# Launch component development in parallel (different files):
Task: "Create WorkflowColumnCard component in components/landing/workflow-column-card.tsx"
Task: "Create DemoTicketCard component in components/landing/demo-ticket-card.tsx"
```

---

## Parallel Example: User Story 2

```bash
# Launch all hover interaction tests together:
Task: "Write failing E2E test for animation pause on hover (Red)"
Task: "Write failing E2E test for animation resume on mouse leave (Red)"
Task: "Write failing E2E test for cursor change to grab on ticket hover (Red)"
Task: "Write failing E2E test for visual drag feedback without position change (Red)"
Task: "Write failing E2E test for <100ms hover response time (Red)"

# Launch implementation tasks in parallel (different concerns):
Task: "Add onMouseEnter handler to pause animation in components/landing/mini-kanban-demo.tsx"
Task: "Add onMouseLeave handler to resume animation in components/landing/mini-kanban-demo.tsx"
Task: "Add cursor-grab CSS class to tickets in components/landing/demo-ticket-card.tsx"
```

---

## Parallel Example: User Story 3

```bash
# Launch all visual consistency tests together:
Task: "Write failing E2E test for visual regression comparison (Red)"
Task: "Write failing E2E test for column background color match (Red)"
Task: "Write failing E2E test for ticket shadow property match (Red)"
Task: "Write failing E2E test for border-radius consistency (Red)"

# Launch styling tasks in parallel (different components):
Task: "Apply column background colors to WorkflowColumnCard in components/landing/workflow-column-card.tsx"
Task: "Apply ticket shadow classes to DemoTicketCard in components/landing/demo-ticket-card.tsx"
Task: "Apply border-radius classes to match existing board in components/landing/workflow-column-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup → Directory structure ready
2. Complete Phase 2: Foundational → All utilities, hooks, and types tested and working (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 → Animated mini-Kanban with auto-progression
4. **STOP and VALIDATE**: Test US1 independently via quickstart.md
5. Deploy/demo basic animated mini-Kanban

**Why This Works**: User Story 1 delivers the core value proposition - visitors immediately understand the workflow through animation. This is the minimum viable feature.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (types, utilities, hooks all tested)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! Core animation working)
3. Add User Story 2 → Test independently → Deploy/Demo (Enhanced with hover interactions)
4. Add User Story 3 → Test independently → Deploy/Demo (Polished with brand consistency)
5. Complete Phase 6: Polish → Final responsive layouts and performance optimization
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (critical path, all stories depend on this)
2. Once Foundational is done (T026 complete):
   - Developer A: User Story 1 (T027-T044) - Core animation
   - Developer B: User Story 2 (T045-T056) - Hover interactions
   - Developer C: User Story 3 (T057-T068) - Visual consistency
3. Stories complete and integrate independently
4. Team reconvenes for Phase 6: Polish (T069-T084)

**Note**: Given this is a frontend-only feature with tight component coupling, sequential implementation (P1 → P2 → P3) may be more practical than parallel development.

---

## Notes

- **[P] tasks**: Different files or independent concerns, can run in parallel
- **[Story] label**: Maps task to specific user story (US1, US2, US3) for traceability
- **TDD Mandatory**: All tests marked "Red" MUST fail before implementation, then pass after implementation (Green)
- **File Paths**: All tasks include exact file paths for clarity
- **Independent Testing**: Each user story can be validated independently via quickstart.md
- **Checkpoints**: Stop after each phase to validate progress
- **Commit Strategy**: Commit after each task or logical group (e.g., after T013 and T017 for animation helpers)
- **Performance**: Target 60fps animations, <100ms hover response, 0KB bundle overhead (CSS animations only)
- **Accessibility**: prefers-reduced-motion support is mandatory (FR-010)
