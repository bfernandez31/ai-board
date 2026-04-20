# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `/specs/AIB-701-activity-heatmap-on/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/activity-heatmap-api.md

**Tests**: Test tasks are included by default per constitution requirements.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel when the task touches a different file and does not depend on incomplete work
- **[Story]**: Maps the task to a user story from `spec.md`
- Every task includes exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared query and auth plumbing needed by every heatmap slice.

- [X] T001 [P] Add projects activity heatmap query-key helpers to `app/lib/query-keys.ts` ✅ DONE
- [X] T002 [P] Extend current-user data access for heatmap period derivation in `lib/db/users.ts` ✅ DONE
- [X] T003 [P] Extend query-key regression coverage for the new heatmap keys in `tests/unit/query-keys.test.ts` ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared server aggregation contract that every user story depends on.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [X] T004 [P] Create cross-project aggregation tests for period construction, shipped deduping, accessible-project filtering, and agent-option derivation in `tests/unit/lib/projects/activity-heatmap.test.ts` ✅ DONE
- [X] T005 Create the shared heatmap aggregation helper, payload types, and date bucketing logic in `lib/projects/activity-heatmap.ts` ✅ DONE

**Checkpoint**: Shared aggregation, period rules, and query keys are ready for route and UI work.

---

## Phase 3: User Story 1 - Review Yearly AI Activity Across Projects (Priority: P1) 🎯 MVP

**Goal**: Show a populated or empty heatmap below the projects grid with summary totals for all accessible projects.

**Independent Test**: Load the projects page with seeded jobs and shipped tickets, then verify the default last-12-months heatmap, summary counts, legend, and empty-state messaging without changing filters.

### Tests for User Story 1

- [X] T006 [P] [US1] Create route integration coverage for default responses, auth failures, shipped-only counting, and zero-activity payloads in `tests/integration/projects/activity-heatmap-route.test.ts` ✅ DONE
- [X] T007 [P] [US1] Create component coverage for default summary rendering, legend visibility, populated cells, and empty-state replacement in `tests/unit/components/projects/project-activity-heatmap.test.tsx` ✅ DONE

### Implementation for User Story 1

- [X] T008 [US1] Create the dedicated `GET /api/projects/activity-heatmap` handler backed by `lib/projects/activity-heatmap.ts` in `app/api/projects/activity-heatmap/route.ts` ✅ DONE
- [X] T009 [US1] Extend `app/projects/page.tsx` to server-render the default heatmap payload and place the new section beneath the project cards ✅ DONE
- [X] T010 [US1] Remove the trapped vertical scroll from `components/projects/projects-container.tsx` so the page can naturally reach the heatmap section ✅ DONE
- [X] T011 [US1] Create the projects-page heatmap UI with summary header, month/day labels, legend, grid rendering, and empty-state content in `components/projects/project-activity-heatmap.tsx` ✅ DONE

**Checkpoint**: User Story 1 should render the default heatmap experience end-to-end and remain independently testable.

---

## Phase 4: User Story 2 - Change Time Range and Share a Specific View (Priority: P2)

**Goal**: Let users change the reporting period and effective-agent filter while keeping the selected view shareable through the URL.

**Independent Test**: Change period and agent filters, refresh the page, and reopen the copied URL to confirm the same view restores with unchanged grid boundaries.

### Tests for User Story 2

- [X] T012 [P] [US2] Extend `tests/integration/projects/activity-heatmap-route.test.ts` with invalid-filter handling, calendar-year availability, and effective-agent filtering scenarios ✅ DONE
- [X] T013 [P] [US2] Extend `tests/unit/components/projects/project-activity-heatmap.test.tsx` with URL persistence, hidden-filter states, and keep-previous-data refresh behavior ✅ DONE

### Implementation for User Story 2

- [X] T014 [US2] Extend `lib/projects/activity-heatmap.ts` to validate selected periods, derive year options from `User.createdAt`, compute agent options, and normalize unavailable agents to `all` ✅ DONE
- [X] T015 [US2] Extend `app/api/projects/activity-heatmap/route.ts` with Zod parsing for `activityPeriod` and `activityAgent` plus contract-aligned `400/401/403/500` responses ✅ DONE
- [X] T016 [US2] Extend `app/projects/page.tsx` to read `activityPeriod` and `activityAgent` from `searchParams` and pass the validated initial selection to the heatmap component ✅ DONE
- [X] T017 [US2] Extend `components/projects/project-activity-heatmap.tsx` with filter controls, TanStack Query refresh, URL synchronization, and no-blanking background updates ✅ DONE

**Checkpoint**: User Story 2 should preserve a shareable filtered view and remain independently testable on top of the MVP.

---

## Phase 5: User Story 3 - Inspect Daily Details on Desktop and Mobile (Priority: P3)

**Goal**: Make each heatmap cell inspectable with accurate day-level details and mobile-friendly scrolling.

