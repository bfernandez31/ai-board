# Tasks: Landing Page UX/UI & Accessibility Improvements

**Input**: Design documents from `/specs/AIB-294-copy-of-landing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (no API contracts — frontend-only)

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing project structure, identify all hardcoded hex values, and prepare globals

- [x] T001 Audit all landing page components for hardcoded hex/rgb values and document findings in `components/landing/` and `app/landing/`
- [x] T002 Verify existing Catppuccin Mocha semantic tokens are available in `app/globals.css` and `tailwind.config.ts` per color mapping in data-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Replace all hardcoded hex/rgb colors with semantic Tailwind tokens (FR-004). This MUST be complete before visual/accessibility work begins to ensure a clean baseline.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — all subsequent phases assume semantic tokens are in place.

- [x] T003 [P] Replace hardcoded hex colors with semantic Tailwind tokens in `components/landing/hero-section.tsx` (see data-model.md color mapping)
- [x] T004 [P] Replace hardcoded hex colors with semantic Tailwind tokens in `components/landing/features-grid.tsx`
- [x] T005 [P] Replace hardcoded hex colors with semantic Tailwind tokens in `components/landing/workflow-step.tsx`
- [x] T006 [P] Replace hardcoded hex colors with semantic Tailwind tokens in `components/landing/cta-section.tsx`
- [x] T007 [P] Replace hardcoded hex color prop in `components/landing/feature-card.tsx` to accept semantic token class names instead of hex values
- [x] T008 Run `bun run type-check && bun run lint` to verify zero regressions after token replacement

**Checkpoint**: Zero hardcoded hex/rgb colors remain in landing page components (SC-003). Visual output should be identical to before.

---

## Phase 3: User Story 1 - Accessible Landing Page Experience (Priority: P1) 🎯 MVP

**Goal**: Visitors using assistive technology can fully navigate, understand, and interact with the landing page without barriers. WCAG AA compliance across all sections.

**Independent Test**: Navigate the entire page using only keyboard (Tab/Enter/Space) and verify all content is announced correctly by a screen reader. All text meets 4.5:1 contrast.

### Implementation for User Story 1

- [x] T009 [US1] Add skip-to-content link at the top of the landing page and corresponding anchor target in `app/landing/page.tsx`
- [x] T010 [US1] Audit and fix heading hierarchy (h1 → h2 → h3) across all section components in `components/landing/hero-section.tsx`, `features-grid.tsx`, `workflow-section.tsx`, `pricing-section.tsx`, `cta-section.tsx`
- [x] T011 [P] [US1] Add `aria-hidden="true"` to decorative elements in `app/landing/components/animated-ticket-background.tsx` and verify `prefers-reduced-motion` support
- [x] T012 [P] [US1] Add `aria-label` attributes and visible focus indicators (3px solid outline) to `components/landing/feature-card.tsx`
- [x] T013 [P] [US1] Add `aria-label` attributes to workflow stage elements in `components/landing/workflow-step.tsx`
- [x] T014 [P] [US1] Add accessibility improvements (aria attributes, focus management) to `components/landing/workflow-column-card.tsx`
- [x] T015 [US1] Verify and fix `aria-expanded` and `aria-controls` attributes on collapsible triggers in `components/landing/pricing-faq.tsx`
- [x] T016 [P] [US1] Verify contrast ratios and add visible focus indicators to `components/landing/pricing-card.tsx`
- [x] T017 [US1] Verify logical keyboard tab order across the entire landing page and fix any focus traps or skipped elements in `app/landing/page.tsx` and section components
- [x] T018 [US1] Run `bun run type-check && bun run lint` to verify accessibility changes introduce no regressions

**Checkpoint**: The landing page is fully keyboard-navigable with visible focus indicators, proper heading hierarchy, screen reader support, and WCAG AA contrast compliance (SC-001, SC-002, SC-006).

---

## Phase 4: User Story 2 - Enhanced Visual Design with Unique Identity (Priority: P2)

**Goal**: The landing page has distinctive visual elements that create a memorable impression — unique patterns, refined animations, and cohesive styling that differentiate it from generic SaaS templates.

**Independent Test**: Compare before/after screenshots; verify at least 3 distinctive visual elements are present (SC-008). Confirm animations respect `prefers-reduced-motion`.

### Implementation for User Story 2

- [x] T019 [P] [US2] Add new animation `@keyframes` (fade-in, slide-up) and gradient utility classes to `app/globals.css`, and register animation names in `tailwind.config.ts` if needed
- [x] T020 [P] [US2] Add scroll-triggered section fade-in animations using IntersectionObserver with `motion-safe:` / `motion-reduce:` classes to `components/landing/hero-section.tsx`
- [x] T021 [P] [US2] Add scroll-triggered fade-in animations to `components/landing/features-grid.tsx` with reduced-motion support
- [x] T022 [P] [US2] Add scroll-triggered fade-in animations to `components/landing/workflow-section.tsx` with reduced-motion support
- [x] T023 [P] [US2] Add scroll-triggered fade-in animations to `components/landing/pricing-section.tsx` with reduced-motion support
- [x] T024 [P] [US2] Add scroll-triggered fade-in animations to `components/landing/cta-section.tsx` with reduced-motion support
- [x] T025 [US2] Add distinctive section dividers (gradient or SVG shapes) between major sections in `app/landing/page.tsx` or section components
- [x] T026 [US2] Add unique decorative elements (gradient mesh patterns, custom border treatments) to at least 2 sections to achieve SC-008 (3+ distinctive elements)
- [x] T027 [US2] Refine typography spacing and visual rhythm across all section components for improved readability (FR-013)
- [x] T028 [US2] Verify all new animations are fully functional and content remains visible when animations are disabled (`prefers-reduced-motion`) — test across all sections
- [x] T029 [US2] Run `bun run type-check && bun run lint` to verify visual enhancement changes

**Checkpoint**: Landing page has 3+ distinctive visual elements (SC-008), smooth scroll animations that respect reduced-motion (SC-007), and refined typography/spacing (FR-013).

---

## Phase 5: User Story 3 - Improved Mobile & Tablet Experience (Priority: P3)

**Goal**: Mobile and tablet visitors see an optimized layout with a visible workflow section (not hidden), touch-friendly interactions, and smooth performance.

**Independent Test**: Load the page on 375px and 768px viewports; verify the workflow section is visible and informative, all CTAs have 44x44px touch targets, and scrolling is smooth.

### Implementation for User Story 3

- [x] T030 [US3] Replace `hidden lg:block` / `lg:hidden` pattern with responsive layout in `components/landing/workflow-section.tsx` so workflow content is visible on all viewports
- [x] T031 [US3] Create mobile-optimized workflow visualization (horizontally-scrollable compact columns or animated carousel) in `components/landing/mini-kanban-demo.tsx` or new `components/landing/mobile-workflow-demo.tsx`
- [x] T032 [P] [US3] Ensure all CTA buttons have minimum touch target size of 44x44px (`min-h-[44px] min-w-[44px]`) across `components/landing/hero-section.tsx`, `cta-section.tsx`, `pricing-card.tsx`
- [x] T033 [US3] Verify tablet layout (768px-1023px) adapts gracefully with appropriate card sizes and spacing in `components/landing/features-grid.tsx` and `components/landing/pricing-section.tsx`
- [x] T034 [US3] Test mobile performance — ensure no jank from animations or heavy elements on 375px and 768px viewports
- [x] T035 [US3] Run `bun run type-check && bun run lint` to verify mobile enhancement changes

**Checkpoint**: Workflow section renders meaningful content on mobile (SC-005), all touch targets >= 44x44px (SC-004), and performance is smooth on mobile viewports (SC-009).

---

## Phase 6: User Story 4 - Refined Pricing & FAQ Section (Priority: P4)

**Goal**: Visitors can quickly understand plan differences, identify the best option, and access FAQ answers with clear visual hierarchy and accessible interactions.

**Independent Test**: Navigate the pricing section via keyboard; verify plan comparison is intuitive and FAQ interactions work with screen readers.

### Implementation for User Story 4

- [x] T036 [US4] Enhance visual hierarchy of pricing cards to make tier differences immediately clear in `components/landing/pricing-section.tsx`
- [x] T037 [US4] Make "Most Popular" plan visually prominent without overwhelming other options in `components/landing/pricing-card.tsx`
- [x] T038 [US4] Verify FAQ keyboard interaction (Enter/Space toggles, `aria-expanded` announced) in `components/landing/pricing-faq.tsx`
- [x] T039 [US4] Run `bun run type-check && bun run lint` to verify pricing section changes

**Checkpoint**: Pricing section has clear visual hierarchy, accessible FAQ interactions, and proper screen reader announcements.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories, edge cases, and performance

- [x] T040 Verify edge case: page at very large viewport widths (> 2560px) — content centered with max-width container
- [x] T041 Verify edge case: browser zoom at 200% — no overlapping elements, content remains accessible
- [x] T042 Verify page load performance remains within 10% of current metrics (SC-009) — no significant regression from visual enhancements
- [x] T043 Run full existing test suite (`bun run test`) to confirm no regressions
- [x] T044 Final `bun run type-check && bun run lint` pass across all modified files
- [x] T045 Run quickstart.md validation checklist — confirm all items pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (hex→token replacement must be clean baseline)
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) — accessibility foundation
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) — can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) — can run in parallel with US1/US2
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2) — can run in parallel with US1/US2/US3
- **Polish (Phase 7)**: Depends on ALL user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — accessibility is standalone
- **User Story 2 (P2)**: No hard dependencies — animations are additive to accessible baseline; benefits from US1 focus indicators being in place
- **User Story 3 (P3)**: No hard dependencies — mobile layout is orthogonal to desktop visual changes
- **User Story 4 (P4)**: No hard dependencies — pricing refinement is self-contained; benefits from US1 accessibility attributes

### Within Each User Story

- Core structural changes before cosmetic refinements
- Accessibility attributes before visual enhancements
- Type-check and lint after each story's implementation
- Story complete before moving to next priority (recommended sequential for clean diffs)

### Parallel Opportunities

- **Phase 2**: T003-T007 can all run in parallel (different component files)
- **Phase 3**: T011-T014, T016 can run in parallel (different files)
- **Phase 4**: T019-T024 can run in parallel (different files for animation additions)
- **Phase 5**: T032 can run in parallel with T030-T031
- **Cross-story**: US1-US4 can theoretically run in parallel after Phase 2, but sequential is recommended to avoid merge conflicts on shared files

---

## Parallel Example: User Story 1

```bash
# Launch parallel accessibility tasks (different files):
Task: "Add aria-hidden to animated-ticket-background.tsx"         # T011
Task: "Add aria-label and focus indicators to feature-card.tsx"   # T012
Task: "Add aria-label to workflow-step.tsx"                       # T013
Task: "Add accessibility to workflow-column-card.tsx"             # T014
Task: "Verify contrast and focus on pricing-card.tsx"             # T016
```

## Parallel Example: User Story 2

```bash
# Launch parallel animation tasks (different files):
Task: "Add animations to globals.css and tailwind.config.ts"     # T019
Task: "Add scroll fade-in to hero-section.tsx"                   # T020
Task: "Add scroll fade-in to features-grid.tsx"                  # T021
Task: "Add scroll fade-in to workflow-section.tsx"               # T022
Task: "Add scroll fade-in to pricing-section.tsx"                # T023
Task: "Add scroll fade-in to cta-section.tsx"                    # T024
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (audit hex values)
2. Complete Phase 2: Foundational (replace all hex → semantic tokens)
3. Complete Phase 3: User Story 1 (accessibility)
4. **STOP and VALIDATE**: Full keyboard navigation test, screen reader test, contrast check
5. Deploy/demo if ready — page is now WCAG AA compliant

### Incremental Delivery

1. Complete Setup + Foundational → Clean token baseline
2. Add User Story 1 (Accessibility) → Test independently → Deploy (MVP!)
3. Add User Story 2 (Visual Design) → Test independently → Deploy
4. Add User Story 3 (Mobile) → Test independently → Deploy
5. Add User Story 4 (Pricing) → Test independently → Deploy
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel task 1: User Story 1 (Accessibility)
   - Parallel task 2: User Story 2 (Visual Design)
   - Parallel task 3: User Story 3 (Mobile)
   - Parallel task 4: User Story 4 (Pricing)
3. Stories complete and integrate independently
4. **Recommendation**: Sequential execution (P1→P2→P3→P4) preferred due to overlapping files

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- No test tasks included (not explicitly requested in spec)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All color changes must use semantic Tailwind tokens (zero hex/rgb in final output)
- All animations must respect `prefers-reduced-motion`
