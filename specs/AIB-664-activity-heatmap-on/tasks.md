# Tasks: Activity Heatmap on Projects Page (AIB-664)

**Input**: Design documents from `/specs/AIB-664-activity-heatmap-on/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/heatmap-api.md

**Tests**: Test tasks INCLUDED per constitution (III). Pure aggregations → Vitest unit; DB/API → Vitest integration; component → Vitest + RTL. Playwright only if the no-spinner-flash assertion cannot be made at component level.

**Organization**: Tasks are grouped by user story (US1…US5) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Parallelizable (different files, no dependency on other incomplete tasks)
- **[Story]**: US1, US2, US3, US4, US5

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies or tooling; this phase only creates the `lib/heatmap/` module folder and test folder skeletons so subsequent tasks have a home.

- [X] T001 ✅ DONE Create directory `lib/heatmap/` at `/home/runner/work/ai-board/ai-board/target/lib/heatmap/` (will hold `queries.ts`, `aggregations.ts`, `types.ts`)
- [X] T002 ✅ DONE [P] Create directory `tests/integration/heatmap/` at `/home/runner/work/ai-board/ai-board/target/tests/integration/heatmap/` (will hold `heatmap-route.test.ts`, `heatmap-queries.test.ts`)
- [X] T003 ✅ DONE [P] Verify no Prisma migration is required (FR-018) by confirming `prisma/schema.prisma` already exposes `Job.completedAt`, `Job.command`, `Job.costUsd`, `Ticket.agent`, `Project.defaultAgent`, `User.createdAt`; no task-level action needed if all fields present — record finding in PR description

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared building blocks required by every user story — types, pure aggregations, the authorization helper, the query layer, and the API route. All user stories consume these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Types

- [X] T004 ✅ DONE Create TypeScript types in `lib/heatmap/types.ts` per `data-model.md` §Derived Read Types: `HeatmapPeriod`, `HeatmapAgentFilter`, `HeatmapFilters`, `HeatmapDayCell`, `HeatmapAgentOption`, `HeatmapPeriodOption`, `HeatmapData`

### Pure aggregations (TDD — tests first)

- [X] T005 ✅ DONE [P] Create `tests/unit/heatmap-aggregations.test.ts` covering: `getPeriodBounds` for `last-12-months` and specific years (including leap year 2024), `buildPeriodOptions` when `createdAt.getFullYear() === currentYear` (single option) and earlier years (descending), `computeIntensityThresholds` for all-zero / single-day / uniform / skewed distributions, `getIntensityLevel` boundary inclusiveness (quartile edges), `getIntensityClass` returns complete literal strings, `formatHeaderCopy` wording variants ("in the last year" vs "in 2024")
- [X] T006 ✅ DONE Create `lib/heatmap/aggregations.ts` implementing pure functions per `plan.md` §Phase A: `getPeriodBounds(period, userCreatedAt, now)`, `buildPeriodOptions(userCreatedAt, now)`, `computeIntensityThresholds(nonZeroDailyCounts)`, `getIntensityLevel(count, thresholds)`, `getIntensityClass(level)` (returns one of 5 literal Tailwind strings per `research.md` Pattern 5), `formatHeaderCopy(period, totals)`; must make T005 pass

### Authorization helper (extracted from existing clause)

- [X] T007 ✅ DONE Extend `lib/db/projects.ts` by adding exported `getAccessibleProjectIdsForUser(userId: string): Promise<number[]>` using the same `{ OR: [{ userId }, { members: { some: { userId } } }] }` clause already present in `getUserProjects` — do NOT modify `getUserProjects` behaviour
- [X] T008 ✅ DONE Create `tests/integration/projects/accessible-ids.test.ts` verifying `getAccessibleProjectIdsForUser` returns project ids where the user is owner OR member, and excludes projects where they are neither

### Query layer

- [X] T009 ✅ DONE Create `tests/integration/heatmap/heatmap-queries.test.ts` covering data-model.md rules 1–9: access scoping (seed a job on a project the user is NOT a member of and assert its absence), effective-agent resolution via `ticket.agent ?? project.defaultAgent`, cost null-safety (all-null day → `totalCost === null`, mixed → sum of non-null), ship counting (DISTINCT on `ticketId`, excludes `status=FAILED` ship jobs), period bounds with leap year, `availableAgents` computed from UNFILTERED dataset, grid boundaries unchanged when agent filter is applied, intensity thresholds as quartiles
- [X] T010 ✅ DONE Create `lib/heatmap/queries.ts` exporting `getHeatmapData(userId, filters): Promise<HeatmapData>` per `plan.md` §Phase C: resolve `user.createdAt`, call `getAccessibleProjectIdsForUser`, derive period bounds, run single `prisma.job.findMany` over accessible project ids with `completedAt` in `[startDate, endDate]` selecting `{ completedAt, command, status, costUsd, ticketId, ticket: { agent, project: { defaultAgent } } }`, bucket by date in server TZ, compute `availableAgents` from UNFILTERED data, apply agent filter LAST via `resolveEffectiveAgent` from `app/lib/utils/agent-resolution.ts`, compute distinct `shippedTicketCount` per day (command='ship' AND status=COMPLETED), compute null-safe `totalCost`, compute `intensityThresholds`, build contiguous `days[]` from Sunday gridStart to Saturday gridEnd with `inPeriod` flag; must make T009 pass

### API route

- [X] T011 ✅ DONE Create `tests/integration/heatmap/heatmap-route.test.ts` implementing the 14-scenario test matrix in `contracts/heatmap-api.md` (default call, specific year, invalid period silent fallback, year before account, agent filter, invalid agent silent fallback, access scoping, ship-FAILED excluded, cost null, mixed cost, leap year 2024 → 366 in-period days, empty data, 1-agent user → `availableAgents === []`, unauthenticated → 401)
- [X] T012 ✅ DONE Create `app/api/heatmap/route.ts` GET handler per `plan.md` §Phase D: Zod schema with `period: z.string().regex(/^(last-12-months|\d{4})$/).catch('last-12-months')` and `agent: z.enum(['all', ...ALL_AGENTS]).catch('all')`, `requireAuth(request)` → userId, call `getHeatmapData`, return `NextResponse.json`; error branches: `Error.message === 'Unauthorized'` → 401, else `console.error` + 500 (no 400/403/404 branches per contract); must make T011 pass

### Query keys

- [X] T013 ✅ DONE Extend `app/lib/query-keys.ts` by adding `heatmap: { data: (period: string, agent: string) => ['heatmap', period, agent] as const }` alongside the existing `analytics` keys

**Checkpoint**: Foundation ready — every user story below depends on T004, T006, T007, T010, T012, T013.

---

## Phase 3: User Story 1 — Glance at recent AI activity (Priority: P1) 🎯 MVP

**Goal**: Authenticated user on `/projects` sees a heatmap of jobs over the last 12 months, server-rendered with no loading spinner flash; header reads "X jobs · Y tickets shipped in the last year".

**Independent Test**: Load `/projects` as an authenticated user with ≥1 job in the last year; verify heatmap renders immediately (no spinner flash), header shows correct job count, and cells show a violet gradient where activity occurred.

### Tests for User Story 1

- [ ] T014 [P] [US1] Create `tests/unit/components/activity-heatmap.test.tsx` with initial-data render case (renders cells from `initialData` without fetching, no spinner), header-copy assertion matching `formatHeaderCopy('last-12-months', totals)`, and empty-state substitution when `data.totals.jobCount === 0` (FR-015) — the file will be extended in later stories; no existing component test covers this domain so new file is justified

### Implementation for User Story 1

- [ ] T015 [US1] Create `components/projects/activity-heatmap.tsx` (Client Component, `'use client'`) per `plan.md` §Phase E: props `{ initialData: HeatmapData; userCreatedYear: number }`, `useQuery({ queryKey: queryKeys.heatmap.data(filters.period, filters.agent), queryFn: () => fetch('/api/heatmap?...'), initialData: shouldUseInitialData ? initialData : undefined, refetchInterval: 15000, staleTime: 10000 })`, render header via `formatHeaderCopy`, render CSS grid with `grid-rows-7 grid-flow-col auto-cols-max`, cells positioned deterministically by `dayOfWeek` and `weekIndex` (out-of-period cells omitted → chipped corners), month labels row, day-of-week labels column, 5-step legend "Less □□□□■ More" with `getIntensityClass(level)` for each swatch, empty-state swap when `data.totals.jobCount === 0`
- [ ] T016 [US1] Extend `app/projects/page.tsx` per `plan.md` §Phase F: parse `period`/`agent` from `searchParams` with the same permissive coercion as the route, resolve authenticated user id (mirror existing auth pattern used for `getUserProjects()`), `await getHeatmapData(userId, filters)`, compute `userCreatedYear = new Date(user.createdAt).getFullYear()`, render `<ActivityHeatmap initialData={...} userCreatedYear={...} />` inside a `<section className="mt-8">` below `<ProjectsContainer />`

**Checkpoint**: MVP — `/projects` renders a working heatmap with the default "Last 12 months" period and no agent filter interaction.

---

## Phase 4: User Story 2 — Explore a specific calendar year (Priority: P2)

**Goal**: User can pick a calendar year from the period selector; grid snaps to Jan 1–Dec 31 of that year with chipped corners; selection persists in URL.

**Independent Test**: Test user with jobs in ≥2 calendar years opens the period selector, picks a past year; grid boundaries match that year, URL reflects `?period=YYYY`, reloading preserves the selection.

### Tests for User Story 2

- [ ] T017 [P] [US2] Extend `tests/unit/components/activity-heatmap.test.tsx` (from T014) with: period selector lists "Last 12 months" + descending years from `userCreatedYear` to current year, selecting a year calls `router.push('?period=YYYY', { scroll: false })` and triggers a fetch for that period, URL-arrival with `?period=2024` renders the 2024 grid from `useSearchParams`, user whose `createdAt` is in current year sees only "Last 12 months" (single option or disabled)
- [ ] T018 [P] [US2] Extend `tests/integration/heatmap/heatmap-route.test.ts` (from T011) only if the test matrix rows #2 (specific year), #4 (year before account), and #11 (leap year) are not already asserted — skip if T011 already covers them per contract

### Implementation for User Story 2

- [ ] T019 [US2] In `components/projects/activity-heatmap.tsx` (extending T015), add the period `<Select>` (shadcn/ui) populated from `data.periodOptions`, wire `updateFilters({ period: next })` to `setFilters` + `router.push('?period=...&agent=...', { scroll: false })`, and update header copy via `formatHeaderCopy(filters.period, totals)` so it reads "… in 2024" when a year is selected
- [ ] T020 [US2] Verify `buildPeriodOptions` (already implemented in T006) handles the `createdAt.getFullYear() === currentYear` case by returning only `[{ value: 'last-12-months', isDefault: true }]`; add the test case in T005 if missing — no additional implementation if T006 already conforms

**Checkpoint**: Period selection and URL round-trip work independently of the agent filter.

---

## Phase 5: User Story 3 — Filter activity by agent (Priority: P2)

**Goal**: User with jobs across ≥2 distinct effective agents sees an agent `<Select>` with "All" default; selecting an agent updates cells and header counts without changing grid boundaries; selection persists in URL; filter is hidden when ≤1 distinct agent.

**Independent Test**: Seed user with jobs across two agents. Verify filter appears, default "All", selecting a specific agent updates cells and header, filter persists in URL. Separately seed a user with a single agent; verify filter is hidden.

### Tests for User Story 3

- [ ] T021 [P] [US3] Extend `tests/unit/components/activity-heatmap.test.tsx` (from T014) with: agent filter hidden entirely when `data.availableAgents.length === 0` (FR-008, US3 scenario 2), agent filter visible with "All" + one option per agent when `availableAgents.length >= 1`, selecting an agent calls `router.push('?period=...&agent=CLAUDE', { scroll: false })` and triggers a fetch, URL-arrival with `?agent=CLAUDE` applies the filter on mount, grid column count unchanged across agent filter toggle
- [ ] T022 [P] [US3] Extend `tests/integration/heatmap/heatmap-route.test.ts` (from T011) only if test matrix rows #5 (agent filter), #6 (invalid agent), #13 (1-agent user → `availableAgents===[]`) are not already asserted — skip if T011 already covers them

### Implementation for User Story 3

- [ ] T023 [US3] In `components/projects/activity-heatmap.tsx` (extending T015/T019), add the agent `<Select>` rendered conditionally on `data.availableAgents.length > 0`, options built from `[{value:'all', label:'All'}, ...data.availableAgents]`, wire `updateFilters({ agent: next })` to push `?period=...&agent=...` to the URL; confirm grid and period boundaries are unaffected by agent changes (only cell intensities and header counts change — implementation in T010 already guarantees boundaries remain stable)

**Checkpoint**: Agent filter works end-to-end with URL sync; combined with US2 gives the full filter surface.

---

## Phase 6: User Story 4 — Inspect a specific day (Priority: P3)

**Goal**: Hovering (desktop) or tapping (mobile) a non-empty cell opens a tooltip showing formatted date, job count, shipped ticket count, and summed cost (cost line omitted when `totalCost === null`); mobile taps outside dismiss.

**Independent Test**: Hover a non-empty cell on desktop and tap on mobile; verify tooltip shows correct lines; on a day with no recorded cost verify cost line is absent (never "$NaN"/"$0"); tap outside dismisses on mobile.

### Tests for User Story 4

- [ ] T024 [P] [US4] Extend `tests/unit/components/activity-heatmap.test.tsx` (from T014) with: tooltip opens on hover over a cell with `jobCount > 0`, tooltip body shows formatted date + job count + shipped ticket count, cost line present when `totalCost !== null` and formatted with 2 decimals + `$` prefix, cost line omitted entirely when `totalCost === null` (assert via absence of the cost DOM node — never "$NaN" or "$0"), mobile: click (pointerdown) on a cell opens tooltip, pointerdown outside the cell ref closes tooltip (controlled `open`/`onOpenChange` pattern)

### Implementation for User Story 4

- [ ] T025 [US4] Decide inline-vs-extracted cell rendering per constitution II: if `components/projects/activity-heatmap.tsx` exceeds ~300 lines or the cell needs its own tooltip state, create `components/projects/activity-heatmap-cell.tsx` with props `{ cell: HeatmapDayCell }`, Radix `Tooltip` primitives from `components/ui/tooltip.tsx`, controlled `open`/`onOpenChange` state, `useEffect` listening to `document` `pointerdown` for outside-tap dismiss on mobile, and render: formatted date line, `"<N> jobs"`, `"<M> tickets shipped"` (omitted if 0), `"$X.XX"` (omitted entirely when `cell.totalCost === null`) — otherwise implement tooltip inline in `activity-heatmap.tsx`

**Checkpoint**: Tooltips convey per-day detail with the cost-null guarantee; cost never renders as "$NaN" or "$0".

---

## Phase 7: User Story 5 — View comfortably on mobile (Priority: P3)

**Goal**: At viewports ≤375px, grid scrolls horizontally (no wrap, no sub-tappable cells), day-of-week column stays pinned on left during scroll, page scrolls naturally to reveal the heatmap (no inner `overflow-y` trap).

**Independent Test**: Open `/projects` at ~375px viewport; verify horizontal scroll works, day-of-week labels remain visible pinned left, cells remain tappable size, and the heatmap is reachable via natural page scroll.

### Tests for User Story 5

- [ ] T026 [P] [US5] Extend `tests/unit/components/activity-heatmap.test.tsx` (from T014) with: day-of-week labels column uses `sticky left-0 z-10 bg-background` classes, grid wrapper uses `overflow-x-auto` (or equivalent) and does not shrink cells below the chosen minimum tappable size (assert class list or computed min-width), grid never wraps (no `flex-wrap` or grid `auto-rows-min` that would cause row wrap)

### Implementation for User Story 5

- [ ] T027 [US5] In `components/projects/activity-heatmap.tsx` (extending T015), confirm grid wrapper has `overflow-x-auto`, the day-of-week column has `sticky left-0 z-10 bg-background`, cells use a fixed minimum size meeting SC-007 tap target (e.g. `w-3 h-3 md:w-3.5 md:h-3.5` or project-equivalent tap-sized values — never dynamic Tailwind class construction per CLAUDE.md)
- [ ] T028 [US5] Inspect `components/projects/projects-container.tsx`: if it sets `overflow-y-*` or a `max-h-*` that traps the page scroll and prevents the heatmap below from being reachable, relax it to `overflow-visible` (FR-017); otherwise leave untouched. Document the observation (either "adjusted" or "no change required") in the PR description

**Checkpoint**: All 5 user stories complete, mobile experience validated.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting quality, documentation, and performance checks that span all stories.

- [ ] T029 [P] Run `bun run type-check` and fix any TypeScript errors introduced (strict mode, no `any`)
- [ ] T030 [P] Run `bun run lint` and fix any ESLint errors introduced
- [ ] T031 [P] Verify no hex/rgb color literals in `components/projects/activity-heatmap.tsx` or `components/projects/activity-heatmap-cell.tsx` (CLAUDE.md); verify `getIntensityClass` returns only complete literal strings (no dynamic class construction)
- [ ] T032 [P] Verify all 20 functional requirements (FR-001…FR-020) and 8 success criteria (SC-001…SC-008) from `spec.md` are covered by at least one test in the suite; add missing coverage if gaps exist
- [ ] T033 Conditionally create `tests/e2e/projects-heatmap.e2e.ts` ONLY IF the no-spinner-flash guarantee (SC-001) cannot be asserted reliably in the component test T014; if added, use `[e2e]` prefix for seeded project/ticket names per CLAUDE.md. Skip this task if component-level assertion is sufficient and record the rationale in the PR
- [ ] T034 Verify p95 server-render time target (< 200ms at 10k-job scale) is not regressed; if measured breach, log a follow-up ticket to add `@@index([completedAt])` on `Job` (deferred per `data-model.md` §Indexes — no migration in this ticket)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories. Within Phase 2: T004 precedes T005–T013; T005 precedes T006; T006 precedes T010; T007 precedes T010 (queries call the helper); T009 precedes T010; T010 precedes T011/T012; T013 is independent once T004 is done.
- **Phase 3 (US1 / MVP)**: Depends on Phase 2 (T004, T006, T010, T012, T013). T014 precedes T015; T015 precedes T016.
- **Phase 4 (US2)**: Depends on Phase 3 T015 (extends the component); T017/T018 precede T019/T020.
- **Phase 5 (US3)**: Depends on Phase 3 T015; T021/T022 precede T023. Can run in parallel with Phase 4 in separate commits/branches, but both modify `activity-heatmap.tsx` so coordinate merges.
- **Phase 6 (US4)**: Depends on Phase 3 T015; T024 precedes T025.
- **Phase 7 (US5)**: Depends on Phase 3 T015; T026 precedes T027/T028.
- **Phase 8 (Polish)**: Depends on all intended user stories being complete.

### Within Each User Story

- Tests MUST be written and observed to FAIL before the corresponding implementation task.
- Types (Phase 2) before queries; queries before routes; routes before client components that call them.
- Story checkpoint must pass before moving to next priority.

### Parallel Opportunities

- T002, T003 can run in parallel with each other (Phase 1).
- T005, T007, T013 can run in parallel after T004 lands (Phase 2, independent files).
- T008 can run in parallel with T005/T006 once T007 is merged.
- T009 can run in parallel with T005/T006/T007/T008 (different files).
- T011 can be drafted in parallel with T010 but exercises the full route so it's observed to fail until T012 lands.
- User Stories 2, 3, 4, 5 all extend `components/projects/activity-heatmap.tsx` after US1 MVP lands, so their *implementation* tasks are serialized on that file even though *test* tasks (T017, T021, T024, T026) can be drafted in parallel.
- T029–T032 in Phase 8 are all parallelizable.

---

## Parallel Example: Phase 2 Foundational

```bash
# After T004 is merged, launch these in parallel:
Task: "Write unit tests for pure aggregations in tests/unit/heatmap-aggregations.test.ts" (T005)
Task: "Extend lib/db/projects.ts with getAccessibleProjectIdsForUser helper" (T007)
Task: "Extend app/lib/query-keys.ts with heatmap.data key" (T013)

