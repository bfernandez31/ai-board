# Tasks: Copy of Activity Heatmap on Projects Page

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-653-copy-of-activity/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-653-copy-of-activity/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-653-copy-of-activity/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-653-copy-of-activity/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-653-copy-of-activity/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-653-copy-of-activity/contracts/projects-activity-heatmap-api.md`

**Tests**: Test tasks are included by default per constitution. Existing test files are extended first; new test files are introduced only where the repo has no coherent existing coverage for the projects heatmap surface.

**Organization**: Tasks are grouped by setup, foundational work, and then one phase per user story so each increment remains independently testable.

## Phase 1: Setup (Shared Definitions)

**Purpose**: Establish shared types and filter parsing utilities used across the page, API route, and client heatmap.

- [X] T001 Extend `app/lib/types/project.ts` with projects heatmap response, summary, day-cell, period option, and agent option types shared by the page, API route, and client component.
- [X] T002 [P] Create `app/lib/utils/projects-activity-filters.ts` with Zod-backed parsing and normalization helpers for `period`, `year`, and `agent` search params used by the projects heatmap.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared validation and data-access infrastructure that every user story depends on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T003 Extend `tests/unit/agent-resolution.test.ts` with regression coverage for effective-agent behavior relied on by cross-project heatmap aggregation.
- [X] T004 Extend `lib/db/projects.ts` with shared authenticated projects heatmap aggregation helpers, day bucketing utilities, and owner-or-member scoping reused by the page and API route.
- [X] T005 Create `app/api/projects/activity/route.ts` with authenticated query parsing, contract-aligned `400/401/500` responses, and delegation to the shared heatmap query in `lib/db/projects.ts`.

**Checkpoint**: Shared contracts, validation, and aggregation infrastructure are ready for story implementation.

---

## Phase 3: User Story 1 - Review Annual AI Activity Across Projects (Priority: P1) 🎯 MVP

**Goal**: Show the projects-page heatmap, summary counts, legend, and empty state immediately on first render for the default rolling period.

**Independent Test**: Load `/projects` with seeded job and ticket history and verify the initial server-rendered heatmap, shipped-ticket summary, legend, and empty-state messaging without a blank loading gap.

### Tests for User Story 1

- [X] T006 [P] [US1] Extend `tests/integration/projects/crud.test.ts` with `/api/projects/activity` assertions for default payload shape, shipped-ticket counting from successful `ship` jobs, and empty-state responses.
- [X] T007 [P] [US1] Create `tests/unit/components/projects/projects-activity-heatmap.test.tsx` for first-render summary text, legend levels, in-period day-cell rendering, and empty-state rendering because no existing unit test file covers the projects heatmap component.

### Implementation for User Story 1

- [X] T008 [US1] Extend `lib/db/projects.ts` to compute default rolling 12-month day aggregates, intensity levels, shipped ticket details, and optional daily cost totals for the projects heatmap.
- [X] T009 [US1] Extend `app/projects/page.tsx` to fetch the initial projects heatmap payload on the server and pass it alongside the existing projects list.
- [X] T010 [US1] Extend `components/projects/projects-container.tsx` to remove the fixed-height inner scroll region and render the heatmap section below the project cards grid.
- [X] T011 [US1] Create `components/projects/projects-activity-heatmap.tsx` to render the summary header, month labels, weekday labels, legend, day grid, and empty state from the initial server-provided heatmap payload.

**Checkpoint**: User Story 1 is independently functional as a server-rendered projects-page heatmap MVP.

---

## Phase 4: User Story 2 - Change Period and Share a Specific View (Priority: P1)

**Goal**: Let users switch between last-12-months and calendar-year views, keep the chosen view in the URL, and preserve visible content during background refreshes.

**Independent Test**: Select a period on `/projects`, refresh the page, and reopen the copied URL in a new session to verify the same period and agent state are restored with no blank refetch flash.

### Tests for User Story 2

- [X] T012 [P] [US2] Extend `tests/integration/projects/crud.test.ts` with `/api/projects/activity` validation for period parsing, year bounds, period option generation, and chipped first/last week columns without out-of-period cells.
- [X] T013 [P] [US2] Create `tests/e2e/projects-activity-heatmap.spec.ts` for projects-page period selection, URL restoration, and refresh persistence because `tests/e2e/activity.spec.ts` covers the per-project activity feed, not the shared projects heatmap.

### Implementation for User Story 2

- [X] T014 [US2] Extend `app/lib/utils/projects-activity-filters.ts` to derive valid period options from `User.createdAt` through the current year and serialize the selected period state into URL-safe values.
- [X] T015 [US2] Create `app/lib/hooks/queries/use-projects-activity-heatmap.ts` to fetch `/api/projects/activity` with TanStack Query 15-second polling while retaining prior heatmap data during refetch.
- [X] T016 [US2] Extend `app/projects/page.tsx` to validate `period`, `year`, and `agent` search params for initial server render fallback behavior and correct initial heatmap selection.
- [X] T017 [US2] Extend `components/projects/projects-activity-heatmap.tsx` to add period controls, URL-synced filter updates, and background refresh behavior that preserves visible content until fresh data arrives.

**Checkpoint**: User Story 2 independently restores and shares an exact projects heatmap view through the page URL.

---

## Phase 5: User Story 3 - Filter Activity by Agent (Priority: P2)

**Goal**: Let users narrow the same period view to one effective agent while preserving the period boundaries and grid shape.

**Independent Test**: Seed mixed explicit and inherited agents, filter to one agent on `/projects`, and verify only matching activity remains while the same day range and week layout stay intact.

### Tests for User Story 3

- [X] T018 [P] [US3] Extend `tests/integration/projects/crud.test.ts` with `/api/projects/activity` assertions for supported-agent validation, distinct agent option generation, inherited-agent matches, and zero-count filtered responses that keep the selected period boundaries.
- [X] T019 [P] [US3] Extend `tests/unit/agent-resolution.test.ts` with projects-heatmap cases that prove inherited project defaults remain selectable and filterable when ticket agents are unset.

### Implementation for User Story 3

- [X] T020 [US3] Extend `lib/db/projects.ts` to derive distinct effective agent options from in-period activity and apply agent filtering using `resolveEffectiveAgent(ticket.agent, project.defaultAgent)`.
- [X] T021 [US3] Extend `components/projects/projects-activity-heatmap.tsx` to show or hide the agent selector appropriately, keep the selected period in the URL, and preserve the existing grid boundaries while filtered.

**Checkpoint**: User Story 3 independently supports effective-agent filtering without changing the visible time range.

---

## Phase 6: User Story 4 - Inspect Daily Details on Desktop and Mobile (Priority: P3)

**Goal**: Add desktop hover and mobile tap interactions so users can inspect a day’s exact date, job count, shipped tickets, and optional cost details.

**Independent Test**: Hover and tap day cells on desktop and mobile-sized viewports to confirm tooltip content, outside-click dismissal, missing-cost omission, and horizontally scrollable layout with pinned weekday labels.

### Tests for User Story 4

- [X] T022 [P] [US4] Extend `tests/unit/components/projects/projects-activity-heatmap.test.tsx` with tooltip interaction coverage for desktop hover, touch dismiss, shipped-ticket detail rendering, and omission of the cost line when daily cost is absent.
- [X] T023 [P] [US4] Extend `tests/e2e/projects-activity-heatmap.spec.ts` with mobile horizontal scrolling, pinned weekday labels, and tappable heatmap-cell behavior on the projects page.

### Implementation for User Story 4

- [X] T024 [US4] Extend `components/projects/projects-activity-heatmap.tsx` to add accessible hover/tap day details, outside-tap dismissal, optional cost display, pinned weekday labels, and mobile-safe horizontal scrolling without shrinking cell targets.

**Checkpoint**: User Story 4 independently supports day-level inspection on pointer and touch devices.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final pass across shared UX, accessibility, and regression protection spanning multiple stories.

- [X] T025 [P] Extend `tests/integration/projects/crud.test.ts`, `tests/unit/components/projects/projects-activity-heatmap.test.tsx`, and `tests/e2e/projects-activity-heatmap.spec.ts` with final regression coverage for first-render stability and background refresh retention.
- [X] T026 Extend `app/projects/page.tsx` and `components/projects/projects-activity-heatmap.tsx` with final summary-label wording, responsive spacing, accessibility polish, and no-regression cleanup across all heatmap states.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies and can start immediately.
- Foundational (Phase 2) depends on Setup and blocks every user story phase.
- User Story 1 (Phase 3) depends on Foundational completion.
- User Story 2 (Phase 4) depends on User Story 1 because it extends the base rendered heatmap with URL-driven period state and client refetch behavior.
- User Story 3 (Phase 5) depends on User Story 1 and should follow User Story 2 when possible because both stories extend the same filter and client-state surfaces.
- User Story 4 (Phase 6) depends on User Stories 1-3 because tooltip interaction sits on the final heatmap layout and filtered data model.
- Polish (Phase 7) depends on all desired user stories being complete.

### User Story Dependencies

- User Story 1 (P1) is the MVP and the first independently shippable increment.
- User Story 2 (P1) builds directly on the base heatmap component and page search-param flow from User Story 1.
- User Story 3 (P2) builds on the same shared query and heatmap component after the base surface exists.
- User Story 4 (P3) adds interaction detail after the data, filters, and layout are stable.

### Within Each User Story

- Tests must be written and fail before implementation tasks in the same story.
- Shared data logic in `lib/db/projects.ts` should land before the page or component tasks that consume it.
- Page wiring should land before client behavior that depends on initial server data.
- Each story should be validated independently before starting the next dependent story.

### Parallel Opportunities

- T002 can run in parallel with T001 during Setup.
- T006 and T007 can run in parallel for User Story 1.
- T012 and T013 can run in parallel for User Story 2.
- T018 and T019 can run in parallel for User Story 3.
- T022 and T023 can run in parallel for User Story 4.
- Different stories should only run in parallel after their shared file dependencies are coordinated, because `app/projects/page.tsx`, `components/projects/projects-activity-heatmap.tsx`, and `lib/db/projects.ts` are common integration points.

---

## Parallel Example: User Story 1

```bash
Task T006: Extend tests/integration/projects/crud.test.ts with default heatmap API assertions
Task T007: Create tests/unit/components/projects/projects-activity-heatmap.test.tsx for first-render UI coverage
```

## Parallel Example: User Story 2

```bash
Task T012: Extend tests/integration/projects/crud.test.ts with period and year validation coverage
Task T013: Create tests/e2e/projects-activity-heatmap.spec.ts for URL restoration coverage
```

## Parallel Example: User Story 3

```bash
Task T018: Extend tests/integration/projects/crud.test.ts with agent filter API assertions
Task T019: Extend tests/unit/agent-resolution.test.ts with inherited-agent filter coverage
```

## Parallel Example: User Story 4

```bash
Task T022: Extend tests/unit/components/projects/projects-activity-heatmap.test.tsx with tooltip interaction coverage
Task T023: Extend tests/e2e/projects-activity-heatmap.spec.ts with mobile scroll and tap behavior coverage
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate `/projects` first-render heatmap behavior and shipped-ticket semantics before expanding scope.

