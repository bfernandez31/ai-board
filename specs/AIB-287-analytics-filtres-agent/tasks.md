# Tasks: Analytics Filters (Agent/Status) & Dynamic Shipped Card

**Input**: Design documents from `/specs/AIB-287-analytics-filtres-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analytics-api-v2.yaml

**Tests**: No test tasks included — not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Types & Utilities)

**Purpose**: Add new types and utility functions that all user stories depend on

- [x] T001 Add `StatusFilter` type, `AnalyticsFilters` interface, `ticketsClosed` to `OverviewMetrics`, and `availableAgents` to `AnalyticsData` in `lib/analytics/types.ts`
- [x] T002 Add `getTimeRangeLabel(range: TimeRange): string` and `getStagesFromStatus(status: StatusFilter): Stage[]` utilities in `lib/analytics/aggregations.ts`

---

## Phase 2: Foundational (Query Layer & API)

**Purpose**: Update all backend query functions and the API route to accept and apply status/agent filters. MUST be complete before any UI work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Update `getAnalyticsData()` signature to accept `status: StatusFilter` and `agent: string | null` params, and add `getAvailableAgents()` query (SELECT DISTINCT model) in `lib/analytics/queries.ts`
- [x] T004 Update `getOverviewMetrics()` to: (a) replace hardcoded `monthStart` with `rangeStart` for ticketsShipped count, (b) add `ticketsClosed` count query, (c) apply `stages` and `agent` filters to job-level queries in `lib/analytics/queries.ts`
- [x] T005 [P] Update `getCostOverTime()` to apply `{ ticket: { stage: { in: stages } } }` and `{ model: agent }` filters in `lib/analytics/queries.ts`
- [x] T006 [P] Update `getCostByStage()` to apply stage and agent filters in `lib/analytics/queries.ts`
- [x] T007 [P] Update `getTokenUsage()` (which also feeds `getCacheEfficiency`) to apply stage and agent filters in `lib/analytics/queries.ts`
- [x] T008 [P] Update `getTopTools()` to apply stage and agent filters in `lib/analytics/queries.ts`
- [x] T009 [P] Update `getVelocityData()` to use `stages` param instead of hardcoded `'SHIP'` and apply time range filter in `lib/analytics/queries.ts`
- [x] T010 [P] Update `getWorkflowDistribution()` to add stage filter in `lib/analytics/queries.ts`
- [x] T011 Add Zod validation for `status` and `agent` query params and pass validated values to `getAnalyticsData()` in `app/api/projects/[projectId]/analytics/route.ts`
- [x] T012 Update `queryKeys.analytics.data()` to include `status` and `agent` parameters in `app/lib/query-keys.ts`

**Checkpoint**: Backend fully supports all three filters (range, status, agent). All existing behavior preserved with defaults (status=shipped, agent=null).

---

## Phase 3: User Story 1 — Filter Analytics by Ticket Status (Priority: P1) 🎯 MVP

**Goal**: Users can filter all analytics metrics by ticket status (Shipped, Closed, or both) via a dropdown, with filter state persisted in URL

**Independent Test**: Select different status options and verify all overview cards, charts, and metrics update to reflect only tickets in the selected stage(s)

### Implementation for User Story 1

- [x] T013 [US1] Create `StatusFilter` component (shadcn Select with "Shipped" default, "Closed", "Shipped + Closed" options) in `components/analytics/status-filter.tsx`
- [x] T014 [US1] Add `status` state to `AnalyticsDashboard` (initialized from URL `searchParams`), sync changes to URL via `router.push()`, pass `status` to TanStack Query fetch, and render `StatusFilter` in filter bar in `components/analytics/analytics-dashboard.tsx`
- [x] T015 [US1] Parse and validate `status` query param from `searchParams`, pass to `getAnalyticsData()` for SSR hydration in `app/projects/[projectId]/analytics/page.tsx`

**Checkpoint**: Status filter fully functional — selecting "Shipped", "Closed", or "Shipped + Closed" updates all dashboard widgets. URL persists selection.

---

## Phase 4: User Story 2 — Dynamic Tickets Shipped Card (Priority: P1)

**Goal**: The "Tickets Shipped" overview card displays the count for the currently selected time range (not hardcoded to current calendar month) with a dynamic label

**Independent Test**: Switch between time ranges (7d, 30d, 90d, all) and verify the card value and label update correctly

### Implementation for User Story 2

- [x] T016 [US2] Update "Tickets Shipped" card to accept `timeRange` prop and display dynamic label (e.g., "last 7 days", "last 30 days") using `getTimeRangeLabel()` in `components/analytics/overview-cards.tsx`
- [x] T017 [US2] Pass `timeRange` prop from `AnalyticsDashboard` to `OverviewCards` component in `components/analytics/analytics-dashboard.tsx`

**Checkpoint**: Shipped card label dynamically reflects selected time range. Count already fixed in Phase 2 (T004).

---

## Phase 5: User Story 3 — Filter Analytics by Agent (Priority: P2)

**Goal**: Users can filter analytics by AI agent/model via a dropdown populated with agents that have at least one job in the project

**Independent Test**: Select a specific agent from the dropdown and verify all metrics reflect only jobs executed by that agent

### Implementation for User Story 3

- [x] T018 [US3] Create `AgentFilter` component (shadcn Select with "All Agents" default + dynamic agent list from `availableAgents`) in `components/analytics/agent-filter.tsx`
- [x] T019 [US3] Add `agent` state to `AnalyticsDashboard` (initialized from URL `searchParams`), sync changes to URL via `router.push()`, pass `agent` to TanStack Query fetch, and render `AgentFilter` in filter bar in `components/analytics/analytics-dashboard.tsx`
- [x] T020 [US3] Parse and validate `agent` query param from `searchParams`, pass to `getAnalyticsData()` for SSR hydration in `app/projects/[projectId]/analytics/page.tsx`

**Checkpoint**: Agent filter fully functional — selecting a specific agent updates all dashboard widgets. Combined with status filter via AND logic.

---

## Phase 6: User Story 4 — Tickets Closed Card (Priority: P2)

**Goal**: Display a "Tickets Closed" card alongside "Tickets Shipped" showing the count of CLOSED tickets within the selected time period

**Independent Test**: Verify the card displays the correct count of CLOSED tickets, updates with time range changes, and shows 0 when no tickets are closed

### Implementation for User Story 4

- [x] T021 [US4] Add "Tickets Closed" card (5th card, XCircle icon) with dynamic time range label to the overview cards grid in `components/analytics/overview-cards.tsx`

**Checkpoint**: Dashboard now shows both Shipped and Closed ticket counts side by side. Both respect time range and status filters.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T022 Run `bun run type-check` and fix any TypeScript errors across all modified files
- [x] T023 Run `bun run lint` and fix any linting issues across all modified files
- [x] T024 Run quickstart.md validation — verify all 10 file modifications listed in `specs/AIB-287-analytics-filtres-agent/quickstart.md` are implemented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types must exist first)
- **User Stories (Phases 3–6)**: All depend on Phase 2 completion
  - US1 (Phase 3) and US2 (Phase 4) can proceed in parallel
  - US3 (Phase 5) and US4 (Phase 6) can proceed in parallel
  - US4 depends only on Phase 2 (ticketsClosed already in queries)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1 — Status Filter)**: After Phase 2. No dependencies on other stories.
- **US2 (P1 — Dynamic Shipped Card)**: After Phase 2. No dependencies on other stories (bug fix is in Phase 2 T004; UI label is independent).
- **US3 (P2 — Agent Filter)**: After Phase 2. Shares dashboard component with US1 — if executing sequentially, implement after US1 to extend existing filter bar. If parallel, coordinate on `analytics-dashboard.tsx`.
- **US4 (P2 — Tickets Closed Card)**: After Phase 2. No dependencies on other stories.

### Within Each User Story

- Component creation before dashboard integration
- Dashboard integration before page SSR hydration
- Core implementation before cross-cutting polish

### Parallel Opportunities

- **Phase 2**: T005, T006, T007, T008, T009, T010 can all run in parallel (different query functions)
- **Phase 3+4**: US1 and US2 can run in parallel (different component files, minimal overlap)
- **Phase 5+6**: US3 and US4 can run in parallel (different component files)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T003-T004 complete, launch all query updates in parallel:
Task: "Update getCostOverTime() with stage and agent filters in lib/analytics/queries.ts"
Task: "Update getCostByStage() with stage and agent filters in lib/analytics/queries.ts"
Task: "Update getTokenUsage() with stage and agent filters in lib/analytics/queries.ts"
Task: "Update getTopTools() with stage and agent filters in lib/analytics/queries.ts"
Task: "Update getVelocityData() with stages param in lib/analytics/queries.ts"
Task: "Update getWorkflowDistribution() with stage filter in lib/analytics/queries.ts"
```

