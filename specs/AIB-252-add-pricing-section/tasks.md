# Tasks: Add Pricing Section to Landing Page & Footer

**Input**: Design documents from `/specs/AIB-252-add-pricing-section/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Included — plan.md Phase 6 and Constitution III require component tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed — this feature adds to an existing Next.js app with all dependencies already installed.

_No tasks required — all dependencies (shadcn/ui Card/Button, Collapsible, lucide-react) are already available._

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Header navigation update that enables anchor linking to pricing section across all stories

**⚠️ CRITICAL**: Header nav must be in place before pricing section is added to ensure `#pricing` anchor works

- [ ] T001 Add "Pricing" anchor link (`#pricing`) to marketing navigation in `components/layout/header.tsx`, following existing "Features" and "Workflow" link pattern
- [ ] T002 Add "Pricing" anchor link to mobile menu in `components/layout/mobile-menu.tsx` if marketing links are duplicated there

**Checkpoint**: Header navigation updated — pricing section can now be linked to from nav

---

## Phase 3: User Story 1 — View and Compare Pricing Plans (Priority: P1) 🎯 MVP

**Goal**: Visitors see a pricing section with three plan cards (Free, Pro, Team) displaying names, prices, features, and CTAs side by side on desktop or stacked on mobile.

**Independent Test**: Navigate to landing page, scroll to pricing section, verify three plan cards display correct names, prices, feature lists, and CTA buttons. Pro card shows "Most Popular" badge.

### Implementation for User Story 1

- [ ] T003 [US1] Create `components/landing/pricing-section.tsx` as Server Component with `id="pricing"`, section title "Simple, Transparent Pricing", subtitle "Choose the plan that fits your team", static plan data array (Free/$0, Pro/$15, Team/$30) with feature lists from data-model.md, responsive grid (`grid-cols-1 md:grid-cols-3`), plan cards using shadcn/ui Card with plan name, price, Check icon feature list, Pro card "Most Popular" badge with `border-[#8B5CF6]` highlight, dark theme Catppuccin Mocha styling (card bg `#181825`, border `#313244`)
- [ ] T004 [US1] Import and render `PricingSection` in `app/landing/page.tsx` between `WorkflowSection` and `CTASection`

**Checkpoint**: Pricing section visible on landing page with 3 plan cards — US1 independently testable

---

## Phase 4: User Story 2 — Click Pricing CTA to Sign Up or Start Trial (Priority: P1)

**Goal**: Each plan card has a functional CTA button: Free shows "Get Started", Pro/Team show "Start 14-day trial", all linking to `/auth/signin`.

**Independent Test**: Click each plan's CTA button and verify navigation to `/auth/signin`.

### Implementation for User Story 2

- [ ] T005 [US2] Verify and refine CTA buttons in `components/landing/pricing-section.tsx`: Free plan CTA text "Get Started", Pro/Team CTA text "Start 14-day trial", all buttons link to `/auth/signin` via Next.js Link or anchor, shadcn/ui Button styling consistent with landing page

**Checkpoint**: All CTA buttons navigate to sign-up page — US2 independently testable

---

## Phase 5: User Story 3 — Read Pricing FAQ (Priority: P2)

**Goal**: Below the pricing cards, a FAQ subsection with 2 collapsible questions about BYOK and supported agents.

**Independent Test**: Scroll below pricing cards, verify 2 FAQ questions visible, click each to expand/collapse answers.

### Implementation for User Story 3

- [ ] T006 [US3] Create FAQ subsection as Client Component (`'use client'`) either within `components/landing/pricing-section.tsx` or as separate `components/landing/faq-section.tsx`, using existing `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `components/ui/collapsible.tsx`, with 2 FAQ items: (1) "What does BYOK (Bring Your Own Key) mean?" with answer about Free plan requiring own API key, (2) "Which AI agents and models are supported?" with answer about Claude/Anthropic, ChevronDown icon with rotation animation on expand, heading "Frequently Asked Questions"
- [ ] T007 [US3] Integrate FAQ subsection into pricing section render in `components/landing/pricing-section.tsx` (if created as separate component, import and render below plan cards grid)

**Checkpoint**: FAQ section renders below pricing cards with expand/collapse — US3 independently testable

---

## Phase 6: User Story 4 — See Footer on Public Pages (Priority: P2)

**Goal**: Footer displays GitHub repository link alongside existing Terms/Privacy links and copyright.

**Independent Test**: Scroll to bottom of landing page, verify GitHub link present with correct attributes; verify footer visible on legal pages.

### Implementation for User Story 4

- [ ] T008 [P] [US4] Add GitHub repository link (`https://github.com/bfernandez31/ai-board`) to existing `<nav>` in `components/layout/footer.tsx` with `target="_blank"`, `rel="noopener noreferrer"`, same styling as existing links (`text-sm text-[hsl(var(--ctp-subtext-0))] hover:text-[#8B5CF6] transition-colors`)

