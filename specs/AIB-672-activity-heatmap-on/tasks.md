---
description: "Tasks for AIB-672: Activity Heatmap on Projects Page"
---

# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `/specs/AIB-672-activity-heatmap-on/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/activity-heatmap-api.md

**Tests**: Included by default per project constitution. Three new test files are justified in `plan.md` (no existing file covers cross-project heatmap aggregation, the new user-scoped API route, or the new client component).

**Organization**: Tasks are grouped by user story (US1 P1 … US5 P3) so each can be implemented and tested independently. MVP = User Story 1.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Parallelizable (different file, no pending dependency)
- **[Story]**: Traceability label (US1..US5); omitted for Setup / Foundational / Polish
- Every task includes an exact, real-repository file path

## Path Conventions

Single Next.js app at repository root:
- `app/` — routes (pages + API)
- `components/` — React components (shadcn + feature folders)
- `lib/` — shared server-side helpers (DB, analytics, utilities)
- `tests/unit/`, `tests/integration/` — Vitest suites

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new directories and type scaffolding shared by every story. No production logic lands here — only folder/file stubs so later [P] tasks can land in parallel without collisions.

- [X] T001 [P] Create empty module `lib/analytics/activity-heatmap.ts` exporting placeholder types `HeatmapPeriod`, `HeatmapAgentFilter`, `HeatmapDayCell`, `HeatmapShippedTicket`, `HeatmapResponse` mirroring `specs/AIB-672-activity-heatmap-on/data-model.md` §"Derived Shapes"
- [X] T002 [P] Create empty route stub `app/api/activity-heatmap/route.ts` exporting an async `GET` that returns `new Response('Not implemented', { status: 501 })` (to be replaced in Phase 4)
- [X] T003 [P] Create empty client component stub `components/projects/activity-heatmap.tsx` with `"use client"` directive exporting `export function ActivityHeatmap() { return null; }`
- [X] T004 [P] Create directories `tests/unit/lib/analytics/` and `tests/unit/components/projects/` and `tests/integration/activity-heatmap/` (via placeholder `.gitkeep` or first test file in T00x tasks below)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pure-function primitives and the server-side data access helper that every user story depends on. Types, bucketing, period/agent resolution, and the DB aggregation query must exist before any route or UI task can run.

**⚠️ CRITICAL**: No user-story phase may begin until Phase 2 completes.

### Shared types & contract

- [X] T005 Finalize exported types in `lib/analytics/activity-heatmap.ts` to exactly match the contract in `specs/AIB-672-activity-heatmap-on/contracts/activity-heatmap-api.md` (HeatmapResponse, HeatmapDayCell, HeatmapShippedTicket, HeatmapPeriod, HeatmapAgentFilter)

### Pure helpers (new, no existing coverage)

- [X] T006 [P] Implement `buildPeriodBounds(period, now, tz)` in `lib/analytics/activity-heatmap.ts` — returns `{ startDate, endDate, timezone, kind, year? }` honouring rolling 12m vs calendar year and IANA tz fallback to UTC (research.md §Timezone handling)
- [X] T007 [P] Implement `bucketJobsByLocalDay(jobs, tz)` in `lib/analytics/activity-heatmap.ts` using `Intl.DateTimeFormat(tz, { … }).formatToParts` for day keys; excludes null-cost jobs from cost sum and tracks `nullCostJobCount` per FR-020
- [X] T008 [P] Implement `computeIntensityThresholds(max)` in `lib/analytics/activity-heatmap.ts` returning `[ceil(max*0.25), ceil(max*0.5), ceil(max*0.75), max]`; returns `[0,0,0,0]` when `max === 0` (research.md §Intensity thresholds)
- [X] T009 [P] Implement `resolveYearSelectorOptions(createdAt, now)` in `lib/analytics/activity-heatmap.ts` — returns `{ calendarYears, currentYear }` clamped to `[min(createdYear, currentYear), currentYear]` (FR-016/017, SC-008, clock-skew edge case)
- [X] T010 [P] Implement `assignIntensity(jobCount, thresholds)` in `lib/analytics/activity-heatmap.ts` — returns `0|1|2|3|4` such that `intensity === 0 ⇔ jobCount === 0` (data-model.md response invariants)

