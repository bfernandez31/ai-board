# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `/specs/AIB-644-activity-heatmap-on/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/projects-activity-heatmap.yaml`

**Tests**: Test tasks are included by default per constitution requirements.

**Organization**: Tasks are grouped by user story so each increment remains independently testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared contracts and cache keys used across the feature.

- [ ] T001 [P] Create shared heatmap response and filter types in `lib/projects/activity-heatmap-types.ts`
- [ ] T002 [P] Extend workspace query-key coverage for the new heatmap cache entry in `tests/unit/query-keys.test.ts`
- [ ] T003 Add workspace activity heatmap query keys in `app/lib/query-keys.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared data access and page bootstrap required before any story-specific UI behavior.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [ ] T004 [P] Implement the shared workspace aggregation primitives for authorized project scope, year-range generation, and empty-day scaffolding in `lib/projects/activity-heatmap.ts`
- [ ] T005 [P] Add the authenticated `GET /api/projects/activity` skeleton with Zod query parsing and structured error handling in `app/api/projects/activity/route.ts`
- [ ] T006 Refactor the projects grid wrapper to remove the internal scroll trap in `components/projects/projects-container.tsx`
- [ ] T007 Update the `/projects` server page bootstrap to load initial workspace heatmap data alongside project cards in `app/projects/page.tsx`

**Checkpoint**: Shared types, route scaffolding, and page/layout bootstrap are ready for story work.

---

## Phase 3: User Story 1 - Scan Workspace Activity Trends (Priority: P1) 🎯 MVP

**Goal**: Show a full-width yearly workspace activity heatmap with totals and legend below the projects grid.

**Independent Test**: Load `/projects` with seeded cross-project job and shipped-ticket history and verify the page renders a full-year grid, summary totals, month/day labels, legend, and zero-activity days without any filter interaction.

### Tests for User Story 1

- [ ] T008 [P] [US1] Create contract-aligned workspace aggregate coverage for rolling-year totals, shared-project visibility, and zero-activity grids in `tests/integration/projects/activity-heatmap.test.ts`
- [ ] T009 [P] [US1] Create component coverage for the yearly grid, summary header, legend, and empty-day rendering in `tests/unit/components/projects/projects-activity-heatmap.test.tsx`

### Implementation for User Story 1

- [ ] T010 [US1] Complete the workspace aggregation logic for daily job counts, shipped-ticket totals, recorded cost sums, and intensity buckets in `lib/projects/activity-heatmap.ts`
- [ ] T011 [US1] Return the initial heatmap payload from `GET /api/projects/activity` using the shared response types in `app/api/projects/activity/route.ts`
- [ ] T012 [US1] Build the base heatmap section with summary copy, month/day labels, legend, and full-year cell grid in `components/projects/projects-activity-heatmap.tsx`
- [ ] T013 [US1] Render the new heatmap section below the project cards using server-loaded initial data in `app/projects/page.tsx`

**Checkpoint**: User Story 1 is fully functional and testable as the MVP.

---

## Phase 4: User Story 2 - Inspect Daily Activity Details (Priority: P2)

**Goal**: Let users inspect per-day job, shipped-ticket, and cost details from each heatmap cell.

**Independent Test**: Focus or hover a populated and an empty day cell on `/projects` and verify the tooltip shows the correct formatted date plus `jobs`, `tickets shipped`, and `cost` values for that day.

### Tests for User Story 2

- [ ] T014 [P] [US2] Extend daily aggregate assertions for per-day job, shipped-ticket, and cost payloads in `tests/integration/projects/activity-heatmap.test.ts`
- [ ] T015 [P] [US2] Extend component coverage for hover and keyboard-focus tooltip behavior on populated and empty cells in `tests/unit/components/projects/projects-activity-heatmap.test.tsx`

### Implementation for User Story 2

- [ ] T016 [US2] Extend the daily aggregate payload with tooltip-ready metrics and formatted day metadata in `lib/projects/activity-heatmap.ts`
- [ ] T017 [US2] Add accessible tooltip triggers, focus styles, and daily detail content to each heatmap cell in `components/projects/projects-activity-heatmap.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently, with inspectable daily detail.

---

## Phase 5: User Story 3 - Change Time Range and Agent Scope (Priority: P3)

**Goal**: Support rolling vs calendar-year views, agent filtering, and mobile-safe inspection without breaking page scroll.

**Independent Test**: Change the year selector and agent filter on `/projects`, verify the grid remains full-year while totals, legend, and tooltips update to the selected scope, then confirm mobile viewport scrolling and day inspection still work.

### Tests for User Story 3

