# Tasks: Marketing Landing Page

**Input**: Design documents from `/specs/040-landing-page-marketing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md (N/A), quickstart.md

**Tests**: E2E tests are included per constitution TDD requirement.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Exact file paths included in descriptions

## Path Conventions
- **Web app structure**: `app/`, `components/`, `lib/`, `tests/` at repository root
- Paths follow Next.js 15 App Router conventions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project structure and prepare for landing page development

- [X] T001 Verify Next.js 15 App Router structure exists (app/, components/, lib/ directories)
- [X] T002 [P] Verify all required dependencies installed (shadcn/ui, lucide-react, NextAuth.js, TailwindCSS)
- [X] T003 [P] Add smooth scroll CSS to app/globals.css (`html { scroll-behavior: smooth; }`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core routing logic that MUST be complete before ANY user story UI implementation

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete

- [X] T004 Search for existing landing/auth tests using grep/glob (per constitution Test Discovery Workflow)
- [X] T005 Modify app/page.tsx to check authentication with getServerSession() and conditionally render landing vs redirect to /projects
- [X] T006 Create app/landing/page.tsx as Server Component container for marketing sections
- [X] T007 Create components/landing/ directory for landing page components

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 4 - Authenticated User Redirection (Priority: P1) 🎯 MVP Core

**Goal**: Authenticated users automatically redirected to /projects without seeing landing page flash

**Independent Test**: Sign in, navigate to `/`, verify immediate redirect to `/projects` with no flash

### Tests for User Story 4

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US4] E2E test: authenticated user visits `/` and redirects to `/projects` in tests/e2e/landing-page.spec.ts
- [X] T009 [P] [US4] E2E test: authenticated user sees application header variant (not marketing header) in tests/e2e/landing-page.spec.ts

### Implementation for User Story 4

- [X] T010 [US4] Update components/layout/header.tsx to add marketing variant logic (check pathname === '/' && !session)
- [X] T011 [US4] Add navigation links (Features, Workflow) to marketing header variant in components/layout/header.tsx
- [X] T012 [US4] Replace UserMenu with "Sign In" button in marketing header variant in components/layout/header.tsx

**Checkpoint**: Authenticated users now properly redirected, header shows correct variant

---

## Phase 4: User Story 1 - Unauthenticated Visitor Discovery (Priority: P1) 🎯 MVP Content

**Goal**: Unauthenticated visitors see complete marketing landing page with hero, features, workflow, final CTA

**Independent Test**: Visit `/` logged out, scroll through all sections, verify content renders and CTAs visible

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] E2E test: unauthenticated visitor sees hero section with headline and CTAs in tests/e2e/landing-page.spec.ts
- [X] T014 [P] [US1] E2E test: unauthenticated visitor sees 6 feature cards in grid layout in tests/e2e/landing-page.spec.ts
- [X] T015 [P] [US1] E2E test: unauthenticated visitor sees workflow timeline with 5 stages in tests/e2e/landing-page.spec.ts
- [X] T016 [P] [US1] E2E test: unauthenticated visitor sees final CTA section at bottom in tests/e2e/landing-page.spec.ts

### Implementation for User Story 1

**Hero Section**:
- [X] T017 [P] [US1] Create components/landing/hero-section.tsx with gradient title, subheadline, CTA buttons (use shadcn/ui Button)
- [X] T018 [P] [US1] Add hero screenshot Next.js Image component with placeholder in components/landing/hero-section.tsx
- [X] T019 [P] [US1] Create placeholder image public/landing/hero-screenshot.png (can be replaced later)

**Features Grid**:
- [X] T020 [P] [US1] Create components/landing/feature-card.tsx reusable component with FeatureCardProps interface (icon: LucideIcon, iconColor, title, description)
- [X] T021 [US1] Create components/landing/features-grid.tsx with 6 feature cards using Sparkles, LayoutGrid, Github, Zap, Image, RefreshCw icons from lucide-react
- [X] T022 [US1] Apply Catppuccin Mocha accent colors to feature icons (violet, blue, green, yellow, pink, cyan) in components/landing/features-grid.tsx

**Workflow Visualization**:
- [X] T023 [P] [US1] Create components/landing/workflow-step.tsx with WorkflowStepProps interface (stage: 'INBOX'|'SPECIFY'|'PLAN'|'BUILD'|'VERIFY', title, description, isLast)
- [X] T024 [US1] Create components/landing/workflow-section.tsx with flexbox responsive timeline (vertical mobile, horizontal desktop)
- [X] T025 [US1] Apply workflow stage colors and visual connectors in components/landing/workflow-section.tsx

**Final CTA**:
- [X] T026 [P] [US1] Create components/landing/cta-section.tsx with gradient background and "Get Started Free" CTA

**Integration**:
- [X] T027 [US1] Integrate all sections into app/landing/page.tsx (Hero, Features, Workflow, Final CTA)

**Checkpoint**: User Story 1 complete - unauthenticated visitors can view full landing page

---

## Phase 5: User Story 2 - Primary CTA Conversion (Priority: P1) 🎯 MVP Conversion

**Goal**: CTAs redirect correctly ("Get Started Free" → /auth/signin, "View Demo" → demo or fallback)

**Independent Test**: Click each CTA button and verify navigation behavior

### Tests for User Story 2

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T028 [P] [US2] E2E test: clicking "Get Started Free" in hero redirects to `/auth/signin` in tests/e2e/landing-page.spec.ts
- [ ] T029 [P] [US2] E2E test: clicking "Get Started Free" in final CTA redirects to `/auth/signin` in tests/e2e/landing-page.spec.ts
- [ ] T030 [P] [US2] E2E test: clicking "View Demo" button handles navigation (demo or fallback) in tests/e2e/landing-page.spec.ts

### Implementation for User Story 2

- [X] T031 [US2] Add href="/auth/signin" to primary CTA buttons in components/landing/hero-section.tsx using Next.js Link
- [X] T032 [US2] Add href="/auth/signin" (fallback) or demo URL to secondary CTA in components/landing/hero-section.tsx
- [X] T033 [US2] Add href="/auth/signin" to final CTA button in components/landing/cta-section.tsx using Next.js Link
- [X] T034 [US2] Apply hover effects to CTA buttons (hover:scale-105 transform) in all CTA components

**Checkpoint**: All CTAs functional - visitors can start sign-up or view demo

---

## Phase 6: User Story 3 - Section Navigation (Priority: P2)

**Goal**: Header navigation links smoothly scroll to Features and Workflow sections

**Independent Test**: Click navigation links in header and verify smooth scroll to sections

### Tests for User Story 3

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T035 [P] [US3] E2E test: clicking "Features" link scrolls to features section in tests/e2e/landing-page.spec.ts
- [X] T036 [P] [US3] E2E test: clicking "Workflow" link scrolls to workflow section in tests/e2e/landing-page.spec.ts
- [X] T037 [P] [US3] E2E test: hovering over navigation links shows color transition in tests/e2e/landing-page.spec.ts

### Implementation for User Story 3

- [X] T038 [US3] Add id="features" to features grid section in components/landing/features-grid.tsx
- [X] T039 [US3] Add id="workflow" to workflow section in components/landing/workflow-section.tsx
- [X] T040 [US3] Update header navigation links to use anchor hrefs (#features, #workflow) in components/layout/header.tsx
- [X] T041 [US3] (Optional) Create lib/hooks/use-scroll-to-section.ts if JS scroll behavior needed for offset adjustment
- [X] T042 [US3] Apply hover transition styles to navigation links (transition-colors duration-200) in components/layout/header.tsx

**Checkpoint**: Navigation links functional - visitors can jump to specific sections

---

## Phase 7: User Story 5 - Responsive Mobile Experience (Priority: P2)

**Goal**: Landing page renders correctly on mobile (< 768px), tablet (768-1024px), desktop (> 1024px)

**Independent Test**: Open landing page at mobile viewport (375px), verify vertical stacking and readable text

### Tests for User Story 5

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T043 [P] [US5] E2E test: mobile viewport (< 768px) shows hero title scaled to text-6xl in tests/e2e/landing-page.spec.ts
- [X] T044 [P] [US5] E2E test: mobile viewport shows features grid in single column in tests/e2e/landing-page.spec.ts
- [X] T045 [P] [US5] E2E test: mobile viewport shows workflow timeline vertically in tests/e2e/landing-page.spec.ts
- [X] T046 [P] [US5] E2E test: mobile viewport CTA buttons meet 44x44px touch target size in tests/e2e/landing-page.spec.ts

### Implementation for User Story 5

- [X] T047 [US5] Apply responsive font sizing to hero title (text-6xl md:text-7xl lg:text-8xl) in components/landing/hero-section.tsx
- [X] T048 [US5] Apply responsive grid to features (grid-cols-1 md:grid-cols-2 lg:grid-cols-3) in components/landing/features-grid.tsx
- [X] T049 [US5] Apply responsive flex direction to workflow (flex-col md:flex-row) in components/landing/workflow-section.tsx
- [X] T050 [US5] Apply responsive padding to all sections (py-16 md:py-24 lg:py-32) across all landing page components
- [ ] T051 [US5] Test landing page at mobile (375px), tablet (768px), desktop (1440px) viewports manually

**Checkpoint**: Landing page fully responsive across all device sizes

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, performance optimization, final validation

- [ ] T052 [P] Run Lighthouse audit on landing page (target: Performance > 90, Accessibility > 95)
- [ ] T053 [P] Verify WCAG AA compliance: keyboard navigation works (Tab through CTAs), screen reader announces content
- [ ] T054 [P] Verify focus indicators visible on all interactive elements (buttons, links)
- [ ] T055 [P] Add alt text to hero screenshot image in components/landing/hero-section.tsx
- [ ] T056 [P] Test landing page with JavaScript disabled (should render with Server Components)
- [ ] T057 [P] Capture real kanban board screenshot and replace placeholder in public/landing/hero-screenshot.png (convert to WebP)
- [ ] T058 [P] Verify Cumulative Layout Shift (CLS) < 0.1 (no layout jumping during load)
- [ ] T059 [P] Verify First Contentful Paint (FCP) < 1.5s
- [ ] T060 Run quickstart.md validation: local dev setup, test landing page logged out/in, verify all scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 4 (Phase 3)**: Depends on Foundational (Phase 2) - Auth redirect must work before showing marketing page
- **User Story 1 (Phase 4)**: Depends on Foundational (Phase 2) - Can start after US4 or in parallel
- **User Story 2 (Phase 5)**: Depends on US1 (needs CTA buttons to exist) - Sequential dependency
- **User Story 3 (Phase 6)**: Depends on US1 (needs sections to exist) - Sequential dependency
- **User Story 5 (Phase 7)**: Depends on US1 (needs layout to exist) - Sequential dependency
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

**Critical Path** (must be sequential):
1. **Setup → Foundational → US4** (auth redirect foundation)
2. **US4 → US1** (need content before CTAs can work)
3. **US1 → US2** (need CTAs before testing clicks)
4. **US1 → US3** (need sections before navigation)
5. **US1 → US5** (need layout before responsive testing)

**Parallel Opportunities**:
- US3 and US5 can be worked on in parallel once US1 is complete
- All E2E tests within a user story marked [P] can run in parallel
- All component creation tasks marked [P] can run in parallel (different files)

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (Red-Green-Refactor)
2. Components before integration
3. Styles/effects before testing
4. Story complete before moving to next priority

---

## Parallel Example: User Story 1 Implementation

```bash
# Phase 1: Write all tests together (they should FAIL):
Task T013: "E2E test: hero section"
Task T014: "E2E test: features grid"
Task T015: "E2E test: workflow timeline"
Task T016: "E2E test: final CTA"