### Server data-access helper

- [X] T011 Implement `getHeatmapData({ userId, period, agent, tz })` in `lib/analytics/activity-heatmap.ts`:
  (a) resolve accessible project IDs via `OR: [{ userId }, { members: { some: { userId } } }]` (pattern from `lib/db/projects.ts`),
  (b) query `Job` with `projectId in [...]` and `startedAt` within `[start, end]` including `ticket.agent` and `project.defaultAgent` for effective-agent resolution,
  (c) query successful `ship` jobs where `command === 'ship' AND status === 'COMPLETED' AND completedAt in [start, end]` joined to tickets (including `deletedAt` or equivalent),
  (d) apply agent filter via `resolveEffectiveAgent` from `app/lib/utils/agent-resolution.ts`,
  (e) assemble every day in `[startDate..endDate]` inclusive (contract §Empty aggregate),
  (f) return full `HeatmapResponse` including `availableAgents` (computed from unfiltered set per contract §Agent filter), `intensityThresholds`, `yearSelector`

- [X] T012 Export `getInitialHeatmapData()` wrapper from `lib/analytics/activity-heatmap.ts` that calls `getHeatmapData` inside `try/catch`, logs `console.error('Activity heatmap SSR error:', err)` and returns `{ data: null, errored: true }` on failure (graceful-degradation pattern from `app/projects/page.tsx:17-27`, research.md §Graceful degradation)

**Checkpoint**: Foundational primitives and server helper ready — user story phases can now begin.

---

## Phase 3: User Story 1 — See at-a-glance AI activity over the last year (Priority: P1) 🎯 MVP

**Goal**: Signed-in user opens `/projects` and sees a full-width heatmap below the project cards showing every day of the last 12 months, with cell intensities proportional to job count and a header counter reading "X jobs · Y tickets shipped in the last year". No spinner on first paint (FR-029, SC-001).

**Independent Test**: Seed a user with a known mix of jobs + shipped tickets distributed across the last year, load `/projects`, and assert: (1) heatmap renders synchronously (no loading text), (2) 7-row grid with correctly chipped first/last week, (3) header counters match seeded totals, (4) zero-activity user sees the empty-state message with legend still visible (FR-012).

### Tests for User Story 1

**NOTE: Write these tests FIRST, confirm they FAIL, then implement.** All three files are new per research.md §"Existing Files > Tests" — no existing test covers cross-project aggregation or the new component.

- [X] T013 [P] [US1] Create unit tests for pure helpers in `tests/unit/lib/analytics/activity-heatmap.test.ts`: `buildPeriodBounds` (rolling 12m + calendar year + invalid tz → UTC), `bucketJobsByLocalDay` (tz boundary, null cost handling, `nullCostJobCount`), `computeIntensityThresholds` (max=0 → all zero, max=4 → quartile split), `resolveYearSelectorOptions` (account-created-this-year → `[]` per SC-008; multi-year ascending/descending; clock-skew clamp), `assignIntensity` (zero ⇔ level 0 invariant)
- [X] T014 [P] [US1] Create integration test in `tests/integration/activity-heatmap/route.test.ts` covering 401 unauthenticated, cross-project aggregation (owner + member projects), empty aggregate payload shape (cells cover every day, thresholds `[0,0,0,0]`, counters 0), `tz` fallback to UTC on invalid value, response-side invariants from data-model.md (jobCount sum, cells length, intensity ⇔ jobCount===0). Follow worker-isolation pattern from `tests/integration/analytics/analytics-route.test.ts`
- [X] T015 [P] [US1] Create component tests in `tests/unit/components/projects/activity-heatmap.test.tsx`: grid renders synchronously from `initialData` with no loading text (SC-001), 7-row × N-column layout, chipped corners when period doesn't align to Sun/Sat, header counter format "X jobs · Y tickets shipped in the last year", empty-state message renders with legend visible (FR-012, SC-006)

### Implementation for User Story 1

