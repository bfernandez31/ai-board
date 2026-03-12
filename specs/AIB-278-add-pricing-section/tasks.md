# Tasks: Landing Page Pricing Section

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/contracts/landing-pricing-contract.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/quickstart.md`

**Tests**: Include unit/component tests because the implementation plan and research explicitly require automated coverage for section order, CTA labels, FAQ copy, and pricing navigation.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently once the shared pricing view-model foundation is in place.

## Phase 1: Setup

**Purpose**: Confirm the implementation touchpoints and source-of-truth files before changing shared marketing components.

- [X] T001 Review the landing-page insertion point in `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx` to preserve the workflow-to-CTA section order
- [X] T002 Review canonical billing plan metadata in `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts` before deriving landing-page pricing content

---

## Phase 2: Foundational

**Purpose**: Build the shared pricing view-model layer that all user stories depend on.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [X] T003 Add failing shared pricing view-model tests in `/home/runner/work/ai-board/ai-board/target/tests/unit/landing/pricing.test.ts` for plan order, CTA labels, FAQ count, and `#pricing` anchor metadata
- [X] T004 Implement the shared pricing mapper and typed landing-page content in `/home/runner/work/ai-board/ai-board/target/lib/landing/pricing.ts`

**Checkpoint**: Shared pricing content is typed, testable, and ready for story-specific UI work.

---

## Phase 3: User Story 1 - Compare Plans on the Landing Page (Priority: P1) 🎯 MVP

**Goal**: Render a server-side pricing section between the workflow and final CTA so visitors can compare Free, Pro, and Team on the landing page.

**Independent Test**: Visit `/` while signed out and verify the pricing section appears after the workflow section and before the final CTA, with three readable plan cards in Free → Pro → Team order.

### Tests for User Story 1

- [X] T005 [P] [US1] Add a failing component test in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/pricing-section.test.tsx` for three-card rendering, plan order, and responsive-safe copy
- [X] T006 [P] [US1] Add a failing landing-page composition test in `/home/runner/work/ai-board/ai-board/target/tests/unit/app/landing-page.test.tsx` for placing pricing between the workflow and CTA sections

### Implementation for User Story 1

- [X] T007 [P] [US1] Create the reusable plan card component in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx`
- [X] T008 [P] [US1] Implement the pricing section shell and three-card grid in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx`
- [X] T009 [US1] Insert the pricing section into `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx` after `WorkflowSection` and before `CTASection`

**Checkpoint**: User Story 1 is complete when the landing page shows the comparison section in the correct position and layout without relying on FAQ or navigation changes.

---

## Phase 4: User Story 2 - Start the Correct Plan Flow (Priority: P1)

**Goal**: Ensure each pricing card exposes the correct CTA label and destination for the Free, Pro, and Team journeys.

**Independent Test**: Inspect the pricing cards on `/` and verify Free shows `Get Started`, Pro shows `Start 14-day trial`, Team shows `Start 14-day trial`, and each CTA uses the existing auth entry path.

### Tests for User Story 2

- [X] T010 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/pricing-section.test.tsx` with failing assertions for CTA labels and href targets on all three plan cards

### Implementation for User Story 2

- [X] T011 [US2] Add plan-specific CTA label and href mapping in `/home/runner/work/ai-board/ai-board/target/lib/landing/pricing.ts`
- [X] T012 [US2] Wire the mapped CTA content into the card actions in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx`

**Checkpoint**: User Story 2 is complete when each rendered card leads to the correct next-step messaging without changing the billing backend or adding routes.

---

## Phase 5: User Story 3 - Resolve Basic Pricing Questions Quickly (Priority: P2)

**Goal**: Add the two-item FAQ and visible pricing anchor links so visitors can answer common questions and jump back to pricing from navigation surfaces.

**Independent Test**: Confirm the pricing section includes BYOK and supported-agents FAQ entries, and confirm the footer exposes a visible `Pricing` link that returns to `#pricing` without removing legal links.

### Tests for User Story 3

