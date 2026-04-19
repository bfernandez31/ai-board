---
description: "Task list for Activity Heatmap on Projects Page (AIB-688)"
---

# Tasks: Activity Heatmap on Projects Page

**Feature Branch**: `AIB-688-copy-of-activity`
**Input**: Design documents from `specs/AIB-688-copy-of-activity/`
**Prerequisites**: `plan.md` ✅, `spec.md` ✅, `research.md` ✅, `data-model.md` ✅, `contracts/activity-heatmap-api.md` ✅

**Tests**: Included by default per constitution III.

**Organization**: Tasks are grouped by user story (P1 → P2 → P3). Foundational phase delivers the shared server aggregation, API contract, and polling hook required by every story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no unresolved dependencies)
- **[Story]**: User story tag (US1, US2, US3); omitted in Setup / Foundational / Polish
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new directory structure so every downstream task lands in a predictable location. No package installs — tech stack is unchanged (FR-022, no new deps).

- [ ] T001 Create feature directory `components/projects/activity-heatmap/` (empty; index + sub-components land here in later phases)
- [ ] T002 Create server aggregation files stub directory check at `lib/analytics/` (directory exists — no creation; verify and note that new files `heatmap-queries.ts` and `heatmap-types.ts` will be added in Phase 2)
- [ ] T003 Create API route directory `app/api/activity-heatmap/` (empty; `route.ts` lands here in Phase 2)
- [ ] T004 Create integration test directory `tests/integration/activity-heatmap/` (empty; `heatmap-route.test.ts` lands here in Phase 2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Deliver the one shared contract every user story consumes — types, server aggregation helpers, the `GET /api/activity-heatmap` endpoint, the TanStack Query polling hook, and the query-keys namespace. US1/US2/US3 cannot start until this phase is green.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Types & query-key wiring

- [ ] T005 [P] Create payload types (`HeatmapPeriod`, `HeatmapAgentFilter`, `HeatmapFilters`, `HeatmapShippedTicket`, `HeatmapDay`, `HeatmapTotals`, `HeatmapIntensityThresholds`, `HeatmapMeta`, `HeatmapPayload`) per `data-model.md` in `lib/analytics/heatmap-types.ts`
- [ ] T006 [P] Add `queryKeys.activityHeatmap.data(period, agent, tz)` tuple namespace in `app/lib/query-keys.ts` (research §P9 — serialise deterministically so distinct filters produce distinct cache entries)

### Server aggregation (pure helpers + Prisma)

- [ ] T007 Implement accessible-project-id resolver in `lib/analytics/heatmap-queries.ts` that mirrors the owner-OR-member `OR` clause at `lib/db/projects.ts:31-37` (research §D10, R1)
- [ ] T008 Implement period → date range resolver in `lib/analytics/heatmap-queries.ts` handling `last-12-months` rolling window and `calendar-year` with current-year clamp, in the caller-supplied IANA timezone (data-model §R2). Use `lib/analytics/aggregations.ts` helpers where applicable; no new deps
- [ ] T009 Implement day-bucketing helper in `lib/analytics/heatmap-queries.ts` that converts a UTC `Date` to a `YYYY-MM-DD` key in the requested timezone via `Intl.DateTimeFormat` (research §D5, R3)
- [ ] T010 Implement effective-agent `WHERE` builder in `lib/analytics/heatmap-queries.ts` using the shape `OR: [{ agent }, { agent: null, project: { is: { defaultAgent: agent } } }]` from `lib/analytics/queries.ts:51-69` (research §P1, R6). Leave a comment citing `FR-008` stating that ship-counting MUST NOT use `COMPLETED_TICKET_STAGES` (research §P6)
- [ ] T011 Implement quartile intensity-threshold computation (`t1..t4` with `min 1` and strict-ascending guarantees) and `level(count)` bucketer in `lib/analytics/heatmap-queries.ts` (data-model §R7)
- [ ] T012 Implement the main `getActivityHeatmap({ userId, filters })` function in `lib/analytics/heatmap-queries.ts` — runs: accessible-project resolution → two Prisma `groupBy`s on `Job` (one for intensity over all commands, one for `command='ship' AND status=COMPLETED` shipped list) → backfill zero-count days → compute totals, thresholds, `distinctAgents` (without agent filter applied per R8), and `availableYears` from `User.createdAt`. Returns a `HeatmapPayload`. Read-only; no `$transaction` (research §P8)
- [ ] T013 [P] Unit tests for pure helpers in `tests/unit/lib/heatmap-queries.test.ts` — quartile thresholds (all-zeros, all-same-value, uneven distribution); day-key bucketing for `2025-06-15T02:00:00Z` across UTC vs `America/New_York`; effective-agent clause shape round-trip

### API route

- [ ] T014 Implement `GET /api/activity-heatmap` in `app/api/activity-heatmap/route.ts`: `requireAuth()` → 401 on no session; Zod `querySchema` for `agent`/`tz`; imperative allow-list validation for `period` against `[year(user.createdAt)..currentYear] ∪ 'last-12-months'` with silent coercion to default (never 400 — research §P5); call `getActivityHeatmap`; return payload with `Cache-Control: private, no-store`. Wrap aggregation in try/catch → 500 `{ error: 'Failed to load activity heatmap' }` with structured log
- [ ] T015 Integration tests for the endpoint in `tests/integration/activity-heatmap/heatmap-route.test.ts` — all 13 contract assertions in `contracts/activity-heatmap-api.md` §Contract tests: (1) unauth 401, (2) default shape, (3) calendar year range, (4) current-year clamp, (5) out-of-range year coercion, (6) agent-scope effective resolution, (7) ship-counter ignores stage-only SHIP, (8) null cost stays null, (9) owner+member scope isolation, (10) distinctAgents cardinality, (11) threshold monotonicity, (12) tz bucketing + invalid-tz fallback, (13) Content-Type + Cache-Control headers. Seed: Project(owner), Project(member), Project(no-access); Tickets with explicit/null agents; Jobs with ship/non-ship × COMPLETED/FAILED × null/non-null cost

### Polling hook

- [ ] T016 Create `useActivityHeatmap({ filters, initialData })` in `hooks/use-activity-heatmap.ts` mirroring `hooks/use-usage.ts:35-42` — `useQuery({ queryKey: queryKeys.activityHeatmap.data(...), queryFn: GET /api/activity-heatmap, initialData: filtersMatch(filters, initialData.filters) ? initialData : undefined, refetchInterval: 15_000, staleTime: 10_000 })`. Only pass `initialData` when filter identity matches (research §P2)

**Checkpoint**: `GET /api/activity-heatmap` returns the full contract payload; all integration assertions pass; hook is ready to be consumed.

---

## Phase 3: User Story 1 - See my AI activity at a glance (Priority: P1) 🎯 MVP

**Goal**: Signed-in user lands on `/projects`, sees the heatmap below the project cards on first paint (no spinner flash) with real shaded cells, correct header counter, working tooltip, and the empty-state message when no activity exists.

**Independent Test**: Seed a test user with jobs across multiple days + a couple of shipped tickets in the last year. `GET /projects`. Confirm: (a) heatmap renders below project cards on first paint with NO skeleton/spinner visible; (b) header counter reads `"{jobs} jobs · {tickets} tickets shipped in the last year"` and matches underlying data; (c) shaded cells match days with jobs and use the correct intensity level; (d) hovering a shaded cell opens a tooltip with formatted date, job count, shipped list, and a cost line only when a non-null cost exists; (e) for a user with no jobs, the grid is replaced by "No activity to show yet — your AI work will appear here" while the legend remains visible.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

**Domain search**: The only RTL test file in the heatmap domain is net-new. `tests/unit/components/analytics-dashboard.test.tsx` covers the per-project analytics dashboard — extending it would mix per-project vs per-user concerns (research §Tests to extend). `tests/unit/components/comparison-compliance-heatmap.test.tsx` is a different heatmap data model (pass/fail/mixed). Therefore a new RTL file is justified.

- [ ] T017 [P] [US1] Create RTL tests in `tests/unit/components/activity-heatmap.test.tsx` for: header counter string formatting, intensity level → Tailwind class mapping (levels 0..4 return literal class names), tooltip renders date + job count + shipped list + cost line when `totalCost != null` AND omits the cost line when `totalCost === null` (SC-006 — never `$NaN`/`$0`), empty-state swap when `totals.jobs === 0` keeps legend visible, chipped-corner absence of out-of-period cells, future-day rendering (level 0 cells, not omitted, for days after `today` in current-year view)

### Implementation for User Story 1

- [ ] T018 [P] [US1] Create cell-intensity helper (pure `switch` on level 0..4 returning complete literal Tailwind class strings `bg-zinc-800/40`, `bg-violet-900`, `bg-violet-800`, `bg-violet-700`, `bg-violet-500`) in `components/projects/activity-heatmap/heatmap-grid.tsx` (research §P7, §D9 — never interpolate class names)
- [ ] T019 [P] [US1] Implement `HeatmapLegend` (Less → five swatches → More) in `components/projects/activity-heatmap/heatmap-legend.tsx` using the same literal-class helper
- [ ] T020 [P] [US1] Implement `HeatmapTooltip` component in `components/projects/activity-heatmap/heatmap-tooltip.tsx` — shadcn `Tooltip`; renders formatted date, job count, shipped-ticket list (`ticketKey` + `title`), and a cost line iff `totalCost != null` (FR-010, SC-006)
- [ ] T021 [US1] Implement `HeatmapGrid` in `components/projects/activity-heatmap/heatmap-grid.tsx` — renders the 7-row Sunday-anchored grid of `HeatmapDay[]`; chips the top-left / bottom-right corners when the period boundary is not a week boundary (FR-005); renders future days inside the current calendar year as level-0 cells (FR-005 edge case); month labels above, day-of-week labels to the left (FR-003); empty-state message replaces the grid when `totals.jobs === 0` while keeping the legend (FR-019). Depends on T018, T020
- [ ] T022 [US1] Implement top-level client component in `components/projects/activity-heatmap/index.tsx` (`"use client"`) — consumes `initialData: HeatmapPayload`; calls `useActivityHeatmap` (T016); renders header counter `"{totals.jobs} jobs · {totals.shippedTickets} tickets shipped in {meta.label}"` (FR-007); renders `<HeatmapGrid>` + `<HeatmapLegend>`. Depends on T016, T019, T021
- [ ] T023 [US1] Wire heatmap into the projects page in `app/projects/page.tsx` — server-side call to `getActivityHeatmap({ userId, filters: { period: { kind: 'last-12-months' }, agent: 'all', timezone: 'UTC' } })`, wrapped in try/catch returning an empty-payload shape on failure (research §P4, §D12). Render `<ActivityHeatmap initialData={payload} />` beneath `<ProjectsContainer>`. Relax `max-h-[calc(100vh-200px)] overflow-y-auto` on the project grid if it prevents scrolling to the heatmap (FR-001). Depends on T012, T022

**Checkpoint**: `/projects` renders a fully functional default-view heatmap on first paint with no spinner flash. Hover tooltips, header counter, and empty-state all work. No filters yet.

---

## Phase 4: User Story 2 - Drill into a specific year or agent (Priority: P2)

**Goal**: Year selector and agent filter refine the heatmap, the URL reflects the selection, and copying the URL into a new tab reproduces the same view on first paint. Agent filter is hidden when the user has fewer than two distinct effective agents.

**Independent Test**: As a user with multi-year activity and ≥2 distinct agents, change the year selector to a past year and the agent filter to a specific agent. Confirm: (a) grid boundaries match the selected calendar year (chipped corners at start/end as applicable — FR-005); (b) header counter recomputes; (c) URL contains `?period=YYYY&agent=AGENT`; (d) copying the URL into a fresh browser session reproduces the exact view on first paint with no spinner (SC-005). Also verify the filter is hidden entirely for a user whose data has ≤1 distinct effective agent.

### Tests for User Story 2

- [ ] T024 [P] [US2] Extend `tests/unit/components/activity-heatmap.test.tsx` (created in T017) with filter-interaction assertions: year selector `router.push('?period=2025', { scroll: false })` (research §P3 — `{ scroll: false }` is mandatory); agent selector `router.push('?agent=CLAUDE', { scroll: false })`; agent filter hidden when `distinctAgents.length < 2` (FR-012, SC-003); year-selector options match `availableYears` in descending order with "Last 12 months" first; year group hidden when `availableYears.length === 1` (FR-009)

### Implementation for User Story 2

- [ ] T025 [P] [US2] Implement `HeatmapFilters` in `components/projects/activity-heatmap/heatmap-filters.tsx` — two shadcn `Select` controls: period (options: "Last 12 months" + each year from `availableYears` descending) and agent (options: "All" + one per `distinctAgents`, using `AGENT_LABELS` from `app/lib/utils/agent-resolution.ts`). Each `onValueChange` calls `router.push(newUrl, { scroll: false })` using `useSearchParams` + `useRouter` from `next/navigation` (research §P3). Agent `<Select>` is rendered only when `distinctAgents.length >= 2`. Year `<Select>` is rendered only when `availableYears.length >= 2` (FR-009)
- [ ] T026 [US2] Wire filter state into `components/projects/activity-heatmap/index.tsx` — read `period`, `agent` from `useSearchParams`; coerce into `HeatmapFilters`; feed to `useActivityHeatmap` so the hook only reuses `initialData` when the URL filters match the SSR filters (research §P2); render `<HeatmapFilters filters={filters} distinctAgents={payload.distinctAgents} availableYears={payload.availableYears} />` above the grid. Depends on T022, T025
- [ ] T027 [US2] Extend `app/projects/page.tsx` (modified in T023) to parse `searchParams` via the `getSearchParamValue(value, allowList, default)` helper pattern from `app/projects/[projectId]/analytics/page.tsx:49-78` (research §P5): validate `period` against `['last-12-months', ...availableYears]`, `agent` against `['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']`, and `tz` against `Intl.supportedValuesOf('timeZone')` when available; invalid values silently fall back to defaults. Pass resolved filters to `getActivityHeatmap` so URL-driven SSR renders the requested view on first paint (FR-015, FR-017)

**Checkpoint**: Filter UI works end-to-end, URL round-trips preserve state on first paint, agent filter visibility honours `distinctAgents.length`, year selector honours `availableYears.length`.

---

## Phase 5: User Story 3 - Use the heatmap on mobile (Priority: P3)

**Goal**: Mobile users can scroll the grid horizontally with day-of-week labels pinned to the left edge; tapping a cell shows its tooltip; tapping outside dismisses it. No wrap, no cell shrink below tappable size.

**Independent Test**: Open `/projects` on a mobile viewport (≤ 480 px). Confirm: (a) cells ≥ 14×14 CSS pixels and the grid scrolls horizontally rather than wrapping (SC-007); (b) day-of-week labels remain visible while scrolling horizontally (FR-021); (c) tapping a cell opens its tooltip, tapping outside dismisses it (FR-011).

### Tests for User Story 3

- [ ] T028 [P] [US3] Extend `tests/unit/components/activity-heatmap.test.tsx` (created in T017, extended in T024) with mobile interactions: tap opens tooltip (shadcn `Popover` triggered via tap on `Tooltip`-equivalent), tap-outside dismisses it (FR-011)

### Implementation for User Story 3

- [ ] T029 [US3] Update `components/projects/activity-heatmap/heatmap-grid.tsx` (created in T021) to wrap the weeks grid in shadcn `ScrollArea` (horizontal overflow) while rendering the day-of-week label column OUTSIDE the scroll viewport so labels stay pinned without relying on `position: sticky` inside the Radix ScrollArea viewport (research §D8). Enforce min cell size `w-[14px] h-[14px]` at mobile breakpoints to satisfy SC-007
- [ ] T030 [US3] Update `components/projects/activity-heatmap/heatmap-tooltip.tsx` (created in T020) to add tap-to-open / tap-outside-to-dismiss behavior — promote to a `Popover` on touch viewports (or mirror the existing shadcn tap pattern) so `onPointerDownOutside` dismisses the tooltip (FR-011)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation of the three browser-bound success criteria, plus final documentation and cleanup.

- [ ] T031 [P] Create Playwright E2E spec in `tests/e2e/projects/activity-heatmap.spec.ts` covering ONLY the three genuinely browser-bound success criteria: SC-001 (first-paint has shaded cells; no `[role="progressbar"]` / skeleton visible at any frame), SC-005 (`?period=2025&agent=CLAUDE` in a fresh session renders the filtered view on first paint), SC-007 (mobile viewport: cells ≥ 14×14 CSS px, grid container has `overflow-x: auto`, day-of-week labels visible after horizontal scroll). Seed projects/tickets with `[e2e]` prefix against a reserved test user (research §P10; CLAUDE.md Test Environment)
- [ ] T032 Manual accessibility sweep of the new components: cell `aria-label` (date + job count), filter `<Select>`s labelled, legend swatches `aria-hidden` decorative, tooltip readable by screen readers. Ensure violet gradient stays ≥ 4.5:1 contrast on dark theme (FR-004, CLAUDE.md Colors)
- [ ] T033 Run `bun run type-check` and `bun run lint` against the feature branch; fix any errors including pre-existing ones that the commit hook surfaces (CLAUDE.md Commit Rules)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** → no deps; can start immediately
- **Phase 2 (Foundational)** → depends on Phase 1; BLOCKS all user stories
- **Phase 3 (US1, P1)** → depends on Phase 2
- **Phase 4 (US2, P2)** → depends on Phase 2; integrates with US1 (shares `index.tsx`, `page.tsx`) but delivers an independently testable filter surface
- **Phase 5 (US3, P3)** → depends on Phase 3 (modifies `heatmap-grid.tsx` and `heatmap-tooltip.tsx` from US1); independently testable on a mobile viewport
- **Phase 6 (Polish)** → depends on all user stories intended for release

### Within each user story

- Tests FIRST — must FAIL before implementation (constitution III)
- Pure helpers before components that consume them
- Leaf components (legend, tooltip, cell-class helper) before container components (grid, index)
- Page wiring LAST within each story

### Parallel opportunities

- **Phase 1**: T001–T004 all parallel (different directories)
- **Phase 2**: T005 ∥ T006 (types vs query-keys, different files). After T005, T007–T012 must be sequential (all edit `lib/analytics/heatmap-queries.ts`). T013 (unit tests) parallel with T014 (API route). T016 (hook) parallel with T015 (integration tests)
- **US1**: T017 (tests) ∥ T018 ∥ T019 ∥ T020 are all parallel (different files). Then T021 → T022 → T023 sequentially
- **US2**: T024 ∥ T025 parallel. Then T026 → T027 sequentially
- **US3**: T028 (tests) parallel with T029 + T030 which touch different files and can also run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all independent US1 kick-off tasks together:
Task: "Create RTL tests for heatmap UI in tests/unit/components/activity-heatmap.test.tsx"    # T017
Task: "Create cell-intensity helper in components/projects/activity-heatmap/heatmap-grid.tsx" # T018
Task: "Create HeatmapLegend in components/projects/activity-heatmap/heatmap-legend.tsx"       # T019
Task: "Create HeatmapTooltip in components/projects/activity-heatmap/heatmap-tooltip.tsx"     # T020
```

## Parallel Example: Foundational

```bash
# Launch both low-level scaffolding files together:
Task: "Create payload types in lib/analytics/heatmap-types.ts"                                # T005
Task: "Add activityHeatmap query-keys namespace in app/lib/query-keys.ts"                     # T006
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (unblocks everything)
3. Complete Phase 3: User Story 1 (default-view heatmap with SSR initial data)
4. **STOP & VALIDATE** — user sees their activity on first paint; no filters yet
5. Ship the MVP

### Incremental delivery

1. Foundation → API + hook green
2. US1 → default heatmap renders (MVP)
3. US2 → filters + URL round-trip land
4. US3 → mobile polish
5. Polish → E2E + type-check/lint gate

### Parallel execution strategy

After Phase 2 completes, US1 delivers the visible surface first (blocks US2's container wiring). US2 and US3 can then proceed in the order above — US3 can technically begin after US1 lands even while US2 is in flight, since they modify different files within `heatmap-grid.tsx`/`heatmap-tooltip.tsx` (US3) vs `index.tsx`/`heatmap-filters.tsx`/`page.tsx` (US2), but merge carefully since `heatmap-grid.tsx` is touched by T021 (US1) then T029 (US3).

---

## Notes

- [P] = different files, no unresolved dependencies
- Every task cites an exact file path validated against the current working tree
- Test files chosen per constitution III: new files created where no existing coverage overlaps; `research.md §Tests to extend` explicitly justifies not extending `analytics-route.test.ts`, `analytics-dashboard.test.tsx`, `projects-with-health.test.ts`, or `comparison-compliance-heatmap.test.tsx`
- All client Tailwind classes are literal strings (CLAUDE.md Tailwind Classes rule, research §P7)
- Heatmap ship-counting is a deliberate divergence from `COMPLETED_TICKET_STAGES` — comment in `heatmap-queries.ts` must cite FR-008 (research §P6)
- No new DB models, no schema migration, no new runtime dependency (FR-022)
- All tasks are directly executable by an LLM agent without additional context
