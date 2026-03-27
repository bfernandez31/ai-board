# Tasks: Modernize Comparison Dashboard Visual Design

**Input**: Design documents from `/specs/AIB-361-modernize-comparison-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — plan.md testing strategy specifies component and unit tests for visual changes.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — create the shared accent color utility that all components depend on

- [ ] T001 Create accent color utility with `getAccentColorByRank()` function and `AccentColorSet` type in `lib/comparison/accent-colors.ts` — static lookup mapping ranks 1-6 to complete Tailwind class string sets (text, bgSubtle, bgMedium, border, ring, shadow, hsl, label) per research.md and data-model.md
- [ ] T002 Create unit tests for accent color utility in `tests/unit/comparison/accent-colors.test.ts` — verify all 6 ranks return correct class strings, fallback for out-of-range ranks, and type correctness

**Checkpoint**: Accent color utility ready — all component phases can now begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Apply glassmorphism base styling and spacing to the comparison viewer container — MUST be complete before user story components are modified

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Apply glassmorphism base styling to section containers in `components/comparison/comparison-viewer.tsx` — `bg-ctp-surface0/[0.04]` background, `border border-ctp-overlay0/10` borders, increased `p-6` padding and `gap-6` between sections, uppercase tracking on section labels

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Viewing a Comparison with Clear Winner (Priority: P1) 🎯 MVP

**Goal**: Make the winning ticket immediately visually prominent through a hero card with gradient background, glowing score gauge, and bold WINNER badge

**Independent Test**: Open any comparison with a declared winner and verify the hero card has gradient background, SVG gauge with glow, gradient WINNER badge, and colored differentiator pills

### Tests for User Story 1 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T004 [P] [US1] Update component tests in `tests/unit/components/score-gauge.test.tsx` — verify SVG `<defs>` with `<linearGradient>` and `<feDropShadow>` filter elements are rendered, gradient stroke applied to score arc
- [ ] T005 [P] [US1] Update component tests in `tests/unit/components/comparison-hero-card.test.tsx` — verify gradient winner badge rendering, glow orb element, bordered recommendation container, and colored differentiator pills

### Implementation for User Story 1

- [ ] T006 [P] [US1] Enhance score gauge with SVG gradient stroke and glow in `components/comparison/score-gauge.tsx` — add `<defs>` with `<linearGradient>` using accent color HSL stops, add `<filter>` with `<feDropShadow>` for glow effect, apply gradient as `stroke="url(#gradient-id)"` and filter to score arc circle
- [ ] T007 [US1] Modernize hero card in `components/comparison/comparison-hero-card.tsx` — gradient background with winner accent color at 12% opacity, radial glow orb (absolute positioned div with `bg-ctp-green/10 rounded-full blur-3xl`), gradient winner badge pill, bordered recommendation container, colored differentiator pills with semi-transparent backgrounds

**Checkpoint**: User Story 1 complete — winner hero card is visually prominent with gradient, glow, and badge

---

## Phase 4: User Story 2 - Distinguishing Participants by Color Identity (Priority: P1)

**Goal**: Each participant has a unique, consistent color identity applied across their participant card, score gauge, and rank badge

**Independent Test**: Open a comparison with 3+ participants and verify each has a distinct accent color on their participant card (background tint, border, mini score ring, rank badge)

### Implementation for User Story 2

- [ ] T008 [US2] Apply per-participant accent colors to participant grid in `components/comparison/comparison-participant-grid.tsx` — use `getAccentColorByRank()` to apply each participant's accent color to card background tint, border, mini score ring stroke color, and rank badge background

**Checkpoint**: User Story 2 complete — each participant has a unique color identity across their card

---

## Phase 5: User Story 3 - Analyzing Decision Points with Visual Hierarchy (Priority: P2)

**Goal**: Decision points render as distinct styled cards with colored backgrounds, glowing dots, and verdict pill badges

**Independent Test**: Expand decision points in any comparison and verify each has colored card background matching verdict winner, glowing dot, and verdict pill badge

### Tests for User Story 3 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [P] [US3] Update component tests in `tests/unit/components/comparison-decision-points.test.tsx` — verify verdict pill badge rendering, glowing dot box-shadow classes, and individual card styling per decision point

### Implementation for User Story 3

- [ ] T010 [US3] Enhance decision points in `components/comparison/comparison-decision-points.tsx` — render each decision point as an individual card with verdict winner's accent color background tint, replace plain dots with glowing dots using colored box-shadow from `AccentColorSet.shadow`, add colored verdict pill badge on right side

**Checkpoint**: User Story 3 complete — decision points have clear visual hierarchy with colored cards and verdict pills

---

## Phase 6: User Story 4 - Comparing Metrics Across Participants (Priority: P2)

**Goal**: Metrics section displays color-coded gradient bars per participant with a color legend and winner highlighting

**Independent Test**: View the metrics section of any multi-participant comparison and verify gradient bars, color legend, and bold winner values

### Tests for User Story 4 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T011 [P] [US4] Update component tests in `tests/unit/components/comparison-unified-metrics.test.tsx` — verify color legend rendering with participant names and colors, gradient bar elements per participant, and winner value bold + accent color styling

### Implementation for User Story 4

- [ ] T012 [US4] Upgrade unified metrics in `components/comparison/comparison-unified-metrics.tsx` — add color legend header mapping each participant to their accent color, replace flat bars with gradient bars (solid accent color to transparent) per participant, highlight winner values in bold with their accent color text class

**Checkpoint**: User Story 4 complete — metrics are color-coded with legend and winner highlighting

---

## Phase 7: User Story 5 - Reviewing Stat Cards with Color Themes (Priority: P2)

**Goal**: Each stat card has its own color theme (yellow/blue/green/purple) for quick visual scanning

**Independent Test**: View stat cards in any comparison and verify each has a unique color theme applied to label, bar, background, and border

### Tests for User Story 5 ⚠️

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US5] Update component tests in `tests/unit/components/comparison-stat-cards.test.tsx` — verify per-card color themes (Cost=yellow, Duration=blue, Quality=green, Files=purple), score value font styling (18px, font-weight 800)

### Implementation for User Story 5

- [ ] T014 [US5] Apply color themes to stat cards in `components/comparison/comparison-stat-cards.tsx` — define `StatCardTheme` mapping (Cost→ctp-yellow, Duration→ctp-blue, Quality→ctp-green, Files→ctp-mauve) with text, bgSubtle, border, barGradient classes; apply to label text, progress bar gradient fill, background tint, and border; update score values to `text-lg font-extrabold tracking-tight`

**Checkpoint**: User Story 5 complete — stat cards are visually distinct by category color

---

## Phase 8: User Story 6 - Viewing Compliance Heatmap with Status Colors (Priority: P3)

**Goal**: Compliance heatmap cells use subtle colored backgrounds for pass/fail/mixed status

**Independent Test**: View a comparison with compliance data and verify cells have colored backgrounds (green=pass, red=fail, yellow=mixed)

### Implementation for User Story 6

- [ ] T015 [US6] Enhance compliance heatmap cell backgrounds in `components/comparison/comparison-compliance-heatmap.tsx` — ensure consistent subtle colored backgrounds for pass (`bg-ctp-green/10`), fail (`bg-ctp-red/10`), and mixed (`bg-ctp-yellow/10`) cells with uniform opacity levels
- [ ] T016 [US6] Verify existing tests still pass in `tests/unit/components/comparison-compliance-heatmap.test.tsx` — run existing test suite and confirm zero regressions from heatmap color changes

**Checkpoint**: User Story 6 complete — compliance heatmap has clear status-colored cells

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, edge case validation, and regression testing

- [ ] T017 Run full unit test suite via `bun run test:unit` and fix any regressions across all comparison components
- [ ] T018 Run `bun run type-check` and fix any TypeScript errors
- [ ] T019 Run `bun run lint` and fix any linting violations
- [ ] T020 Run quickstart.md validation — verify all 10 implementation steps are satisfied and verify commands pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Phase 1 (accent color utility) and Phase 2 (glassmorphism base)
  - US1 and US2 (both P1) can proceed in parallel after Phase 2
  - US3, US4, US5 (all P2) can proceed in parallel after Phase 2
  - US6 (P3) can proceed after Phase 2
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **User Story 2 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **User Story 3 (P2)**: Can start after Phase 2 — uses accent colors from US2's mapping but only needs the utility (Phase 1), not the participant grid
- **User Story 4 (P2)**: Can start after Phase 2 — uses accent colors, independent of other stories
- **User Story 5 (P2)**: Can start after Phase 2 — uses independent stat card themes, no cross-story deps
- **User Story 6 (P3)**: Can start after Phase 2 — uses fixed pass/fail colors, no accent color dependency

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Implementation applies visual changes to existing components
- Verify with component-specific test run after implementation

### Parallel Opportunities

- T001 and T002 (Setup): Sequential (T002 tests T001)
- T004 and T005 (US1 tests): Can run in parallel
- T006 and T007 (US1 implementation): T006 parallel-eligible (different file), T007 depends on T006 for score gauge in hero
- T008 (US2), T010 (US3), T012 (US4), T014 (US5), T015 (US6): All can run in parallel (different files)
- T009, T011, T013 (US3/US4/US5 tests): All can run in parallel

---

## Parallel Example: User Stories 3-5

```bash
# Launch all P2 story tests in parallel:
Task: "Update decision points tests in tests/unit/components/comparison-decision-points.test.tsx"
Task: "Update unified metrics tests in tests/unit/components/comparison-unified-metrics.test.tsx"
Task: "Update stat cards tests in tests/unit/components/comparison-stat-cards.test.tsx"