- [X] T013 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/pricing-section.test.tsx` with failing assertions for the two FAQ entries and the `id="pricing"` anchor target
- [X] T014 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/header.test.tsx` with failing assertions for the marketing `Pricing` anchor link on `/`
- [X] T015 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/footer.test.tsx` with failing assertions for the footer `Pricing` link coexisting with `Terms of Service` and `Privacy Policy`

### Implementation for User Story 3

- [X] T016 [P] [US3] Create the two-entry FAQ component in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx`
- [X] T017 [US3] Add the FAQ block and `id="pricing"` section anchor in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx`
- [X] T018 [P] [US3] Add the marketing `Pricing` fragment link in `/home/runner/work/ai-board/ai-board/target/components/layout/header.tsx`
- [X] T019 [P] [US3] Add the footer `Pricing` fragment link in `/home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx`

**Checkpoint**: User Story 3 is complete when the landing page answers the two scoped pre-purchase questions and both navigation surfaces expose working pricing anchors.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish responsive/accessibility validation and run the prescribed feature checks across all touched stories.

- [X] T020 [P] Audit semantic Tailwind usage, heading hierarchy, and responsive spacing in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx`
- [X] T021 Run the feature validation checklist from `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/quickstart.md`, including `bun run type-check`, `bun run lint`, and targeted unit tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies.
- **Phase 2: Foundational** depends on Phase 1 and blocks all story work.
- **Phase 3: US1** depends on Phase 2.
- **Phase 4: US2** depends on Phase 2 and on the pricing card UI created in US1.
- **Phase 5: US3** depends on Phase 2 and on the pricing section container created in US1.
- **Phase 6: Polish** depends on the stories you choose to ship.

### User Story Dependency Graph

- **US1 (P1)**: Start first after Phase 2; it is the MVP and the base for the rest of the feature.
- **US2 (P1)**: Start after US1 establishes the pricing cards; it only changes CTA behavior and copy.
- **US3 (P2)**: Start after US1 establishes the pricing section; FAQ and navigation anchor work can then proceed in parallel with US2.

### Suggested Completion Order

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: US1
4. Phase 4: US2 and Phase 5: US3
5. Phase 6: Polish

### Parallel Opportunities

- Setup tasks are sequential and lightweight.
- T005 and T006 can run in parallel because they touch different test files.
- T007 and T008 can run in parallel because they touch different component files.
- T013, T014, and T015 can run in parallel because they extend separate test files.
- T016, T018, and T019 can run in parallel because they touch separate implementation files.

---

## Parallel Example: User Story 1

```bash
Task: "T005 [US1] Add a failing component test in /home/runner/work/ai-board/ai-board/target/tests/unit/components/pricing-section.test.tsx for three-card rendering, plan order, and responsive-safe copy"
Task: "T006 [US1] Add a failing landing-page composition test in /home/runner/work/ai-board/ai-board/target/tests/unit/app/landing-page.test.tsx for placing pricing between the workflow and CTA sections"

Task: "T007 [US1] Create the reusable plan card component in /home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx"
Task: "T008 [US1] Implement the pricing section shell and three-card grid in /home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T010 [US2] Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/pricing-section.test.tsx with failing assertions for CTA labels and href targets on all three plan cards"
Task: "T011 [US2] Add plan-specific CTA label and href mapping in /home/runner/work/ai-board/ai-board/target/lib/landing/pricing.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T013 [US3] Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/pricing-section.test.tsx with failing assertions for the two FAQ entries and the id=\"pricing\" anchor target"
Task: "T014 [US3] Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/header.test.tsx with failing assertions for the marketing Pricing anchor link on /"
Task: "T015 [US3] Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/footer.test.tsx with failing assertions for the footer Pricing link coexisting with Terms of Service and Privacy Policy"

Task: "T016 [US3] Create the two-entry FAQ component in /home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx"
Task: "T018 [US3] Add the marketing Pricing fragment link in /home/runner/work/ai-board/ai-board/target/components/layout/header.tsx"
Task: "T019 [US3] Add the footer Pricing fragment link in /home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 only.
3. Validate the signed-out landing page section order, three-card rendering, and responsive readability.
4. Ship or review the MVP before layering CTA and FAQ/navigation refinements.

### Incremental Delivery

1. Deliver US1 to establish the pricing section.
2. Deliver US2 to finalize CTA messaging and entry points.
3. Deliver US3 to add FAQ content and pricing anchors in header/footer.
4. Finish with Phase 6 validation before merge.

### Parallel Execution Strategy

1. Keep Setup and Foundational work sequential.
2. Within US1, parallelize tests and component creation where files do not overlap.
3. After US1 lands, execute US2 and US3 in parallel because they mostly touch different files.
4. Consolidate with a final validation pass from `quickstart.md`.

---

## Notes

- All task lines use the required `- [ ] T### [P] [US#] Description with file path` checklist format.
- `[P]` is only used where the task can proceed without editing the same file as another incomplete task.
- Tests are listed before implementation within each story to preserve the TDD requirement from the plan.
- No API, Prisma, or billing-backend tasks are included because the design artifacts explicitly rule them out.
