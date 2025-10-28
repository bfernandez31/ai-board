# Tasks: Animated Ticket Background

**Input**: Design documents from `/specs/071-926-animated-ticket/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/component-api.md, quickstart.md

**Feature Summary**: CSS-only floating ticket animation with 18 semi-transparent ticket cards drifting left-to-right over 40-60 seconds. Responsive (18 desktop, 12 tablet, 8 mobile), GPU-accelerated, and respects `prefers-reduced-motion`.

**Tests**: Tests are included per quickstart.md requirements (TDD approach with 7 E2E tests).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Next.js 15 web application with App Router
- Component: `app/(landing)/components/`
- Tests: `tests/e2e/`
- Config: Repository root (`tailwind.config.ts`, `app/globals.css`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and TailwindCSS configuration

- [X] T001 [P] Extend TailwindCSS keyframes with ticket-drift animation in tailwind.config.ts
- [X] T002 [P] Extend TailwindCSS animation configuration with ticket-drift in tailwind.config.ts
- [X] T003 [P] Extend TailwindCSS colors with Catppuccin Mocha palette (mauve, blue, sapphire, green, yellow) in tailwind.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add responsive CSS media queries for ticket visibility (mobile: 8, tablet: 12, desktop: 18) in app/globals.css

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - First-time Visitor Experiences Premium Landing Page (Priority: P1) 🎯 MVP

**Goal**: Display 18 animated ticket cards drifting across hero section background on desktop, maintaining text legibility and zero pointer interference

**Independent Test**: Load homepage on desktop (≥1024px) and observe 18 semi-transparent tickets drifting left-to-right behind hero text without interfering with interactions

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T005 [P] [US1] E2E test: Verify 18 ticket cards render on landing page in tests/e2e/landing-animation.spec.ts
- [X] T006 [P] [US1] E2E test: Verify 18 tickets visible on desktop viewport (1920x1080) in tests/e2e/landing-animation.spec.ts
- [X] T007 [P] [US1] E2E test: Verify pointer-events disabled on ticket cards in tests/e2e/landing-animation.spec.ts
- [X] T008 [P] [US1] E2E test: Verify aria-hidden="true" attribute on ticket cards in tests/e2e/landing-animation.spec.ts

### Implementation for User Story 1

- [X] T009 [US1] Create AnimatedTicketBackground Server Component with TicketCard subcomponent in app/landing/components/animated-ticket-background.tsx
- [X] T010 [US1] Implement deterministic randomization function (getTicketProps) for animation properties in app/landing/components/animated-ticket-background.tsx
- [X] T011 [US1] Integrate AnimatedTicketBackground component into landing page hero section with z-index layering in components/landing/hero-section.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - desktop users see 18 animated tickets behind hero content with no interaction interference

---

## Phase 4: User Story 2 - Mobile User Sees Optimized Animation (Priority: P2)

**Goal**: Display 8 animated ticket cards on mobile devices (<768px) to maintain 60fps performance without battery drain

**Independent Test**: Load homepage on mobile viewport (375x667), verify only 8 tickets visible and animation remains smooth at 60fps

### Tests for User Story 2

- [X] T012 [P] [US2] E2E test: Verify 12 tickets visible on tablet viewport (800x1024) in tests/e2e/landing-animation.spec.ts
- [X] T013 [P] [US2] E2E test: Verify 8 tickets visible on mobile viewport (375x667) in tests/e2e/landing-animation.spec.ts

### Implementation for User Story 2

**NOTE**: Responsive CSS already added in Phase 2 (T004) - this phase validates behavior

- [X] T014 [US2] Verify responsive breakpoint CSS correctly hides tickets 13-18 on tablet and 9-18 on mobile in app/globals.css

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently - animation adapts to viewport size without performance degradation

---

## Phase 5: User Story 3 - Accessibility-conscious User Disables Motion (Priority: P1)

**Goal**: Automatically disable animation for users with motion sensitivity (prefers-reduced-motion setting), providing static hero section

**Independent Test**: Enable "prefers-reduced-motion" in browser/OS settings, load homepage, verify no animation plays and tickets are static or hidden

### Tests for User Story 3

- [X] T015 [US3] E2E test: Verify animation respects prefers-reduced-motion setting (animation disabled) in tests/e2e/landing-animation.spec.ts

### Implementation for User Story 3

**NOTE**: Accessibility already implemented in T009 (motion-safe/motion-reduce variants) - this phase validates behavior

- [X] T016 [US3] Verify motion-safe and motion-reduce Tailwind variants correctly applied to ticket-drift animation in app/landing/components/animated-ticket-background.tsx

**Checkpoint**: All user stories (US1, US2, US3) should now be independently functional - animation works on all devices, adapts to viewport, and respects accessibility preferences

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T017 [P] Verify GPU acceleration enabled (will-change: transform, no layout thrashing) in app/landing/components/animated-ticket-background.tsx
- [X] T018 [P] Verify deterministic randomization prevents hydration mismatch (Server Component safety) in app/landing/components/animated-ticket-background.tsx
- [X] T019 [P] Verify Catppuccin color distribution across 18 tickets (3-4 per color) in app/landing/components/animated-ticket-background.tsx
- [X] T020 Run full E2E test suite to validate all 7 test cases pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US3 → US2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Validates responsive CSS from Phase 2
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Validates motion-safe variants from US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD workflow)
- Component creation before landing page integration (US1 only)
- Validation tasks verify existing implementation (US2, US3)
- Manual performance testing after automated tests pass (Phase 6)

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel
- All US1 tests (T005-T008) can run in parallel
- All US2 tests (T012-T013) can run in parallel
- All Polish validation tasks (T017-T019) can run in parallel
- User Stories 1, 2, and 3 can be worked on in parallel after Phase 2 completes

---

## Parallel Example: Phase 1 (Setup)

```bash
# Launch all TailwindCSS config tasks together:
Task: "Extend TailwindCSS keyframes with ticket-drift animation in tailwind.config.ts"
Task: "Extend TailwindCSS animation configuration with ticket-drift in tailwind.config.ts"
Task: "Extend TailwindCSS colors with Catppuccin Mocha palette in tailwind.config.ts"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all E2E tests for User Story 1 together:
Task: "E2E test: Verify 18 ticket cards render on landing page"
Task: "E2E test: Verify 18 tickets visible on desktop viewport"
Task: "E2E test: Verify pointer-events disabled on ticket cards"
Task: "E2E test: Verify aria-hidden attribute on ticket cards"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3)

