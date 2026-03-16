# Tasks: Copy of Landing page

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/contracts/landing-page-contract.yaml`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/quickstart.md`

**Tests**: Include Vitest and Playwright coverage because the implementation plan and quickstart explicitly require component verification plus browser-required keyboard, responsive, and reduced-motion checks.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently once foundational landing-page updates are complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared landing-page content contract and test files that all story work will build on.

- [ ] T001 Create a shared landing-page content map aligned to `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/contracts/landing-page-contract.yaml` in `/home/runner/work/ai-board/ai-board/target/components/landing/content.ts`
- [ ] T002 [P] Create the landing-page component test scaffold for narrative sections and CTA assertions in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx`
- [ ] T003 [P] Create the landing-page browser test scaffold for keyboard order, viewport coverage, and reduced-motion checks in `/home/runner/work/ai-board/ai-board/target/tests/e2e/landing-page.spec.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core landing-page structure and shared styling rules that MUST be complete before user story implementation.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T004 Refactor `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx` to render sections from `/home/runner/work/ai-board/ai-board/target/components/landing/content.ts` with the contract order for hero, proof, workflow, capabilities, pricing, and final CTA
- [ ] T005 [P] Replace landing-specific hardcoded color usage with semantic or token-backed classes in `/home/runner/work/ai-board/ai-board/target/components/landing/hero-section.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/features-grid.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/workflow-section.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/landing/cta-section.tsx`
- [ ] T006 [P] Replace shared marketing navigation hardcoded colors and align anchor labels with landing sections in `/home/runner/work/ai-board/ai-board/target/components/layout/header.tsx` and `/home/runner/work/ai-board/ai-board/target/components/layout/mobile-menu.tsx`
- [ ] T007 [P] Make decorative landing motion reduced-motion safe and reusable in `/home/runner/work/ai-board/ai-board/target/app/landing/components/animated-ticket-background.tsx` and `/home/runner/work/ai-board/ai-board/target/components/landing/mini-kanban-demo.tsx`

**Checkpoint**: Foundation ready. User story phases can now proceed with stable section data, semantic styling, and shared motion/navigation rules.

---

## Phase 3: User Story 1 - Understand the Product Faster (Priority: P1) 🎯 MVP

**Goal**: Make the homepage communicate product purpose, audience, and next action immediately through a clearer narrative sequence.

**Independent Test**: Render `/` as an unauthenticated visitor and verify the hero, first proof section, workflow section, and closing CTA make the product purpose, audience, and primary next step obvious after one pass.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add Vitest coverage for landing-page section order, hero messaging, and repeated CTA labels in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx`
- [ ] T009 [P] [US1] Add route-level assertions for unauthenticated landing render and authenticated redirect behavior in `/home/runner/work/ai-board/ai-board/target/tests/integration/landing/homepage.test.ts`

### Implementation for User Story 1

- [ ] T010 [P] [US1] Rewrite the hero narrative, CTA copy, and above-the-fold hierarchy in `/home/runner/work/ai-board/ai-board/target/components/landing/hero-section.tsx`
- [ ] T011 [P] [US1] Create a proof/trust strip that surfaces supportable differentiators and CTA reinforcement in `/home/runner/work/ai-board/ai-board/target/components/landing/proof-strip.tsx`
- [ ] T012 [US1] Rework the capability overview to remove redundant copy and connect each section to the visitor journey in `/home/runner/work/ai-board/ai-board/target/components/landing/features-grid.tsx` and `/home/runner/work/ai-board/ai-board/target/components/landing/feature-card.tsx`
- [ ] T013 [US1] Update the landing-page composition to insert `/home/runner/work/ai-board/ai-board/target/components/landing/proof-strip.tsx` and preserve the contract section order in `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx`
- [ ] T014 [US1] Align the final conversion message and CTA wording with the hero in `/home/runner/work/ai-board/ai-board/target/components/landing/cta-section.tsx`

**Checkpoint**: User Story 1 is complete when a first-time visitor can identify what AI Board does, who it is for, and the main next step without scanning unrelated sections.

---

## Phase 4: User Story 2 - Browse a More Distinctive Brand Experience (Priority: P2)

**Goal**: Make the landing page feel more specific and memorable through stronger section pacing, proof details, and product-specific presentation while keeping the current palette.

**Independent Test**: Review the full page journey and confirm the proof, workflow, capabilities, pricing, and final CTA sections each have a distinct visual and narrative role without unsupported claims or palette drift.

### Tests for User Story 2

- [ ] T015 [P] [US2] Extend component assertions for proof signals, workflow specificity, and pricing CTA consistency in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx`