## Parallel Example: User Stories

```bash
# After Phase 2 completes, launch P1 stories in parallel:
Task: "US1 — Create StatusFilter component in components/analytics/status-filter.tsx"
Task: "US2 — Update Shipped card label in components/analytics/overview-cards.tsx"

# Then launch P2 stories in parallel:
Task: "US3 — Create AgentFilter component in components/analytics/agent-filter.tsx"
Task: "US4 — Add Tickets Closed card in components/analytics/overview-cards.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 — Status Filter + Shipped Card Fix)

1. Complete Phase 1: Setup (types + utils)
2. Complete Phase 2: Foundational (queries + API + query keys)
3. Complete Phase 3: US1 — Status Filter
4. Complete Phase 4: US2 — Dynamic Shipped Card
5. **STOP and VALIDATE**: Both P1 stories independently functional
6. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → Backend ready with all filters supported
2. Add US1 (Status Filter) → Test independently → Dashboard filters by status
3. Add US2 (Dynamic Shipped Card) → Test independently → Bug fix shipped
4. Add US3 (Agent Filter) → Test independently → Agent filtering works
5. Add US4 (Tickets Closed Card) → Test independently → Full feature complete
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- No Prisma schema changes required — all fields already exist
- No new dependencies required — all using existing shadcn/ui, TanStack Query, Recharts
- Default values (status=shipped, agent=null) preserve existing dashboard behavior
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