- [X] T016 [US1] Implement GET handler in `app/api/activity-heatmap/route.ts`: `requireAuth()` → parse `y`/`a`/`tz` with Zod (mirroring `app/api/projects/[projectId]/analytics/route.ts:7-50`), coerce out-of-range year to `'12m'` silently, call `getHeatmapData`, return JSON; error mapping: ZodError → 400 `{ error: 'Invalid heatmap filters' }`, `Unauthorized` → 401/403, default 500 with `console.error('Activity heatmap API error:', …)`
- [X] T017 [US1] Implement base `ActivityHeatmap` client component in `components/projects/activity-heatmap.tsx`: props `{ initialData: HeatmapResponse | null; errored: boolean }`, `useQuery` keyed on `['activity-heatmap', y, a, tz]` seeded with `initialData`; render shadcn `Card` shell with `aurora-bg-subtle`, header counter using period phrase ("the last year" or `{YYYY}`) from FR-013, 7-row grid with sticky day-of-week labels column, month labels row along top, legend (Less □□■■■ More, FR-011); handle empty-state branch (FR-012) and inline error notice when `errored === true`
- [X] T018 [US1] Implement static intensity → class lookup in `components/projects/activity-heatmap.tsx` as a frozen 5-entry object keyed `0..4` mapping to full static Tailwind + aurora class strings (e.g. `aurora-cell-empty`, `aurora-cell-1`..`aurora-cell-4`), strictly no dynamic class construction (CLAUDE.md Tailwind rule; pattern from `components/comparison/comparison-compliance-heatmap.tsx:13-25`)
- [X] T019 [US1] Add new aurora utility classes `aurora-heatmap-cell-{1..4}` (and `aurora-heatmap-cell-empty` if the existing `aurora-cell-*` triad is insufficient) in `app/globals.css` under the existing `@layer utilities` block; values must meet WCAG AA contrast in both light and dark themes (FR-009)
- [X] T020 [US1] Edit `app/projects/page.tsx` to call `getInitialHeatmapData()` (in-process, no HTTP hop per contract §Polling/caching), wrap in `try/catch`, render `<ActivityHeatmap initialData={…} errored={…} />` **below** `<ProjectsContainer />` inside the existing `container mx-auto …` wrapper (FR-031)
- [X] T021 [US1] Edit `components/projects/projects-container.tsx` to remove `overflow-y-auto max-h-[calc(100vh-200px)]` so the page scrolls naturally (FR-032); leave responsive grid classes untouched

**Checkpoint**: User Story 1 fully functional — `/projects` renders the heatmap with SSR data, no spinner, graceful degradation on error. MVP shippable here.

---

## Phase 4: User Story 2 — Inspect a specific day (Priority: P2)

**Goal**: User hovers (desktop) or taps (mobile) any cell and sees a tooltip with formatted date, shipped tickets list, job count, and total cost — never `$NaN` or placeholder `$0` (FR-018..FR-021, SC-002).

**Independent Test**: Hover a seeded day with 3 jobs at $1.24 and ticket "Add login"; tooltip must show that exact text. Test a null-cost day: cost line must be absent. Test a zero-activity cell: tooltip shows date + "No activity". Test tap-outside-to-dismiss on touch.

### Tests for User Story 2

- [X] T022 [P] [US2] Extend `tests/unit/components/projects/activity-heatmap.test.tsx` with tooltip tests: 3 jobs + 1 ticket shows "1 ticket shipped: Add login" + "3 jobs · $1.24" (FR-019); day where all jobs have null cost → cost line absent (FR-020, SC-002); zero-activity cell → "No activity" line (edge case); deleted-ticket collapse to "N more tickets"
- [X] T023 [P] [US2] Extend `tests/integration/activity-heatmap/route.test.ts` with a day-level assertion: seed jobs with mixed null/non-null `costUsd` → assert cell `costUsd` sums non-null only and `nullCostJobCount` tracks excluded count; seed deleted ticket (via `deletedAt` if present on Ticket, else omit from join) → assert `shippedTickets` entry has `{ ticketId: null, title: null }`

### Implementation for User Story 2