### Implementation for User Story 2

- [ ] T016 [P] [US2] Refresh the workflow section narrative and differentiated section pacing in `/home/runner/work/ai-board/ai-board/target/components/landing/workflow-section.tsx` and `/home/runner/work/ai-board/ai-board/target/components/landing/workflow-step.tsx`
- [ ] T017 [P] [US2] Rework the animated workflow demo to emphasize real AI Board artifacts and stage progression in `/home/runner/work/ai-board/ai-board/target/components/landing/mini-kanban-demo.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/workflow-column-card.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/landing/demo-ticket-card.tsx`
- [ ] T018 [P] [US2] Update pricing and trust presentation so plan clarity supports the narrative without generic copy in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx`
- [ ] T019 [US2] Refine the landing-page background rhythm and closing section emphasis while keeping semantic tokens in `/home/runner/work/ai-board/ai-board/target/components/landing/hero-section.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/proof-strip.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/landing/cta-section.tsx`

**Checkpoint**: User Story 2 is complete when the page feels recognizably more original, each section has a distinct role, and all claims remain supportable by the product.

---

## Phase 5: User Story 3 - Use the Page Accessibly Across Devices (Priority: P2)

**Goal**: Ensure the refreshed landing page remains readable, keyboard-friendly, and reduced-motion safe on mobile, tablet, and desktop.

**Independent Test**: Validate `/` at mobile, tablet, and desktop widths, tab through all marketing actions in order, and confirm reduced-motion preference does not hide or block important content.

### Tests for User Story 3

- [ ] T020 [P] [US3] Add Playwright coverage for responsive layout, keyboard traversal, and CTA reachability in `/home/runner/work/ai-board/ai-board/target/tests/e2e/landing-page.spec.ts`
- [ ] T021 [P] [US3] Add unit coverage for reduced-motion behavior in landing animation components in `/home/runner/work/ai-board/ai-board/target/tests/unit/mini-kanban-animation.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/unit/use-reduced-motion.test.ts`

### Implementation for User Story 3

- [ ] T022 [P] [US3] Fix marketing header and mobile menu focus order, link labels, and breakpoint behavior in `/home/runner/work/ai-board/ai-board/target/components/layout/header.tsx` and `/home/runner/work/ai-board/ai-board/target/components/layout/mobile-menu.tsx`
- [ ] T023 [P] [US3] Improve section-level heading structure, spacing, and no-horizontal-scroll behavior in `/home/runner/work/ai-board/ai-board/target/components/landing/hero-section.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/features-grid.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/workflow-section.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/landing/cta-section.tsx`
- [ ] T024 [US3] Ensure decorative motion falls back cleanly for reduced-motion users in `/home/runner/work/ai-board/ai-board/target/app/landing/components/animated-ticket-background.tsx`, `/home/runner/work/ai-board/ai-board/target/components/landing/mini-kanban-demo.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/landing/workflow-column-card.tsx`

**Checkpoint**: User Story 3 is complete when keyboard users, reduced-motion users, and visitors on mobile through desktop can traverse the page without blocked actions or readability regressions.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup that spans all stories.

- [ ] T025 [P] Run the landing-page verification flow from `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/quickstart.md` and capture any required assertion updates in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx` and `/home/runner/work/ai-board/ai-board/target/tests/e2e/landing-page.spec.ts`
- [ ] T026 [P] Document final section-order, CTA, and accessibility expectations for future reviewers in `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/quickstart.md`
- [ ] T027 Run final landing-page cleanup in `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx` and `/home/runner/work/ai-board/ai-board/target/components/landing/content.ts` to remove dead copy paths and keep the contract-aligned composition maintainable

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user-story work.
- **User Story 1 (Phase 3)**: Depends on Foundational and establishes the MVP narrative.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because section distinctiveness builds on the finalized narrative structure.
- **User Story 3 (Phase 5)**: Depends on User Story 1 and can run in parallel with User Story 2 once the core section order and CTA flow are stable.
- **Polish (Phase 6)**: Depends on all selected user stories being complete.

### User Story Dependency Graph

- `US1 -> US2`
- `US1 -> US3`
- `US2` and `US3` can run in parallel after `US1`