# After T007 is merged:
Task: "Add accessible-ids integration test in tests/integration/projects/accessible-ids.test.ts" (T008)
Task: "Write integration tests for query layer in tests/integration/heatmap/heatmap-queries.test.ts" (T009)
```

## Parallel Example: Tests across stories (after MVP ships)

```bash
# All test extensions touch the SAME file tests/unit/components/activity-heatmap.test.tsx,
# so they must be serialized. But their integration-level companions are independent:
Task: "Write route tests (matrix rows 2, 4, 11) if missing" (T018)
Task: "Write route tests (matrix rows 5, 6, 13) if missing" (T022)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013.
3. Complete Phase 3 (US1) — T014 → T015 → T016.
4. **STOP and VALIDATE**: open `/projects`, confirm heatmap renders with real data, no spinner flash, header count is accurate. Ship MVP.

### Incremental Delivery

After MVP:
1. US2 (T017–T020) → year selection works, URL round-trips.
2. US3 (T021–T023) → agent filter visible when ≥2 agents, hidden when ≤1.
3. US4 (T024–T025) → tooltips with cost-null guarantee.
4. US5 (T026–T028) → mobile horizontal scroll + sticky day-of-week column.
5. Polish (T029–T034) → type-check/lint/color-audit/FR-coverage/perf check.

### Parallel Execution Strategy

- Foundational phase is mostly sequential by nature (types → aggregations → queries → route) but T005/T007/T013 fan out after T004.
- Post-MVP, component test extensions (T017, T021, T024, T026) can all be drafted in parallel; corresponding component changes (T019, T023, T025, T027) must serialize on `activity-heatmap.tsx` merges.

---

## Notes

- [P] = different files, no dependency on other incomplete tasks.
- [Story] label maps task to user story (US1…US5) for traceability.
- Every test task MUST be observed to FAIL before its implementation lands (constitution III).
- No new Prisma migration anywhere in this feature (FR-018).
- No hex/rgb color literals; `getIntensityClass` returns literal Tailwind strings (CLAUDE.md).
- All query params Zod-validated with `.catch(default)` so the route never 400s on filter values (contract).
- Authorization clause is NEVER inlined in new code — always call `getAccessibleProjectIdsForUser` (plan §Phase B / research §Pattern 4).
- Commit after each task or logical group; verify `bun run type-check` and `bun run lint` pass before each commit.