- [X] T024 [US2] Add `<TooltipProvider>` wrapper and per-cell `<Tooltip><TooltipTrigger asChild><div … data-testid="heatmap-cell" /></TooltipTrigger>…</Tooltip>` in `components/projects/activity-heatmap.tsx` using shadcn primitives from `components/ui/tooltip.tsx`
- [X] T025 [US2] Implement tooltip content renderer in `components/projects/activity-heatmap.tsx`: formatted date line, shipped-tickets list with deleted-ticket collapse ("N more tickets"), `jobs · cost` line that omits the cost segment entirely when cell `costUsd === null` (FR-020); "No activity" message when `jobCount === 0`
- [X] T026 [US2] Ensure tap-outside dismissal on touch devices in `components/projects/activity-heatmap.tsx` by relying on Radix Tooltip's outside-click behaviour (no custom document listener) and verify via component test from T022 (FR-021)

**Checkpoint**: Tooltips work across desktop hover and mobile tap, no `$NaN`/`$0` regressions.

---

## Phase 5: User Story 3 — Navigate by calendar year (Priority: P2)

**Goal**: User picks a calendar year from the year selector; grid redraws to exact `Jan 1..Dec 31` bounds with correct chipped corners, header counter updates to `"in {YYYY}"`. Selector is hidden/disabled when account-creation year equals current year (FR-015..FR-017, SC-008).

**Independent Test**: Seed a user created 3 years ago; open selector and assert options = `["Last 12 months", currentYear, currentYear-1, currentYear-2, createdYear]`. Select a past year starting on Monday and ending on Wednesday; assert grid's top-left and bottom-right corners are chipped accordingly.

### Tests for User Story 3

- [X] T027 [P] [US3] Extend `tests/unit/lib/analytics/activity-heatmap.test.ts` with `resolveYearSelectorOptions` exhaustive cases: createdYear === currentYear → `calendarYears: []`; createdYear < currentYear → full range; createdYear > currentYear (clock skew) → clamp to `[currentYear]` with empty calendarYears (edge case)
- [X] T028 [P] [US3] Extend `tests/integration/activity-heatmap/route.test.ts` with `y=2024` request: assert response `period.kind === 'calendarYear'`, `period.year === 2024`, `period.startDate === '2024-01-01'`, `period.endDate === '2024-12-31'`; out-of-range year silently coerces to `rolling12m` (contract §Query parameters)
- [X] T029 [P] [US3] Extend `tests/unit/components/projects/activity-heatmap.test.tsx`: year Select renders with "Last 12 months" default + calendar years descending; hidden when `yearSelector.calendarYears.length === 0` (FR-017); counter phrase changes from "in the last year" to "in 2024" on selection (FR-013 period phrase)

### Implementation for User Story 3

- [X] T030 [US3] Add shadcn `Select` (from `components/ui/select.tsx`) for the year selector in `components/projects/activity-heatmap.tsx`; bind options from `initialData.yearSelector`; hide entire Select when `calendarYears.length === 0` (FR-017)
- [X] T031 [US3] Wire year Select onChange to refetch via `useQuery` query-key update (y param) in `components/projects/activity-heatmap.tsx`; update header counter period phrase using the `period.kind`/`period.year` from the refreshed response (FR-013, FR-014)

**Checkpoint**: Year navigation works, counter phrase switches correctly, edge cases (new user, clock skew) handled.

---

## Phase 6: User Story 4 — Filter by AI agent (Priority: P3)

**Goal**: When user's data has ≥ 2 distinct effective agents, an agent filter appears with "All" + each agent. Selecting a specific agent updates cell intensities and counters without changing grid boundaries; effective-agent resolution (`ticket.agent ?? project.defaultAgent`) applies (FR-022..FR-026, SC-003).

**Independent Test**: Seed a user whose jobs span Claude and Codex. Assert filter renders with `All|Claude|Codex`. Select "Claude"; assert (a) counter drops to Claude-only slice, (b) cells for Codex-only days become empty/level-0, (c) `period.startDate`/`endDate` unchanged, (d) a ticket with `agent=null` on a project whose `defaultAgent=CLAUDE` is counted.

### Tests for User Story 4