**Checkpoint**: Footer shows GitHub link on all public pages — US4 independently testable

---

## Phase 7: User Story 5 — Responsive Pricing Display (Priority: P2)

**Goal**: Pricing cards stack vertically on mobile, FAQ and footer adapt to smaller screens.

**Independent Test**: View landing page at mobile viewport widths (<768px), verify cards stack vertically, text readable, no horizontal scrolling.

### Implementation for User Story 5

- [ ] T009 [US5] Review and verify responsive layout in `components/landing/pricing-section.tsx`: confirm `grid-cols-1 md:grid-cols-3` grid, FAQ section width constraints, ensure all text/buttons are fully visible at 320px viewport, verify footer link wrapping in `components/layout/footer.tsx` at mobile widths — fix any responsive issues found

**Checkpoint**: All components display correctly across viewport sizes — US5 independently testable

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Component tests per Constitution III, final validation

### Tests

- [ ] T010 [P] Create component test for PricingSection in `tests/unit/components/pricing-section.test.tsx`: renders 3 plan cards with correct names (Free, Pro, Team) and prices ($0, $15, $30), Pro card displays "Most Popular" badge, CTA buttons show correct text ("Get Started" vs "Start 14-day trial"), CTA buttons link to `/auth/signin`, FAQ items render with questions visible, FAQ expand/collapse on click
- [ ] T011 [P] Add GitHub link test to `tests/unit/components/footer.test.tsx`: verify GitHub link rendered with correct href, `target="_blank"`, and `rel="noopener noreferrer"` attributes

### Final Validation

- [ ] T012 Run `bun run type-check` and `bun run lint` to verify no TypeScript or ESLint errors across all changed files
- [ ] T013 Run quickstart.md validation — verify implementation order matches quickstart.md and all key files are created/modified as specified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — no setup needed
- **Foundational (Phase 2)**: No dependencies — can start immediately
- **User Stories (Phase 3+)**: All depend on Phase 2 completion
  - US1 (Phase 3): Creates the core pricing component — must complete before US2, US3, US5
  - US2 (Phase 4): Depends on US1 (refines CTAs in same component)
  - US3 (Phase 5): Depends on US1 (adds FAQ below pricing cards)
  - US4 (Phase 6): Independent — can run in parallel with US1/US2/US3
  - US5 (Phase 7): Depends on US1, US3, US4 (verifies responsive across all components)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Depends on US1 (same component file)
- **US3 (P2)**: Depends on US1 (pricing section must exist to add FAQ below)
- **US4 (P2)**: Independent — different file (`footer.tsx`), can run in parallel with all others
- **US5 (P2)**: Depends on US1, US3, US4 (responsive verification of all components)

### Within Each User Story

- Core implementation before integration
- Story complete before moving to next priority
- US4 (footer) can run in parallel with US1-US3 since it modifies a different file

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T008 (US4 footer) can run in parallel with T003-T007 (US1-US3 pricing)
- T010 and T011 (tests) can run in parallel (different test files)

---

## Parallel Example: User Story 1 + User Story 4

```bash
# These can run in parallel since they modify different files:
Task: "T003 [US1] Create pricing-section.tsx"
Task: "T008 [US4] Add GitHub link to footer.tsx"

# Tests can run in parallel:
Task: "T010 Create pricing-section.test.tsx"
Task: "T011 Add GitHub link test to footer.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Header navigation update
2. Complete Phase 3: Pricing section with 3 plan cards
3. **STOP and VALIDATE**: Pricing cards visible on landing page with correct data
4. Deploy/demo if ready — visitors can see and compare plans

### Incremental Delivery

1. Complete Phase 2 (Foundational) → Header nav ready
2. Add US1 (Pricing cards) → Test independently → MVP!
3. Add US2 (CTA refinement) → Test independently → Conversion ready
4. Add US3 (FAQ) → Test independently → Objection handling
5. Add US4 (Footer) → Test independently → Trust building
6. Add US5 (Responsive) → Test independently → Mobile ready
7. Polish → Tests pass, lint/type-check clean → Ship ready

### Parallel Execution Strategy

1. Complete Phase 2 sequentially
2. Once Phase 2 is done:
   - Parallel track A: US1 → US2 → US3 → US5 (pricing section chain)
   - Parallel track B: US4 (footer — fully independent)
3. Phase 8 (tests + validation) after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All plan data is static (not fetched from API) per research.md R2
- FAQ uses existing Collapsible component per research.md R3
- All CTAs link to `/auth/signin` per research.md R6
- No new npm packages, no database changes, no API changes
- Reference `lib/billing/plans.ts` as source of truth for plan pricing in code comments