1. Complete Phase 1: Setup (T001-T003) → TailwindCSS configured
2. Complete Phase 2: Foundational (T004) → Responsive CSS ready
3. Complete Phase 3: User Story 1 (T005-T011) → Desktop animation working
4. Complete Phase 5: User Story 3 (T015-T016) → Accessibility compliance
5. **STOP and VALIDATE**: Test desktop animation with prefers-reduced-motion toggle
6. Deploy/demo if ready (responsive mobile validation can follow)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (~10 minutes)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! ~15 minutes)
3. Add User Story 3 → Test independently → Deploy/Demo (a11y compliance! ~5 minutes)
4. Add User Story 2 → Test independently → Deploy/Demo (mobile optimization! ~5 minutes)
5. Polish phase → Performance validation → Final release (~10 minutes)

**Total Estimated Time**: 45 minutes (matches quickstart.md estimate of 30-45 minutes)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (~10 minutes)
2. Once Foundational is done:
   - Developer A: User Story 1 (T005-T011) - Desktop animation
   - Developer B: User Story 2 (T012-T014) - Mobile optimization
   - Developer C: User Story 3 (T015-T016) - Accessibility
3. Developers merge independently, run full E2E suite (T023)
4. Team completes Polish phase together (T017-T022)

---

## Notes

- All tasks follow TDD workflow: Write tests first (RED), implement (GREEN), validate (REFACTOR)
- [P] tasks target different files and can execute in parallel
- [Story] labels (US1, US2, US3) map to spec.md user stories for traceability
- User Story 1 + User Story 3 form MVP (desktop + accessibility)
- User Story 2 validates responsive behavior (no code changes needed if Phase 2 correct)
- Phase 6 includes manual performance testing (60fps, <200ms load, WCAG contrast)
- Commit after each user story phase completion
- Avoid: Skipping tests, implementing before tests fail, modifying files in parallel within same task