- [X] T032 [P] [US4] Extend `tests/integration/activity-heatmap/route.test.ts` with: `a=CLAUDE` filter — seed one ticket with `agent=null` on project with `defaultAgent=CLAUDE` and one ticket with explicit `agent=CODEX`; assert Claude filter counts the null-agent ticket's jobs (FR-025), excludes the Codex ticket; assert `availableAgents` still contains both agents (filter visibility stable per contract §Agent filter)
- [X] T033 [P] [US4] Extend `tests/unit/components/projects/activity-heatmap.test.tsx`: filter Select absent when `availableAgents.length <= 1` (FR-024); "All" default; on agent change the grid week-count (column count) is identical before/after the refetch settles (SC-003 boundary invariance, FR-026)

### Implementation for User Story 4

- [X] T034 [US4] Add conditional agent filter shadcn `Select` in `components/projects/activity-heatmap.tsx`: render only when `initialData.availableAgents.length >= 2`; options = "All" + each agent using `AGENT_LABELS` from `app/lib/utils/agent-resolution.ts`; default = "All" (FR-023)
- [X] T035 [US4] Wire agent Select to the `a` query-key dimension in `components/projects/activity-heatmap.tsx` so refetches respect effective-agent filtering already applied server-side in `getHeatmapData` (no client-side filtering — single source of truth)

**Checkpoint**: Agent filter visible only with ≥2 agents, counter + cells update, grid boundaries stable.

---

## Phase 7: User Story 5 — Share a specific view by URL (Priority: P3)

**Goal**: Non-default selections (`y`, `a`) serialise into the page URL; defaults are omitted (FR-027/FR-028, SC-004). Opening a URL in another tab reproduces the exact view without spinner flash.

**Independent Test**: Set year=2025 and agent=CLAUDE; assert URL contains `?y=2025&a=CLAUDE`. Clear both; assert URL has no query string. Open a shared URL in a fresh tab; assert heatmap renders with applied filters and no loading text.

### Tests for User Story 5

- [X] T036 [P] [US5] Extend `tests/unit/components/projects/activity-heatmap.test.tsx` with URL round-trip tests: mock `useSearchParams` + `useRouter`; changing filters calls `router.replace` with expected query (omitting `y=12m` and `a=all` per FR-028); remount with `?y=2025&a=CLAUDE` in searchParams → component restores those selections (SC-004) without triggering a loading state (SSR initial data reuse)

### Implementation for User Story 5

- [X] T037 [US5] Implement URL state sync in `components/projects/activity-heatmap.tsx` using `useSearchParams()` + `useRouter().replace(…, { scroll: false })` (pattern from `components/analytics/analytics-dashboard.tsx:85-120`); construct `URLSearchParams` omitting default values (`y=12m`, `a=all`) per FR-028
- [X] T038 [US5] Derive initial filter state in `components/projects/activity-heatmap.tsx` from `searchParams` on first render so reopened URLs reproduce the exact view without additional clicks (SC-004)

**Checkpoint**: All five user stories independently functional; the heatmap is fully shippable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Mobile ergonomics, invariant assertions, final lint/type gates.