# Phase 2: Create all parallel components:
Task T017: "Create hero-section.tsx"
Task T018: "Add hero screenshot Image"
Task T019: "Create placeholder image"
Task T020: "Create feature-card.tsx"
Task T023: "Create workflow-step.tsx"
Task T026: "Create cta-section.tsx"

# Phase 3: Sequential integration tasks:
Task T021: "Create features-grid.tsx" (depends on T020)
Task T022: "Apply colors to features" (depends on T021)
Task T024: "Create workflow-section.tsx" (depends on T023)
Task T025: "Apply workflow styles" (depends on T024)
Task T027: "Integrate all sections" (depends on all above)

# Tests should now PASS (Green)
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup ✅
2. Complete Phase 2: Foundational ✅ (CRITICAL - blocks everything)
3. Complete Phase 3: User Story 4 (auth redirect) ✅
4. Complete Phase 4: User Story 1 (landing page content) ✅
5. Complete Phase 5: User Story 2 (CTAs functional) ✅
6. Complete Phase 6: User Story 3 (section navigation) ✅
7. **NEXT**: Phase 7: User Story 5 (responsive mobile)

**MVP Scope**: US4 + US1 + US2 = Authenticated redirect + Full landing page + Functional CTAs
**P2 Features (Post-MVP)**: US3 (navigation) ✅ + US5 (responsive) = Enhanced UX