- [ ] T018 [P] [US3] Extend route coverage for `view` and `agent` query handling, available options, filtered shipped-ticket counts, and empty-scope responses in `tests/integration/projects/activity-heatmap.test.ts`
- [ ] T019 [P] [US3] Extend component coverage for year selection, agent filtering, refetch state, and no-activity messaging in `tests/unit/components/projects/projects-activity-heatmap.test.tsx`
- [ ] T020 [P] [US3] Create mobile scroll and day-inspection browser coverage for `/projects` in `tests/e2e/projects-activity-heatmap.spec.ts`

### Implementation for User Story 3

- [ ] T021 [US3] Add rolling-vs-calendar year options, effective-agent filtering, and filter-aware available option metadata in `lib/projects/activity-heatmap.ts`
- [ ] T022 [US3] Finalize `view` and `agent` validation plus filter-aware API responses in `app/api/projects/activity/route.ts`
- [ ] T023 [US3] Add year and agent `Select` controls, TanStack Query refetching, and mobile-safe heatmap layout behavior in `components/projects/projects-activity-heatmap.tsx`

**Checkpoint**: All user stories are independently testable, including filter changes and mobile behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup across the full feature.

- [ ] T024 [P] Verify the shared query-key and heatmap component suites pass for `tests/unit/query-keys.test.ts` and `tests/unit/components/projects/projects-activity-heatmap.test.tsx`
- [ ] T025 [P] Verify the workspace heatmap route suite passes in `tests/integration/projects/activity-heatmap.test.ts`
- [ ] T026 [P] Verify the browser behavior passes in `tests/e2e/projects-activity-heatmap.spec.ts`
- [ ] T027 Run `bun run type-check` and `bun run lint` after updates to `app/projects/page.tsx`, `app/api/projects/activity/route.ts`, `components/projects/projects-activity-heatmap.tsx`, and `lib/projects/activity-heatmap.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies.
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all story work.
- **Phase 3: User Story 1**: Depends on Phase 2 and establishes the first working heatmap.
- **Phase 4: User Story 2**: Depends on User Story 1 because tooltip inspection extends the same day-cell UI and aggregate payload.
- **Phase 5: User Story 3**: Depends on User Story 1 and User Story 2 because filter changes must update the existing summary, legend, and tooltip behavior.
- **Phase 6: Polish**: Depends on all user stories being complete.

### User Story Dependencies

- **US1**: First deliverable and MVP.
- **US2**: Builds on the US1 heatmap cells and daily payload structure.
- **US3**: Builds on the US1 section and US2 tooltip interactions while adding filter-driven refetch behavior.

### Within Each User Story

- Tests must be written and fail before implementation.
- Shared aggregation changes in `lib/projects/activity-heatmap.ts` should land before route or UI tasks that consume them.
- Route changes in `app/api/projects/activity/route.ts` should land before filter/refetch behavior in `components/projects/projects-activity-heatmap.tsx`.
- Page integration in `app/projects/page.tsx` depends on the base component and initial payload shape being stable.

### Parallel Opportunities

- `T001` and `T002` can run in parallel.
- `T004` and `T005` can run in parallel once shared types exist.
- Within each story, the integration and component test tasks can run in parallel.
- Final verification tasks `T024`, `T025`, and `T026` can run in parallel after implementation is complete.

---

## Parallel Example: User Story 1

```bash
# Launch User Story 1 test authoring together:
Task: "Create contract-aligned workspace aggregate coverage in tests/integration/projects/activity-heatmap.test.ts"
Task: "Create component coverage in tests/unit/components/projects/projects-activity-heatmap.test.tsx"
```

## Parallel Example: User Story 2

```bash
# Launch User Story 2 test updates together:
Task: "Extend daily aggregate assertions in tests/integration/projects/activity-heatmap.test.ts"
Task: "Extend tooltip interaction coverage in tests/unit/components/projects/projects-activity-heatmap.test.tsx"
```

## Parallel Example: User Story 3

```bash
# Launch User Story 3 verification together:
Task: "Extend route coverage for view and agent handling in tests/integration/projects/activity-heatmap.test.ts"
Task: "Create mobile browser coverage in tests/e2e/projects-activity-heatmap.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate `tests/integration/projects/activity-heatmap.test.ts` and `tests/unit/components/projects/projects-activity-heatmap.test.tsx` before moving on.

### Incremental Delivery

1. Deliver US1 to establish the page section and correct workspace aggregates.
2. Add US2 to make each day inspectable without changing the core layout.
3. Add US3 for historical views, agent filtering, and mobile-safe interactions.
4. Finish with Phase 6 verification and repository-wide type/lint checks.

### Parallel Execution Strategy

1. Run Phase 1 and Phase 2 sequentially because they define the shared types, route, and page bootstrap.
2. Parallelize only the test authoring and verification tasks called out above.
3. Keep `lib/projects/activity-heatmap.ts`, `app/api/projects/activity/route.ts`, and `components/projects/projects-activity-heatmap.tsx` changes serialized to avoid merge conflicts across stories.