- [X] T039 [P] Verify mobile sticky + horizontal scroll in `components/projects/activity-heatmap.tsx`: outer `CardContent` has `overflow-x-auto`; day-of-week labels column has `sticky left-0 z-10` with `aurora-bg-subtle` backdrop (FR-033, FR-034, SC-005); cells retain a minimum tappable target size
- [X] T040 [P] Add response-invariant assertions in `lib/analytics/activity-heatmap.ts` via a single internal `assertHeatmapInvariants(response)` called in development (`process.env.NODE_ENV !== 'production'`): `counters.jobCount === Σ cells[i].jobCount`, `intensity === 0 ⇔ jobCount === 0`, `cells.length === days in [startDate..endDate]` (data-model.md §Response-side invariants)
- [X] T041 [P] Extend `tests/integration/activity-heatmap/route.test.ts` with the SC-007 seed case: create a ticket at stage `SHIP` with NO completed `ship` job; assert `counters.shippedTicketCount === 0` and ticket does not appear in any cell's `shippedTickets`
- [X] T042 Run `bun run type-check` and `bun run lint` at repo root; fix any errors (CLAUDE.md commit rules — must pass before commit, do not bypass with `--no-verify`)
- [X] T043 Run `bun run test:unit tests/unit/lib/analytics/activity-heatmap.test.ts tests/unit/components/projects/activity-heatmap.test.tsx` and `bun run test:integration tests/integration/activity-heatmap/route.test.ts`; confirm all suites green

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks** every user story phase
- **Phase 3 (US1 MVP)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 3 (needs the rendered cells to attach tooltips to)
- **Phase 5 (US3)**: Depends on Phase 3 (reuses header + grid); independent of US2/US4/US5
- **Phase 6 (US4)**: Depends on Phase 3; independent of US2/US3/US5
- **Phase 7 (US5)**: Depends on US3 + US4 (URL state synchronises *their* filter dimensions)
- **Phase 8 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundation only → fully independent
- **US2 (P2)**: Depends on US1 for DOM cells → independent of US3/US4/US5
- **US3 (P2)**: Depends on US1 for header/grid → independent of US2/US4/US5
- **US4 (P3)**: Depends on US1 → independent of US2/US3/US5
- **US5 (P3)**: Depends on US3 + US4 (needs filter UI elements to sync to URL)

### Within Each User Story

- Tests (T013–T015 for US1; T022–T023 for US2; T027–T029 for US3; T032–T033 for US4; T036 for US5) must be written and verified failing before their implementation tasks
- Server helper (T011) → API route (T016) → client component (T017–T018) → page integration (T020–T021)
- Styles (T019) can land in parallel with component logic
- Story complete and checkpoint validated before moving to next priority

### Parallel Opportunities

- All Phase 1 tasks (T001–T004) are [P]
- Phase 2 pure helpers (T006–T010) are [P]
- All within-story test tasks are [P] across different files
- US2, US3, and US4 can run in parallel after US1 completes (different sub-features of the same file — coordinate edits to `components/projects/activity-heatmap.tsx` or have a single agent apply the merged change)
- Polish tasks T039–T041 are [P]

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (three different files, no shared state):
Task: "Create unit tests in tests/unit/lib/analytics/activity-heatmap.test.ts"
Task: "Create integration test in tests/integration/activity-heatmap/route.test.ts"
Task: "Create component tests in tests/unit/components/projects/activity-heatmap.test.tsx"

# Then fan out the implementation (different files):
Task: "Implement GET handler in app/api/activity-heatmap/route.ts"
Task: "Add aurora-heatmap-cell-* utilities in app/globals.css"
# ActivityHeatmap component + page edits serialise (same files).
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup (T001–T004)
2. Phase 2: Foundational (T005–T012)
3. Phase 3: User Story 1 (T013–T021)
4. **STOP and VALIDATE**: Load `/projects` with a seeded user; confirm SC-001 (no spinner), SC-006 (empty state), and header counter correctness
5. Deploy/demo MVP

### Incremental Delivery

1. MVP (US1) shipped → heatmap visible with last-12-months default view
2. Add US2 (tooltips) → users can inspect individual days
3. Add US3 (year selector) → history navigation unlocked
4. Add US4 (agent filter) → per-agent analytics for multi-agent users
5. Add US5 (URL state) → shareable views

### Parallel Execution Strategy

After Phase 2 completes, US2/US3/US4 can be implemented in parallel by separate agents, each guarding against same-file edits in `components/projects/activity-heatmap.tsx`. US5 waits on US3+US4 since it synchronises *their* controls to the URL.

---

## Notes

- [P] tasks touch different files; same-file tasks serialise (most `components/projects/activity-heatmap.tsx` edits)
- [Story] label maps each task to its user story for traceability
- Every new-file task lists a path not yet present in the repo (verified 2026-04-17)
- Every extend-file task names a path that exists (verified)
- Tests MUST be written first and fail before implementation (constitution §III)
- `bun run type-check` and `bun run lint` must pass before any commit (CLAUDE.md commit rules)
- No new Prisma models, no migrations (FR-005)
- No dynamic Tailwind class names, no hardcoded hex colours (CLAUDE.md)