**Independent Test**: Interact with populated cells on desktop and mobile-sized viewports to verify tooltip content, cost omission rules, tap dismissal, horizontal scrolling, and pinned day labels.

### Tests for User Story 3

- [X] T018 [P] [US3] Extend `tests/unit/components/projects/project-activity-heatmap.test.tsx` with hover and tap tooltip flows, outside-tap dismissal, and sticky-label mobile rendering checks ✅ DONE
- [X] T019 [P] [US3] Extend `tests/unit/lib/projects/activity-heatmap.test.ts` with chipped-week boundaries, tooltip cost omission, and month-label placement assertions ✅ DONE

### Implementation for User Story 3

- [X] T020 [US3] Extend `lib/projects/activity-heatmap.ts` to emit tooltip-ready daily cells with optional cost totals, chipped first/last weeks, and stable month-label coordinates ✅ DONE
- [X] T021 [US3] Extend `components/projects/project-activity-heatmap.tsx` with hover and tap tooltips, `components/ui/scroll-area.tsx` horizontal overflow, sticky day labels, and mobile dismissal behavior ✅ DONE

**Checkpoint**: User Story 3 should add inspectable daily details and mobile interaction support without regressing earlier stories.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression coverage and cross-story refinement.

- [X] T022 [P] Refine shared accessibility and fallback states across `components/projects/project-activity-heatmap.tsx`, `app/projects/page.tsx`, and `app/api/projects/activity-heatmap/route.ts` ✅ DONE
- [X] T023 Run full regression verification in `tests/unit/query-keys.test.ts`, `tests/unit/lib/projects/activity-heatmap.test.ts`, `tests/unit/components/projects/project-activity-heatmap.test.tsx`, and `tests/integration/projects/activity-heatmap-route.test.ts` ✅ DONE

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and can start immediately.
- **Phase 2: Foundational** depends on Phase 1 and blocks every user story because the shared aggregation helper is the source of truth for the route and UI.
- **Phase 3: US1** depends on Phase 2.
- **Phase 4: US2** depends on US1 because it extends the live heatmap route and component with shareable filtering behavior.
- **Phase 5: US3** depends on US2 because daily-detail interactions build on the filtered heatmap component and payload.
- **Phase 6: Polish** depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: First deliverable and MVP. No dependency on later stories.
- **US2 (P2)**: Builds on the shipped US1 route/component but remains independently testable once complete.
- **US3 (P3)**: Builds on the shipped US1 and US2 visualization shell but remains independently testable once complete.

### Within Each User Story

- Tests should be written before implementation and should fail first.
- Server aggregation changes in `lib/projects/activity-heatmap.ts` should land before route or client behavior that depends on them.
- Route and page wiring should land before the final component integration for that story.

### Story Completion Order

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: US1 (MVP)
4. Phase 4: US2
5. Phase 5: US3
6. Phase 6: Polish

### Parallel Opportunities

- `T001` and `T002` can run in parallel, followed by `T003`.
- `T004` can run while `T003` is under review because they touch different test domains.
- `T006` and `T007` can run in parallel for US1.
- `T012` and `T013` can run in parallel for US2.
- `T018` and `T019` can run in parallel for US3.

---

## Parallel Example: User Story 1

```bash
Task: "T006 [US1] Create route integration coverage in tests/integration/projects/activity-heatmap-route.test.ts"
Task: "T007 [US1] Create component coverage in tests/unit/components/projects/project-activity-heatmap.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T012 [US2] Extend route filter coverage in tests/integration/projects/activity-heatmap-route.test.ts"
Task: "T013 [US2] Extend URL-sync coverage in tests/unit/components/projects/project-activity-heatmap.test.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T018 [US3] Extend tooltip/mobile component coverage in tests/unit/components/projects/project-activity-heatmap.test.tsx"
Task: "T019 [US3] Extend chipped-week and cost-omission aggregation coverage in tests/unit/lib/projects/activity-heatmap.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 and verify `tests/integration/projects/activity-heatmap-route.test.ts` plus `tests/unit/components/projects/project-activity-heatmap.test.tsx`.
3. Stop after US1 if only the base cross-project heatmap is needed for the initial release.

### Incremental Delivery

1. Deliver US1 for the default last-12-months heatmap below the project grid.
2. Add US2 for shareable period and agent filtering with background refresh.
3. Add US3 for tooltip inspection and mobile interaction polish.
4. Finish with Phase 6 regression cleanup.

### Parallel Execution Strategy

1. Finish Setup and Foundational phases sequentially.
2. Use the parallel test tasks inside each story phase before implementation begins.
3. Keep server work in `lib/projects/activity-heatmap.ts` and client work in `components/projects/project-activity-heatmap.tsx` serialized once a story reaches implementation, because both stories converge on shared files.

---

## Notes

- All referenced existing files were verified against the repository.
- New files are limited to the ones explicitly justified in `research.md`.
- The suggested MVP scope is **User Story 1**.
