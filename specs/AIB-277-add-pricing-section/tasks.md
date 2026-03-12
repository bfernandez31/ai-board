# Tasks: Add Pricing Section to Landing Page

**Input**: Design documents from `/specs/AIB-277-add-pricing-section/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Included (requested in plan.md R8 and constitution check III).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup needed — existing project, no new dependencies, no schema changes.

*Phase skipped — all dependencies (shadcn/ui, lucide-react, TailwindCSS, Collapsible) already installed.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational work needed — no new DB models, no new API endpoints, no shared infrastructure. All components build on existing `PLANS` config and existing UI primitives.

*Phase skipped — PricingCard and PricingFAQ are independent leaf components with no shared prerequisites beyond what already exists.*

---

## Phase 3: User Story 1 — View Pricing Plans on Landing Page (Priority: P1) 🎯 MVP

**Goal**: Display three pricing cards (Free/Pro/Team) with correct data from `PLANS` config, positioned between WorkflowSection and CTASection on the landing page.

**Independent Test**: Load the landing page, verify three pricing cards are visible with correct plan names, prices, features, and CTA buttons linking to `/auth/signin`.

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T001 [P] [US1] Write component tests for PricingCard rendering (plan name, price formatting from cents, features list, CTA label/href, "Most Popular" badge for Pro) in tests/unit/components/pricing-section.test.tsx
- [ ] T002 [P] [US1] Write component tests for PricingSection rendering (three cards present with correct data sourced from PLANS, correct section heading, all CTAs link to /auth/signin) in tests/unit/components/pricing-section.test.tsx

### Implementation for User Story 1

- [ ] T003 [P] [US1] Create PricingCard server component in components/landing/pricing-card.tsx — accepts PricingCardProps (name, price in cents, features[], ctaLabel, ctaHref, isPopular?), renders shadcn Card with CardHeader/CardContent/CardFooter, Badge for "Most Popular", Button as Link to /auth/signin, Check icons for features, border-primary styling for Pro card
- [ ] T004 [US1] Create PricingSection server component in components/landing/pricing-section.tsx — imports PLANS from lib/billing/plans, maps to PricingCard components in a 3-column responsive grid (grid-cols-1 md:grid-cols-3), follows existing section pattern (<section> > container > max-w-7xl), includes heading "Simple, transparent pricing" and subheading
- [ ] T005 [US1] Add PricingSection to landing page in app/landing/page.tsx — import and insert between WorkflowSection and CTASection with id="pricing"

**Checkpoint**: Three pricing cards visible on landing page with correct data, all CTAs work. MVP complete.

---

## Phase 4: User Story 2 — View Pricing FAQ (Priority: P2)

**Goal**: Display a minimalist FAQ section below pricing cards with 4 expandable questions covering BYOK, supported AI agents, trial details, and plan switching.

**Independent Test**: Verify FAQ section renders below pricing cards with 4 questions, each expandable/collapsible via Collapsible component.

### Tests for User Story 2 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [US2] Write component tests for PricingFAQ (renders 4 FAQ questions, expand/collapse interaction via userEvent, correct answer content for BYOK and AI agents questions) in tests/unit/components/pricing-section.test.tsx

### Implementation for User Story 2

- [ ] T007 [US2] Create PricingFAQ client component in components/landing/pricing-faq.tsx — "use client" directive, static FAQItemData[] array with 4 items (BYOK explanation, supported AI agents Claude/Codex, 14-day trial details, plan switching), uses shadcn Collapsible/CollapsibleTrigger/CollapsibleContent, ChevronDown icon with rotation on expand
- [ ] T008 [US2] Integrate PricingFAQ into PricingSection in components/landing/pricing-section.tsx — render PricingFAQ below the pricing cards grid with "Frequently Asked Questions" heading

**Checkpoint**: FAQ visible and interactive below pricing cards. US1 + US2 both working.

---

## Phase 5: User Story 3 — Responsive Pricing Display (Priority: P2)

**Goal**: Pricing cards and FAQ adapt correctly across mobile (375px), tablet (768px), and desktop (1280px) viewports.

**Independent Test**: Resize browser to 375px, 768px, and 1280px widths — cards stack on mobile, 3-column grid on tablet+, no horizontal scrolling.

### Implementation for User Story 3

- [ ] T009 [US3] Verify and refine responsive layout in components/landing/pricing-card.tsx and components/landing/pricing-section.tsx — ensure grid-cols-1 md:grid-cols-3 works correctly, cards have min-width that prevents overflow on 375px, FAQ stacks properly on mobile, no hardcoded widths that break narrow viewports

**Checkpoint**: All three user stories complete. Pricing section fully functional and responsive.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T010 Run all component tests to verify they pass in tests/unit/components/pricing-section.test.tsx
- [ ] T011 Run type-check (bun run type-check) and lint (bun run lint) to ensure no errors
- [ ] T012 Visual review: verify semantic color tokens only (no hardcoded hex/rgb), WCAG AA contrast, dark theme consistency with existing landing page sections

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — no setup needed
- **Foundational (Phase 2)**: Skipped — no foundational work needed
- **User Story 1 (Phase 3)**: Can start immediately — no blockers
- **User Story 2 (Phase 4)**: Can start after T004 (PricingSection exists to integrate FAQ into)
- **User Story 3 (Phase 5)**: Can start after T003 + T004 (components exist to refine)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent — creates PricingCard, PricingSection, modifies landing page
- **User Story 2 (P2)**: Depends on US1's PricingSection (T004) to integrate FAQ component
- **User Story 3 (P2)**: Depends on US1's components (T003, T004) to refine responsive behavior

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Component creation before integration
- Integration into parent before page modification

### Parallel Opportunities

- T001 + T002: Both test files can be written in parallel (same file but independent test blocks)
- T003 (PricingCard) can run in parallel with T006 (FAQ tests) since they're different files
- US2 implementation (T007) can start in parallel with US1 once T004 is complete

---

## Parallel Example: User Story 1

```bash
# Launch tests in parallel:
Task: "T001 - Component tests for PricingCard in tests/unit/components/pricing-section.test.tsx"
Task: "T002 - Component tests for PricingSection in tests/unit/components/pricing-section.test.tsx"

# Then launch PricingCard component (independent file):
Task: "T003 - Create PricingCard in components/landing/pricing-card.tsx"

# Then sequential (depends on T003):
Task: "T004 - Create PricingSection in components/landing/pricing-section.tsx"
Task: "T005 - Add PricingSection to landing page in app/landing/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Write tests for US1 (T001, T002) — verify they fail
2. Implement PricingCard (T003) and PricingSection (T004)
3. Add to landing page (T005)
4. **STOP and VALIDATE**: Run tests, verify 3 cards with correct data
5. MVP deployable

### Incremental Delivery

1. US1 → Three pricing cards visible → Deploy/Demo (MVP!)
2. US2 → FAQ section added → Deploy/Demo
3. US3 → Responsive refinement → Deploy/Demo
4. Polish → Tests green, lint clean, visual review → Final

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All pricing data sourced from `lib/billing/plans.ts` — no hardcoded prices
- PricingCard and PricingSection are server components (zero client JS)
- PricingFAQ is a client component (Collapsible requires interactivity)
- No hardcoded hex/rgb colors — use semantic tokens only (text-foreground, bg-card, border-primary, etc.)
- Follow existing landing section pattern from research.md R4
