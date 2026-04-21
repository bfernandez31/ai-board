---
description: "Task list for AIB-704 — Activity Heatmap on Projects Page"
---

# Tasks: Activity Heatmap on Projects Page (AIB-704)

**Input**: Design documents from `/specs/AIB-704-activity-heatmap-on/`
**Prerequisites**: `plan.md` ✅, `spec.md` ✅, `research.md` ✅, `data-model.md` ✅, `contracts/heatmap-api.md` ✅

**Tests**: Included by default (Constitution III). Not skipped.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and shipped independently. User Stories 1, 2, and 3 are all P1 and together form the MVP; US4/US5/US6 are additive.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on uncompleted tasks)
- **[Story]**: US1–US6 map to the user stories in `spec.md`
- Every task includes an exact file path

## Path Conventions

Single-project Next.js App Router monorepo (see `plan.md` § Project Structure). Source under `app/`, `lib/`, `components/`, `hooks/`. Tests under `tests/unit/` and `tests/integration/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare scaffolding shared by every user story phase.

- [X] T001 [P] Create directory `lib/heatmap/` with an empty `.gitkeep` (or ensure it exists before files land) — new module root for pure helpers, types, and server queries ✅ DONE
- [X] T002 [P] Create directory `app/api/projects/activity-heatmap/` (route module root; currently absent — confirmed via `ls` during task generation) ✅ DONE
- [X] T003 [P] Create directory `tests/unit/heatmap/` for pure-function unit tests (period, buckets) ✅ DONE
- [X] T004 [P] Create directory `tests/unit/components/projects/` for heatmap component tests (currently absent under `tests/unit/components/`) ✅ DONE
- [X] T005 [P] Create directory `tests/integration/heatmap/` for the new API route integration test ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types and query-key registration that every downstream task (API route, hook, components, tests) depends on.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [X] T006 Create heatmap types in `lib/heatmap/types.ts` — export `HeatmapPeriodKey`, `HeatmapPeriodParam`, `HeatmapFilters`, `HeatmapDay`, `ShippedTicket`, `HeatmapAgentOption`, `HeatmapData` per `data-model.md` §2 (re-use `AgentFilter`/`NamedAgent` from `lib/analytics/types.ts`; do NOT redefine) ✅ DONE
- [X] T007 Extend `app/lib/query-keys.ts` — add `queryKeys.projects.activityHeatmap(periodParam: string, agent: AgentFilter)` returning `['projects', 'activity-heatmap', periodParam, agent] as const` (projects-scoped, user-implicit) ✅ DONE
- [X] T008 [P] Create pure-function helpers in `lib/heatmap/period.ts` — export `parsePeriodParam(raw, joinYear, now)`, `serializePeriodParam(period)`, `resolvePeriod(period, joinYear, now)`, `getPeriodBoundaries(period, now)` returning `{ startDate, endDate, label }`, `enumerateYearsSinceJoin(joinYear, now)`. No Prisma/React imports. Clamp `endDate <= now` (Decision 12). Invalid param → fallback to default `{ kind: 'rolling', months: 12 }` (contract invariant #10). ✅ DONE
- [X] T009 [P] Create pure-function helpers in `lib/heatmap/buckets.ts` — export `computeIntensityThresholds(nonZeroCounts: number[]): { t1, t2, t3, t4 }` (p50/p75/p90 rounded up, monotonic, degenerate-safe per Decision 5) and `bucketFor(count, thresholds): 0 | 1 | 2 | 3 | 4` (uses `>=` boundaries per invariant #7) ✅ DONE

**Checkpoint**: Types, query keys, and pure helpers ready → user story phases can proceed.

---

## Phase 3: User Story 1 — See my AI activity at a glance (Priority: P1) 🎯 MVP

**Goal**: On `/projects`, below the project cards, render a yearly heatmap of the viewer's AI activity across owned + member projects. First paint shows populated cells with no spinner (server-hydrated). Header counter reads "N jobs · M tickets shipped in the last year".

**Independent Test**: Sign in as a user with prior activity, load `/projects`, scroll past the cards grid, and verify the heatmap appears populated on first paint. Header counter reflects real totals. A user with zero activity sees the empty-state message while the layout (legend) remains.

### Tests for User Story 1

**NOTE**: Write tests FIRST, ensure they FAIL before implementation. Extend existing files where the domain is already covered; create new files only when no existing file covers the domain (Constitution III).

- [X] T010 [P] [US1] Create bucket-math tests in `tests/unit/heatmap/buckets.test.ts` — cover `computeIntensityThresholds` (percentile-derived, degenerate distributions: all-zero, single value, all equal, extreme skew) and `bucketFor` (boundary equality, level 0 for count=0). No existing file covers this domain. ✅ DONE
- [X] T011 [P] [US1] Create period-math tests in `tests/unit/heatmap/period.test.ts` — cover `resolvePeriod` rolling/year boundaries, join-year clamp (FR-015), future clamp (Decision 12), param serialize/parse round-trip (invariant #10). No existing file covers this domain. ✅ DONE
- [X] T012 [P] [US1] Create API integration test in `tests/integration/heatmap/heatmap-route.test.ts` — seed owner/member/third-party projects, assert 401 unauth, 200 empty-state shape (days length = period length, `totals.jobs === 0`, `availableAgents === []`), owner-OR-member scope enforcement, future-dated job clamp. Use seeding helpers from `tests/integration/analytics/analytics-route.test.ts` as the template (do NOT duplicate test harness). No existing file covers this domain. ✅ DONE
- [X] T013 [P] [US1] Create grid-component tests in `tests/unit/components/projects/activity-heatmap-grid.test.tsx` — assert 7-row grid, chipped top-left/bottom-right corners when period doesn't start on Sunday or end on Saturday (FR-007), weekday labels (Mon/Wed/Fri) visible, month labels rendered above the grid. No existing file covers this domain. ✅ DONE
- [X] T014 [P] [US1] Create section-component tests in `tests/unit/components/projects/activity-heatmap-section.test.tsx` — assert header counter text format ("N jobs · M tickets shipped in {label}"), empty-state renders only when `agent==='all' && totals.jobs===0 && totals.ticketsShipped===0` (Decision 11), legend visible even when grid is empty (FR-010). No existing file covers this domain. ✅ DONE
- [X] T015 [US1] Extend `tests/integration/projects/projects-with-health.test.ts` — add a single test case asserting that `GET /api/projects/activity-heatmap` returns 200 with the user-scoped shape when called alongside the existing projects-page flow. Do NOT duplicate seeding into a new file (Constitution III — extend, don't duplicate). ✅ DONE

### Implementation for User Story 1

- [X] T016 [US1] Create server-side aggregation in `lib/heatmap/queries.ts` — export `getHeatmapInitialData(userId, filters): Promise<HeatmapData>`. Run reads A/B/C from `data-model.md` §4 in parallel via `Promise.all`. Reuse `buildEffectiveAgentWhere` from `lib/analytics/queries.ts` (Pattern 4) and `formatDateForGrouping(d, 'daily')` from `lib/analytics/aggregations.ts`. Enforce owner-OR-member scope (Pattern 3). Implement cost null-safety (invariant #4) and ship detection via `command='ship' && status='COMPLETED'` (Pattern 5, FR-003). Compute thresholds via `computeIntensityThresholds`; bucket per-day via `bucketFor`. Return zero-state shape on empty data — never throw. ✅ DONE
- [X] T017 [US1] Create API route in `app/api/projects/activity-heatmap/route.ts` — `GET` handler. Declare `export const dynamic = 'force-dynamic'` and `export const revalidate = 0`. Call `requireAuth(request)` from `lib/db/users.ts`. Validate with Zod (`agent` closed enum → 400 on invalid; bad `period` silently falls back). Mirror error-handling template from `app/api/projects/[projectId]/analytics/route.ts:36-49` (Pattern 7). Set `Cache-Control: no-store` header on 200 response. Delegate to `getHeatmapInitialData`. ✅ DONE
- [X] T018 [P] [US1] Create client fetcher + TanStack Query hook in `hooks/use-activity-heatmap.ts` — export `fetchActivityHeatmap(filters)` that omits `period=12m` and `agent=all` from the query string (contract §Client contract), and `useActivityHeatmap(filters, initialData)` wrapping `useQuery` with `refetchInterval: 15_000`, `staleTime: 10_000`, and `initialData` gated by `filtersMatch` (Pattern 1). Use `queryKeys.projects.activityHeatmap` from T007. ✅ DONE
- [X] T019 [P] [US1] Create intensity-swatch legend component in `components/projects/activity-heatmap-legend.tsx` — client component; render "Less" → five violet aurora swatches → "More" (FR-009). Return full-literal Tailwind class strings for each swatch level (CLAUDE.md — no dynamic class construction). ✅ DONE
- [X] T020 [P] [US1] Create empty-state component in `components/projects/activity-heatmap-empty.tsx` — client component; render "No activity to show yet — your AI work will appear here" per FR-010. Style with aurora-compatible tokens (`bg-card`, `text-muted-foreground`). ✅ DONE
- [X] T021 [P] [US1] Create header component in `components/projects/activity-heatmap-header.tsx` — client component; render counter "{totals.jobs} jobs · {totals.ticketsShipped} tickets shipped in {period.label}" (FR-013). Host slot-children for period and agent selectors (added in later stories). ✅ DONE
- [X] T022 [US1] Create grid component in `components/projects/activity-heatmap-grid.tsx` — client component. Render 7-row CSS grid with columns per ISO week spanning `[period.startDate, period.endDate]`. Emit exactly `days.length` cells aligned to weekday row; render no cells before the first day or after the last day (FR-007 chipped corners). Assign intensity class via full-literal Tailwind strings for levels 0–4 (aurora violet scale). Day-of-week labels column stays left of the grid. Month labels row sits above. Depends on T006, T022 imports types; pure render — no fetching. ✅ DONE
- [X] T023 [US1] Create section container in `components/projects/activity-heatmap-section.tsx` — client component (`'use client'`). Own `filters` state (seeded from `searchParams` via `parsePeriodParam` from T008). Call `useActivityHeatmap(filters, initialData)` (T018). Compose `<ActivityHeatmapHeader>`, `<ActivityHeatmapGrid>`, `<ActivityHeatmapLegend>`, `<ActivityHeatmapEmpty>`. Render empty-state per Decision 11. No URL-sync or selectors yet — those land in US2/US4/US5. ✅ DONE
- [X] T024 [US1] Modify `components/projects/projects-container.tsx` — remove the `overflow-y-auto max-h-[calc(100vh-200px)]` wrapper (Decision 6, FR-012) so the page scrolls naturally and the heatmap is reachable beneath the cards grid. ✅ DONE
- [X] T025 [US1] Modify `app/projects/page.tsx` — make the server component `async`, await `searchParams` and `requireAuth`, then call `getHeatmapInitialData(userId, { period: { kind: 'rolling', months: 12 }, agent: 'all' })` in parallel with the existing `getUserProjects()` via `Promise.all`. Render `<ActivityHeatmapSection initialData={...} accountCreatedYear={...} />` below `<ProjectsContainer>` at full content width (FR-011). First paint must show populated grid (FR-025, SC-001). ✅ DONE

**Checkpoint**: User Story 1 fully functional — user with activity sees a populated heatmap below their project cards on first paint; user with zero activity sees the empty state. Counter reflects real totals.

---

## Phase 4: User Story 2 — Switch between a rolling year and specific calendar years (Priority: P1)

**Goal**: Period selector lets the user switch between "Last 12 months" (default) and each calendar year from account-creation year through the current year. Grid redraws with that period's boundaries.

**Independent Test**: Open `/projects`. Period selector offers "Last 12 months" plus each year from join year → now. Select a past year — grid re-renders spanning Jan 1 → Dec 31 of that year; counter updates. If account was created this year, selector is hidden (Decision 8).

### Tests for User Story 2

- [X] T026 [P] [US2] Extend `tests/unit/heatmap/period.test.ts` (existing file from T011) — add cases for `enumerateYearsSinceJoin` (reverse-chronological order, earliest = join year, latest = current year) and the "joined this calendar year ⇒ empty list" edge case (FR-015, Decision 8). Extend, don't duplicate (Constitution III). ✅ DONE
- [X] T027 [P] [US2] Extend `tests/unit/components/projects/activity-heatmap-section.test.tsx` (existing file from T014) — add cases: selector shows "Last 12 months" + each year since join (reverse chrono); changing the selector updates the fetched query key AND the `period=YYYY` URL param (US5 overlap is fine — URL assertion comes in T036); selector is absent when `accountCreatedYear === currentYear`. ✅ DONE

### Implementation for User Story 2

- [X] T028 [US2] Extend `components/projects/activity-heatmap-header.tsx` (existing file from T021) — add a period `<Select>` (shadcn `components/ui/select.tsx`) populated by `enumerateYearsSinceJoin(accountCreatedYear, now)` plus "Last 12 months" (Decision 8). Hide entirely when the enumerated list has no years (FR-015). Emit `onPeriodChange(next: HeatmapPeriodKey)`. ✅ DONE
- [X] T029 [US2] Extend `components/projects/activity-heatmap-section.tsx` (existing file from T023) — wire the header's `onPeriodChange` to update `filters.period`, which re-triggers `useActivityHeatmap`. Grid redraws with new boundaries; counter updates via the new response. URL sync is added in T036 (US5). ✅ DONE

**Checkpoint**: User Stories 1 AND 2 work together — user can switch between periods and see the grid redraw with correct boundaries and counter.

---

## Phase 5: User Story 3 — Inspect a single day without clicking through (Priority: P1)

**Goal**: Hover (pointer) or tap (touch) a cell to see a tooltip containing the formatted date, shipped tickets (by key + title), and a "N jobs · $X.XX" line — cost fragment omitted entirely when no job that day has `costUsd`.

**Independent Test**: Hover a populated cell → tooltip shows the date, any shipped tickets, and the summary line. Hover a cell with jobs but all `costUsd=null` → tooltip shows only "N jobs" (no `$NaN`, no `$0`). Tap on a touch device → tooltip shows and dismisses on outside-tap.

### Tests for User Story 3

- [X] T030 [P] [US3] Extend `tests/unit/components/projects/activity-heatmap-grid.test.tsx` (existing file from T013) — add cases using RTL `userEvent.hover`: formatted date appears; shipped tickets render as `{ticketKey} — {title}` lines when `days[d].shippedTickets.length > 0`; cost line reads `"N jobs · $X.XX"` when `hasAnyCost`; cost line reads `"N jobs"` with no dollar sign when `!hasAnyCost` (assert substrings `"$NaN"` and `"$0"` are absent — SC-006). Add a touch-tap test that toggles the tooltip and verifies outside-tap dismissal (FR-023). ✅ DONE
- [X] T031 [P] [US3] Extend `tests/integration/heatmap/heatmap-route.test.ts` (existing file from T012) — add cases: day with 3 jobs, 0 with cost → `hasAnyCost===false`, `sumCostUsd===0`; day with 2 of 3 jobs having cost → `hasAnyCost===true`, `sumCostUsd` equals exact 2-decimal sum; ticket with `ship` job COMPLETED today → appears in that day's `shippedTickets`; ticket with stage=SHIP but no ship job → never appears (FR-003, SC-007). ✅ DONE

### Implementation for User Story 3

- [X] T032 [US3] Extend `components/projects/activity-heatmap-grid.tsx` (existing file from T022) — wrap each cell in shadcn `Tooltip`/`TooltipTrigger`/`TooltipContent` (from `components/ui/tooltip.tsx`, Radix portal avoids grid overflow clipping). Render content in the order: formatted date (e.g., `Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })`), then `shippedTickets` list (if any) as `{ticketKey} — {title}`, then summary line. Summary conditional: if `hasAnyCost`, `"{jobCount} jobs · ${sumCostUsd.toFixed(2)}"`; else `"{jobCount} jobs"` — never emit the separator or dollar sign when `!hasAnyCost` (FR-022, SC-006). ✅ DONE
- [X] T033 [US3] Extend `components/projects/activity-heatmap-grid.tsx` (same file, subsequent edit) — add touch handling: cell `<button>` with `onClick` that toggles the tooltip via controlled `open` state; outside-tap dismissal via a document-level listener that clears the selected-cell state when the tap target is not a cell (FR-023). Preserve keyboard accessibility — cell is still a focusable button with aria-label containing the date and count. ✅ DONE

**Checkpoint**: MVP complete (US1 + US2 + US3). All three P1 stories functional and independently testable.

---

## Phase 6: User Story 4 — Filter by AI agent (Priority: P2)

**Goal**: When the viewer's data resolves to ≥2 distinct effective agents, render an agent filter with "All" + one option per agent. Picking an agent recomputes cell intensity, counter, and tooltips without changing grid boundaries. A ticket with `agent=null` whose project's `defaultAgent` matches is included.

**Independent Test**: As a user with jobs across two or more effective agents, open `/projects` and confirm the filter is visible with "All" default. Select a specific agent — cells redraw with only that agent's jobs; grid boundaries/chips/legend unchanged (FR-020). A user whose data is 0 or 1 agent sees no filter.

### Tests for User Story 4

- [X] T034 [P] [US4] Extend `tests/integration/heatmap/heatmap-route.test.ts` (existing file from T012) — add effective-agent filter cases: ticket with `agent=null` on project with `defaultAgent=CODEX` is INCLUDED when `agent=CODEX` is applied; `availableAgents` is computed from the UNFILTERED dataset (invariant #8); `availableAgents` is empty when data resolves to 0 agents and single-element when 1. ✅ DONE
- [X] T035 [P] [US4] Extend `tests/unit/components/projects/activity-heatmap-section.test.tsx` (existing file from T014) — add cases: agent filter hidden when `availableAgents.length <= 1`; shown with "All" default when ≥2; selecting an agent updates the query key and triggers refetch; grid boundaries (checkable via rendered cell count) remain identical across agent changes. ✅ DONE

### Implementation for User Story 4

- [X] T036 [US4] Extend `components/projects/activity-heatmap-header.tsx` (existing file from T021/T028) — add agent `<Select>` next to the period selector, populated from `availableAgents` plus an "All" entry (FR-017). Hide the filter entirely when `availableAgents.length <= 1` (FR-018, Decision 9). Emit `onAgentChange(next: AgentFilter)`. ✅ DONE
- [X] T037 [US4] Extend `components/projects/activity-heatmap-section.tsx` (existing file from T023/T029) — wire `onAgentChange` to update `filters.agent`, retrigger `useActivityHeatmap`. Verify no grid boundary recompute happens client-side — boundaries come from the server's `period` field, which the filter does not change (FR-020). ✅ DONE

**Checkpoint**: User Story 4 complete. Multi-agent accounts can narrow the heatmap; single-agent accounts are unaffected.

---

## Phase 7: User Story 5 — Share a filtered view via URL (Priority: P2)

**Goal**: Selected period and agent are reflected in the URL (`?period=<12m|YYYY>&agent=<enum>`). Opening the URL in another tab (same user signed in) reproduces the same view. Defaults (`period=12m`, `agent=all`) are omitted from the URL for cleanliness.

**Independent Test**: Set a year and an agent → confirm both query params appear in the URL. Open the URL in a new private window as the same user → heatmap restores the same period and agent. Open `/projects` with no params → defaults apply.

### Tests for User Story 5

- [X] T038 [P] [US5] Extend `tests/unit/components/projects/activity-heatmap-section.test.tsx` (existing file from T014/T027/T035) — add cases: changing period calls `router.push('?period=YYYY', { scroll: false })`; changing agent to non-all calls `router.push('?agent=<enum>', { scroll: false })`; defaults (`12m`, `all`) do NOT appear in the URL; landing with both params pre-set hydrates `filters` accordingly (`getInitialFilters(searchParams, initialData)` pattern from `analytics-dashboard.tsx`). ✅ DONE

### Implementation for User Story 5

- [X] T039 [US5] Extend `components/projects/activity-heatmap-section.tsx` (existing file from T023/T029/T037) — implement URL sync: on every `filters` change call `router.push` with a new `URLSearchParams` built from `searchParams`, setting/removing `period` and `agent`. Use `{ scroll: false }` so the viewport stays on the heatmap (Pattern 1). Seed initial `filters` from `searchParams` via `parsePeriodParam` + `AGENT_FILTER_VALUES` guard; fall back to defaults on invalid input (matches server's forgiving behavior). ✅ DONE
- [X] T040 [US5] Extend `app/projects/page.tsx` (existing file from T025) — parse `period` and `agent` from `searchParams`, resolve via `parsePeriodParam` + `AGENT_FILTER_VALUES` guard, and pass the resolved `HeatmapFilters` into both `getHeatmapInitialData(userId, filters)` and `<ActivityHeatmapSection initialData={...}>`. This makes a shared URL render the correct view on first paint (FR-024, SC-004). ✅ DONE

**Checkpoint**: User Story 5 complete. Filtered heatmap views are shareable and reproducible via URL.

---

## Phase 8: User Story 6 — Use the heatmap on mobile (Priority: P3)

**Goal**: On narrow viewports (≤ 480px), the grid scrolls horizontally rather than wrapping or shrinking cells below a tappable size. Day-of-week labels stay pinned to the left edge during horizontal scroll (Pattern 8).

**Independent Test**: Open `/projects` on a viewport ≤ 480px wide, confirm cells stay at a tappable size, horizontally scroll the grid, and confirm the day-of-week column stays pinned while months/dates scroll beneath it.

### Tests for User Story 6

- [X] T041 [P] [US6] Extend `tests/unit/components/projects/activity-heatmap-grid.test.tsx` (existing file from T013/T030) — add layout assertions: the horizontal-scroll parent has `overflow-x-auto` and the day-of-week label column has `sticky left-0 z-10` classes on a narrow viewport (verify via computed styles or asserted class names on rendered elements). The grid's `min-width` is larger than the viewport so horizontal scroll activates. ✅ DONE

### Implementation for User Story 6

- [X] T042 [US6] Extend `components/projects/activity-heatmap-grid.tsx` (existing file from T022/T032/T033) — add an `overflow-x-auto` wrapper around the grid; apply `sticky left-0 z-10 bg-background` to the day-of-week label column (Pattern 8, FR-028). Ensure cell size stays at the tappable minimum regardless of viewport (no shrink below ~12px; precise dimension is a Tailwind utility choice). Grid `min-width` is computed from week count × cell-size + gaps (FR-027). ✅ DONE

**Checkpoint**: All user stories complete.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Manual verification, type-check, lint cleanliness, and documentation polish across the feature.

- [X] T043 Run `bun run type-check` from repo root and resolve any new errors introduced by the heatmap module ✅ DONE
- [X] T044 Run `bun run lint` from repo root and resolve any new lint errors introduced by the heatmap module ✅ DONE
- [X] T045 Run `bun run test:unit` for the heatmap-specific files: `tests/unit/heatmap/period.test.ts`, `tests/unit/heatmap/buckets.test.ts`, `tests/unit/components/projects/activity-heatmap-grid.test.tsx`, `tests/unit/components/projects/activity-heatmap-section.test.tsx` ✅ DONE (52/52 pass)
- [X] T046 Run `bun run test:integration tests/integration/heatmap/heatmap-route.test.ts` and `tests/integration/projects/projects-with-health.test.ts` ✅ DONE (13/13 pass)
- [ ] T047 Manual verification in a browser — start `bun run dev`, sign in as a seeded user with prior activity, open `/projects`, verify the heatmap is populated on first paint with no spinner (SC-001), scroll past the cards to reach it (FR-012), hover a cell (tooltip shows date + shipped tickets + summary line per FR-021/FR-022), change the period (grid redraws + URL updates within 1s per SC-002), change the agent if filter is visible (URL updates per SC-003), refresh the page (same view restored per SC-004), resize to ≤ 480px (horizontal scroll with pinned weekday column per SC-005) — MANUAL STEP, requires human browser session

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — directories can be created immediately, any order, in parallel
- **Phase 2 (Foundational)**: Depends on Phase 1. T006 (types) blocks everything downstream. T007 (query-keys) blocks T018. T008/T009 are parallelizable with T006 once the directory exists.
- **Phase 3+ (User Stories)**: All depend on Phase 2 completion (types + query keys + pure helpers present)
  - US1 is the MVP foundation — US2/US3/US4/US5 all extend US1's section/grid/header
  - US2, US4, US5 each extend `activity-heatmap-section.tsx` and `activity-heatmap-header.tsx` → within any one of these stories, header edits precede section edits
  - US3 extends `activity-heatmap-grid.tsx` (tooltip layer) — independent of US2/US4/US5 header changes
  - US6 extends the grid's mobile layout — independent of US2/US4/US5
- **Phase 9 (Polish)**: Depends on all intended user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 — fully foundational for the feature
- **US2 (P1)**: Requires US1's header (T021) and section (T023) to exist — extends both
- **US3 (P1)**: Requires US1's grid (T022) to exist — extends it with tooltips and touch handling. Does NOT require US2 or US4.
- **US4 (P2)**: Requires US1's header (T021) and section (T023) — same extension surface as US2, so US2 and US4 are best done serially (US2 first to keep the selector slot simple) or with careful merge discipline
- **US5 (P2)**: Requires US1's section (T023) and page (T025). Layers URL sync atop US2's period change and US4's agent change. Best sequenced AFTER US2 and US4 so the `filters` object has both fields wired before URL round-tripping is tested.
- **US6 (P3)**: Requires US1's grid (T022). Fully independent of US2/US3/US4/US5 — can run in parallel with any of them once the grid exists.

### Within Each User Story

- Tests FIRST (constitution III) → Extend existing test files where the domain is already covered (T015 extends existing integration; T026/T027/T030/T031/T034/T035/T038/T041 all extend the US1 test files rather than creating new ones)
- Types (Phase 2) before queries → queries (T016) before the API route (T017) → route before the hook (T018) → hook before the section (T023)
- Leaf UI components (T019 legend, T020 empty, T021 header, T022 grid) can be built in parallel once types exist, before the section (T023) composes them

### Parallel Opportunities

- Phase 1: T001, T002, T003, T004, T005 all [P]
- Phase 2: T008, T009 are [P] once T006 lands
- US1 tests (T010–T014) all [P] — different files; T015 is sequential because it edits an existing file
- US1 leaf components (T019 legend, T020 empty, T021 header) all [P] with each other and with T016 (query) / T017 (route) / T018 (hook)
- US6 (T041, T042) can run in parallel with US2/US4/US5 once T022 (grid) is complete

---

## Parallel Example: User Story 1

```bash
# Launch all new US1 test files in parallel (all different files, all new):
Task: "Create bucket tests in tests/unit/heatmap/buckets.test.ts"
Task: "Create period tests in tests/unit/heatmap/period.test.ts"
Task: "Create API integration test in tests/integration/heatmap/heatmap-route.test.ts"
Task: "Create grid tests in tests/unit/components/projects/activity-heatmap-grid.test.tsx"
Task: "Create section tests in tests/unit/components/projects/activity-heatmap-section.test.tsx"