### Within Each User Story

- Write the listed tests before implementation and confirm they fail against the current landing page.
- Update shared content and composition before polishing section-specific visuals.
- Keep CTA labels and destinations consistent between hero, navigation, pricing, and closing conversion areas.
- Preserve supportable product claims only; do not introduce new capabilities, testimonials, or invented metrics.

### Parallel Opportunities

- `T002` and `T003` can run in parallel during setup.
- `T005`, `T006`, and `T007` can run in parallel once `T004` defines the shared composition.
- In `US1`, `T008`, `T009`, `T010`, and `T011` can run in parallel before the integration tasks `T012` through `T014`.
- In `US2`, `T016`, `T017`, and `T018` can run in parallel before `T019`.
- In `US3`, `T020`, `T021`, `T022`, and `T023` can run in parallel before `T024`.

---

## Parallel Example: User Story 1

```bash
Task: "T008 [US1] Add Vitest coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx"
Task: "T009 [US1] Add route-level assertions in /home/runner/work/ai-board/ai-board/target/tests/integration/landing/homepage.test.ts"
Task: "T010 [US1] Rewrite hero narrative in /home/runner/work/ai-board/ai-board/target/components/landing/hero-section.tsx"
Task: "T011 [US1] Create proof strip in /home/runner/work/ai-board/ai-board/target/components/landing/proof-strip.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T016 [US2] Refresh workflow narrative in /home/runner/work/ai-board/ai-board/target/components/landing/workflow-section.tsx and /home/runner/work/ai-board/ai-board/target/components/landing/workflow-step.tsx"
Task: "T017 [US2] Rework animated workflow demo in /home/runner/work/ai-board/ai-board/target/components/landing/mini-kanban-demo.tsx, /home/runner/work/ai-board/ai-board/target/components/landing/workflow-column-card.tsx, and /home/runner/work/ai-board/ai-board/target/components/landing/demo-ticket-card.tsx"
Task: "T018 [US2] Update pricing trust presentation in /home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx, /home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx, and /home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T020 [US3] Add Playwright coverage in /home/runner/work/ai-board/ai-board/target/tests/e2e/landing-page.spec.ts"
Task: "T021 [US3] Add reduced-motion unit coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/mini-kanban-animation.test.ts and /home/runner/work/ai-board/ai-board/target/tests/unit/use-reduced-motion.test.ts"
Task: "T022 [US3] Fix marketing navigation accessibility in /home/runner/work/ai-board/ai-board/target/components/layout/header.tsx and /home/runner/work/ai-board/ai-board/target/components/layout/mobile-menu.tsx"
Task: "T023 [US3] Improve responsive section accessibility in /home/runner/work/ai-board/ai-board/target/components/landing/hero-section.tsx, /home/runner/work/ai-board/ai-board/target/components/landing/features-grid.tsx, /home/runner/work/ai-board/ai-board/target/components/landing/workflow-section.tsx, /home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx, and /home/runner/work/ai-board/ai-board/target/components/landing/cta-section.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx` and `/home/runner/work/ai-board/ai-board/target/tests/integration/landing/homepage.test.ts`.
5. Review the landing page manually against `/home/runner/work/ai-board/ai-board/target/specs/AIB-293-copy-of-landing/quickstart.md`.

### Incremental Delivery

1. Deliver Setup + Foundational to establish the contract-aligned landing shell.
2. Deliver User Story 1 as the MVP for message clarity and conversion flow.
3. Deliver User Story 2 to increase distinctiveness without changing the palette or product truthfulness.
4. Deliver User Story 3 to harden keyboard, responsive, and reduced-motion behavior across the refreshed sections.
5. Finish with Phase 6 verification and cleanup.

### Parallel Execution Strategy

1. Execute Setup and Foundational sequentially.
2. Execute User Story 1 next because it defines the final narrative structure.
3. Execute User Story 2 and User Story 3 in parallel once User Story 1 is stable.
4. Run final polish and the quickstart verification flow after both P2 stories land.

---

## Notes

- All tasks use the required checklist format: checkbox, task ID, optional `[P]`, required story label for story tasks, and exact file paths.
- `US1` is the recommended MVP scope because it delivers the primary value proposition and CTA clarity.
- Playwright coverage is intentionally limited to browser-only requirements; the rest of the validation should stay in Vitest and integration tests.