### Incremental Delivery

1. Finish Setup and Foundational work to stabilize shared types, validation, and aggregation.
2. Deliver User Story 1 as the first shippable heatmap increment on the projects page.
3. Add User Story 2 for URL-restorable period views and background refresh.
4. Add User Story 3 for effective-agent filtering.
5. Add User Story 4 for tooltip inspection and mobile interaction polish.

### Parallel Execution Strategy

1. Run Setup and Foundational work sequentially because both phases establish shared files and contracts.
2. Parallelize test authoring inside each user story where tasks touch different files.
3. Coordinate implementation work that touches `lib/db/projects.ts`, `app/projects/page.tsx`, and `components/projects/projects-activity-heatmap.tsx` to avoid merge conflicts.

---

## Notes

- All checklist items use the required `- [ ] T### ...` format.
- Existing integration and unit test files are extended before new files are introduced.
- New files are limited to `app/api/projects/activity/route.ts`, `app/lib/utils/projects-activity-filters.ts`, `app/lib/hooks/queries/use-projects-activity-heatmap.ts`, `components/projects/projects-activity-heatmap.tsx`, `tests/unit/components/projects/projects-activity-heatmap.test.tsx`, and `tests/e2e/projects-activity-heatmap.spec.ts`, where the repo does not already have a coherent file for that responsibility.