# Then launch all P2 story implementations in parallel (different files):
Task: "Enhance decision points in components/comparison/comparison-decision-points.tsx"
Task: "Upgrade unified metrics in components/comparison/comparison-unified-metrics.tsx"
Task: "Apply color themes to stat cards in components/comparison/comparison-stat-cards.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (accent color utility)
2. Complete Phase 2: Foundational (glassmorphism base)
3. Complete Phase 3: User Story 1 (hero card + score gauge)
4. Complete Phase 4: User Story 2 (participant color identity)
5. **STOP and VALIDATE**: Test US1 + US2 independently — winner is visually prominent and all participants have color identity
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Color system and glassmorphism base ready
2. Add US1 + US2 → Test independently → Deploy/Demo (MVP!)
3. Add US3 + US4 + US5 → Test independently → Deploy/Demo (full color-coded comparison)
4. Add US6 → Test independently → Deploy/Demo (complete visual modernization)
5. Polish → Final verification and cleanup

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially (T001 → T002 → T003)
2. Once Phase 2 is done, all user stories can run in parallel:
   - Parallel task 1: User Story 1 (hero card + score gauge)
   - Parallel task 2: User Story 2 (participant grid colors)
   - Parallel task 3: User Story 3 (decision points)
   - Parallel task 4: User Story 4 (unified metrics)
   - Parallel task 5: User Story 5 (stat cards)
   - Parallel task 6: User Story 6 (compliance heatmap)
3. Stories complete and integrate independently — each modifies a different component file

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story modifies a single component file — natural parallelism
- All colors use Tailwind semantic tokens from Catppuccin palette (no hardcoded hex/rgb)
- All Tailwind classes must be complete static strings (never dynamically constructed)
- No prop or component hierarchy changes — visual-only modifications
- SVG gradient `<stop>` elements may use `hsl(var(--ctp-*))` — acceptable exception per spec
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
