# Tasks: Display Health Score Heart Indicator on Project Cards

**Input**: Design documents from `/specs/AIB-546-display-health-score/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed — this feature extends existing code. No database migrations, no new dependencies.

_(No setup tasks — all infrastructure already exists)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the data layer so health score data flows through the project list pipeline. MUST be complete before UI work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 Extend Prisma query to include `healthScore` relation in `getUserProjects()` in `lib/db/projects.ts`
- [x] T002 Add `healthScore` field to `ProjectWithCount` interface in `app/lib/types/project.ts`
- [x] T003 Map `healthScore` from Prisma result to response shape in server component `app/projects/page.tsx`
- [x] T004 Map `healthScore` from Prisma result to response shape in API route `app/api/projects/route.ts`

**Checkpoint**: Foundation ready — health score data is available in the project list response. User story implementation can now begin.

---

## Phase 3: User Story 1 — View Health Score at a Glance on Project Cards (Priority: P1) MVP

**Goal**: Each project card displays a colored heart indicator with the global health score (0-100) or a greyed-out dash for never-scanned projects.

**Independent Test**: Navigate to the projects page and verify each card displays the correct heart color, score, and glow effect based on stored health data.

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): No existing test file covers project card health display. New test files are justified (confirmed via research.md Existing Test Files inventory).**

- [x] T005 [P] [US1] Create unit tests for HealthScoreHeart component in `tests/unit/components/health-score-heart.test.tsx` — test cases: green heart (score 95), blue heart (score 75), yellow heart (score 55), red heart (score 30), red heart (score 0 — edge case, not no-data), greyed-out heart with dash (null healthScore), greyed-out heart with dash (healthScore with null globalScore), click stopPropagation
- [x] T006 [P] [US1] Create integration test for projects API with health score in `tests/integration/projects/projects-with-health.test.ts` — test cases: GET `/api/projects` includes `healthScore` for projects with health data, returns `healthScore: null` for projects without, all 7 score fields correctly serialized

### Implementation for User Story 1

- [x] T007 [US1] Create `HealthScoreHeart` component in `components/projects/health-score-heart.tsx` — SVG heart shape, score text centered inside, color based on thresholds from `getScoreColorConfig()` in `lib/health/score-calculator.ts`, colored drop-shadow glow, no-data state (muted fill, em-dash, no glow), `onClick` calls `stopPropagation()` (FR-009, FR-012)
- [x] T008 [US1] Integrate `HealthScoreHeart` into project card header in `components/projects/project-card.tsx` — position between project title and project menu in CardHeader flex container

**Checkpoint**: User Story 1 complete — all project cards show colored heart indicators with correct scores and glow effects.

---

## Phase 4: User Story 2 — View Health Sub-Scores via Hover Popover (Priority: P2)

**Goal**: Hovering over the heart indicator reveals a compact popover showing all 6 health sub-scores with per-score color coding.

**Independent Test**: Hover over a heart indicator and verify the popover displays the correct sub-score names, values, and colors.

### Tests for User Story 2
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [US2] Extend unit tests in `tests/unit/components/health-score-heart.test.tsx` — add test cases: popover displays all 6 sub-scores with correct colors on hover (userEvent.hover), popover shows dashes for null sub-scores, popover dismisses on mouse leave, popover is informational only (no links or buttons)

### Implementation for User Story 2

- [x] T010 [US2] Add hover popover to `HealthScoreHeart` component in `components/projects/health-score-heart.tsx` — use `Popover`/`PopoverTrigger`/`PopoverContent` from `components/ui/popover.tsx`, trigger on hover via mouse event handlers, display "Health Breakdown" title and 6 rows (Security, Compliance, Tests, Spec Sync, Quality Gate, Review Quality) each with label, score value or dash, and threshold color via `getScoreColorConfig()`, no links or buttons (FR-008)

**Checkpoint**: User Story 2 complete — hovering any heart shows the 6-score breakdown popover.

---

## Phase 5: User Story 3 — Health Data Loads Efficiently with Project List (Priority: P3)

**Goal**: Verify that health score data loads in the same request as project data — no per-card requests, no loading states on hearts.

**Independent Test**: Monitor network requests during dashboard load and confirm only one project list request includes health data.

### Tests for User Story 3

- [x] T011 [US3] Extend integration tests in `tests/integration/projects/projects-with-health.test.ts` — add test case: single GET `/api/projects` request returns health scores for all projects (verify response shape includes healthScore for every project in list, no separate health endpoint called)

### Implementation for User Story 3

_(No additional implementation — this story is satisfied by the data layer work in Phase 2 (T001-T004). The integration test in T011 validates the efficiency requirement.)_

**Checkpoint**: User Story 3 verified — health data loads efficiently with the project list.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases and responsive behavior validation

- [x] T012 Verify responsive behavior of heart indicator in `components/projects/health-score-heart.tsx` — ensure heart is visible and properly positioned on mobile (320px), tablet, and desktop viewports without overlapping card content (FR-011)
- [x] T013 Run full test suite (`bun run test:unit` and `bun run test:integration`) to confirm no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — can start immediately. BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion (T001-T004)
- **User Story 2 (Phase 4)**: Depends on Phase 3 completion (extends the HealthScoreHeart component from T007)
- **User Story 3 (Phase 5)**: Depends on Phase 2 completion (validates data layer). Can run in parallel with US1/US2.
- **Polish (Phase 6)**: Depends on Phases 3-5 completion

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2) only
- **User Story 2 (P2)**: Depends on User Story 1 (extends same component with popover)
- **User Story 3 (P3)**: Depends on Foundational (Phase 2) only — can run in parallel with US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Component creation before integration
- Core rendering before hover behavior

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003 and T004 can run in parallel (different files)
- T005 and T006 can run in parallel (different files, different test types)
- T007 and T011 can run in parallel (different files, US1 impl vs US3 test)

---

## Parallel Example: Foundational Phase

```
# Launch data layer changes in parallel:
Task T001: "Extend Prisma query in lib/db/projects.ts"
Task T002: "Add healthScore to ProjectWithCount in app/lib/types/project.ts"

# Then launch response mappers in parallel:
Task T003: "Map healthScore in app/projects/page.tsx"
Task T004: "Map healthScore in app/api/projects/route.ts"
```

## Parallel Example: User Story 1 Tests

```
# Launch both test files in parallel:
Task T005: "Unit tests for HealthScoreHeart in tests/unit/components/health-score-heart.test.tsx"
Task T006: "Integration test for projects API in tests/integration/projects/projects-with-health.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (data layer — T001-T004)
2. Complete Phase 3: User Story 1 (heart indicator — T005-T008)
3. **STOP and VALIDATE**: Test User Story 1 independently
4. Deploy/demo if ready

### Incremental Delivery

1. Phase 2 → Foundation ready (health data in project list)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (popover)
4. Validate User Story 3 → Confirm efficiency → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database migrations needed — HealthScore model already exists
- No new dependencies — all UI primitives (Popover, SVG) available
- Color utilities reused from `lib/health/score-calculator.ts` and `lib/quality-score.ts`
- New test files justified — no existing tests cover project card health display (verified against research.md inventory)