### Incremental Delivery

1. MVP (US4+US1+US2) → Test independently → Deploy 🎯
2. Add US3 (navigation) → Test independently → Deploy
3. Add US5 (responsive) → Test independently → Deploy
4. Polish phase → Final validation → Production release

### Parallel Team Strategy

With 2 developers:

1. Both complete Setup + Foundational together (blocking work)
2. Both complete US4 together (auth redirect, blocking)
3. Once US4 done:
   - **Developer A**: US1 (landing page content) - blocks others
   - **Developer B**: Prepare tests for US2, US3, US5
4. Once US1 done:
   - **Developer A**: US2 (CTAs)
   - **Developer B**: US3 (navigation)
5. Once US2 done:
   - **Developer A**: Polish phase
   - **Developer B**: US5 (responsive)

---

## Task Summary

**Total Tasks**: 60
**Setup**: 3 tasks ✅
**Foundational**: 4 tasks ✅
**User Story 4 (P1)**: 5 tasks (2 tests + 3 implementation) ✅
**User Story 1 (P1)**: 15 tasks (4 tests + 11 implementation) ✅
**User Story 2 (P1)**: 7 tasks (3 tests + 4 implementation) - 4/7 ✅
**User Story 3 (P2)**: 8 tasks (3 tests + 5 implementation) ✅
**User Story 5 (P2)**: 9 tasks (4 tests + 5 implementation) - 8/9 ✅
**Polish**: 9 tasks - 0/9 ⏳

**Completed**: 47/60 tasks (78%)
**Remaining**: 13 tasks (3 MVP tests + 1 manual test + 9 polish)
**MVP Progress**: 31/34 tasks (91%) - Missing 3 CTA click tests
**Post-MVP Progress**: 16/26 tasks (62%) - US3 ✅, US5 nearly complete (1 manual test), Polish remaining

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story (US1-US5) for traceability
- Each user story independently completable and testable
- Constitution requires TDD: write E2E tests first, verify they fail, implement, verify they pass
- Search for existing tests before creating new files (grep/glob per constitution)
- Commit after each task or logical group
- Stop at checkpoints to validate story independently
- MVP = US4 + US1 + US2 (authenticated redirect + landing content + functional CTAs)