# Then in parallel: leaf components + server layer
Task: "Create lib/heatmap/queries.ts"
Task: "Create components/projects/activity-heatmap-legend.tsx"
Task: "Create components/projects/activity-heatmap-empty.tsx"
Task: "Create components/projects/activity-heatmap-header.tsx"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup) — directories
2. Complete Phase 2 (Foundational) — types, query keys, pure helpers
3. Complete Phase 3 (US1) — server query, API route, hook, components, page integration
4. **STOP and VALIDATE**: user with activity sees populated grid on first paint; user without activity sees empty state
5. Demo / merge

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → populated heatmap on `/projects` (MVP)
3. US2 → period selector
4. US3 → hover/tap tooltips
5. US4 → agent filter
6. US5 → URL sync
7. US6 → mobile horizontal scroll with pinned weekday column

Each increment is independently testable; each adds value without breaking earlier stories.

### Parallel Execution Strategy (once Phase 2 is complete)

- US1 must land first — all other stories extend its files
- After US1: US3 and US6 are fully independent of US2/US4/US5 and can proceed in parallel with them
- US2 → US4 → US5 are best sequenced (all extend the same `section` + `header` files)

---

## Notes

- [P] = different files, no dependency on uncompleted tasks
- Tests go FIRST within each user story and MUST fail before implementation (Constitution III)
- Extend existing test files where the domain is already covered — new files only when no existing file matches (Constitution III: "Search existing tests FIRST — extend, don't duplicate")
- Every file path in this document was verified against the current working tree during task generation (existing files present; new files confirmed absent)
- No new Prisma models, migrations, or raw SQL (FR-029, Constitution IV)
- No hardcoded hex/rgb colors and no dynamically constructed Tailwind class names (CLAUDE.md)
- Commit after each task or logical group; verify hooks pass before pushing
