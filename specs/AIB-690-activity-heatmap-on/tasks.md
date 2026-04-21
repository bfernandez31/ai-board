# Tasks: Activity Heatmap on Projects Page (AIB-690)

**Input**: Design documents from `/specs/AIB-690-activity-heatmap-on/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/heatmap-api.md

**Tests**: Test tasks are included by default (constitution §III). Unit and integration tests are authored first per TDD; manual QA is deferred to Phase 8.

**Organization**: Tasks are grouped by user story. Foundational phase contains the complete API (types, aggregations, server function, route, query keys, shared styles) because all five user stories consume the same single endpoint per `contracts/heatmap-api.md`.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User-story label (US1–US5). Setup/Foundational/Polish tasks have no story label.
- Every task below uses verified file paths from `research.md §Existing Files` and `plan.md §Project Structure`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline validation before touching code. The Next.js app is already initialized; no scaffolding is needed.

- [X] T001 Run `bunx prisma generate` from repository root so the Prisma client reflects the current schema (no schema change, safety net for CI parity)
- [X] T002 [P] Run `bun run type-check` and `bun run lint` on the feature branch to confirm a clean baseline before edits begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, pure utilities, server-side data function, API route, query keys, theme tokens, and the `/projects` page scroll fix. Every user story below consumes these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — the API must already support period, agent, and effective-agent filtering when the UI stories land.

### Types and pure utilities

- [X] T003 Create `lib/analytics/heatmap-types.ts` exporting `HeatmapPeriod`, `HeatmapFilters`, `DailyCell`, `HeatmapSummary`, `BucketThresholds`, `HeatmapData` (shapes per `data-model.md §Derived Entities`); re-import `AgentFilter`, `AgentOption`, `NamedAgent` from `./types` — do not duplicate
- [X] T004 [P] Extend `lib/analytics/aggregations.ts` with `computeQuantileBuckets(nonZeroCounts: number[]): BucketThresholds`, `assignIntensityBucket(jobCount, thresholds): 0|1|2|3|4`, `getHeatmapPeriodBounds(period, now): { startDate: Date; endDate: Date }`, and `formatUTCDate(d: Date): string` per `plan.md §Phase A`
- [X] T005 [P] Create `tests/unit/heatmap-aggregations.test.ts` covering: `computeQuantileBuckets` for `[]`, `[1]`, `[1,1,1]`, `[1,2,3,4,5,10,10,10]`, `[1,1,1,1,100]`; `assignIntensityBucket` boundary cases (0, p25, p25+1, p50, p75, above p75); `getHeatmapPeriodBounds` for rolling12m across DST and leap-year 2024; `formatUTCDate` determinism; empty-bucket-1 guard (all non-zero days sharing the same count → bucket 1 never empty) — constitution: no existing `heatmap-aggregations` file covers this domain

### Server-side data function

- [X] T006 Export `buildEffectiveAgentWhere` from `lib/analytics/queries.ts` by adding the `export` keyword to its declaration (lines 51–69); no behavioral change — makes the helper importable by `lib/analytics/heatmap-queries.ts`
- [X] T007 Create `lib/analytics/heatmap-queries.ts` exporting `getHeatmapData(userId: string, filters: HeatmapFilters): Promise<HeatmapData>` implementing the 14-step algorithm from `data-model.md §Derivation Algorithm`: resolve `accessibleProjectIds` via `OR: [{ userId }, { members: { some: { userId } } }]`; read `user.createdAt` for `accountCreationYear`; compute UTC bounds; run `prisma.job.findMany` + `prisma.ticket.count` in `Promise.all` with effective-agent WHERE; group jobs by `formatUTCDate(completedAt)`; derive cells with `totalCostUsd = null` iff any contributing job has `costUsd === null`; compute thresholds + buckets; compute `availableAgents` (scoped to `accessibleProjectIds`) and `availableYears` (descending, empty when created in current year)

### API route

- [X] T008 Create `app/api/activity/heatmap/route.ts` — Zod schema `{ period: z.union([z.literal('last12months'), z.string().regex(/^\d{4}$/)]).optional(), agent: z.enum(AGENT_FILTER_VALUES).optional() }` parsed with `.safeParse`; on failure or out-of-range year, coerce to defaults rather than return 400 (FR-024 + spec edge case "Invalid query params"); call `requireAuth(request)` from `lib/db/users.ts`; wrap `getHeatmapData` in try/catch; return 401 for `Error('Unauthorized')`, 500 otherwise (pattern from `app/api/projects/[projectId]/analytics/route.ts:36-50`)
- [X] T009 Create `tests/integration/analytics/heatmap-route.test.ts` covering every row of the Test Matrix in `contracts/heatmap-api.md §Test Matrix` (no-auth→401, default params across 3 projects with owner+member access, `period=2025` with user created 2024, `period=1999` coerced to rolling12m, `agent=CLAUDE` on CODEX-only user, explicit `ticket.agent=CODEX` vs filter=CLAUDE exclusion, `ticket.agent=null` + `project.defaultAgent=CLAUDE` + filter=CLAUDE inclusion, day with mixed null/non-null `costUsd`, two ship jobs on same ticket same day, all-zero period, equal-counts empty-bucket-1 guard, outlier distribution); use `getTestContext()` + `getPrismaClient()` from `tests/fixtures/vitest/setup.ts` and `tests/helpers/db-cleanup.ts`; mock `@/lib/db/users.ts` `requireAuth` — constitution: sibling to existing `tests/integration/analytics/analytics-route.test.ts` which is single-project-scoped and does not cover this user-scoped concern

### Query keys and theme tokens

- [X] T010 [P] Extend `app/lib/query-keys.ts` with `heatmap: { data: (userId: string, period: string, agent: string) => ['heatmap', userId, period, agent] as const }` (no behavioral change to existing keys)
- [X] T011 [P] Add `aurora-heatmap-bucket-0` through `aurora-heatmap-bucket-4` utility classes to `app/globals.css` under `@layer utilities`, built on `--primary-violet`, `--ctp-lavender`, `--ctp-mauve` tokens — bucket 0 uses a low-alpha surface tone, buckets 1–4 increase violet saturation; no hex/rgb literals (CLAUDE.md Colors rule); ensure WCAG AA 4.5:1 contrast against the dark-mode background for any text layered over cells (FR-027)

### Page-level scroll fix

- [X] T012 Modify `components/projects/projects-container.tsx` at line 15: remove the `overflow-y-auto max-h-[calc(100vh-200px)]` classes from the wrapper div so natural page scroll carries the user past the cards to the heatmap below (FR-023)

**Checkpoint**: Foundation ready — API returns a complete `HeatmapData` envelope, theme classes and query keys exist, and the `/projects` page is scroll-compatible. User story implementation can now begin.

---

## Phase 3: User Story 1 - View AI Activity Across All Projects (Priority: P1) 🎯 MVP

**Goal**: Render the full 12-month heatmap below the project cards on `/projects`, with cells colored by job density, month and day-of-week labels, legend, and empty-state message — no spinner flash on first paint.

**Independent Test**: Sign in as a user with 300+ jobs spread across 12 months, open `/projects`, scroll past the cards, and verify a 7-row × ~53-column grid renders with cells colored by job count; zero-job cells are background-toned; the header reads "X jobs · Y tickets shipped in the last year"; users with zero activity see the centered empty-state message instead of a blank grid while legend remains visible.

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US1] Create `tests/unit/components/activity-heatmap.test.tsx` asserting: renders the 7×N grid when SSR `initialData` is provided (no spinner); renders the empty-state message "No activity to show yet — your AI work will appear here" when every cell has `jobCount === 0` while the legend stays visible (FR-008); renders a non-blocking error card "Couldn't load activity — please refresh" when `initialError` is set and `data` is undefined; header reads `"{totalJobs} jobs · {distinctShippedTickets} tickets shipped {periodLabel}"` (FR-009); legend shows exactly 5 swatches with "Less" and "More" labels (FR-007); use `renderWithProviders()` from `tests/utils/component-test-utils.tsx` and query by role — constitution: no existing component test file covers this domain (`comparison-compliance-heatmap.test.tsx` covers a per-ticket matrix, not a per-day calendar)

### Implementation for User Story 1

- [X] T014 [P] [US1] Create `components/projects/activity-heatmap-cell.tsx` — minimal cell: renders a `<div>` with class from fixed literal array `BUCKET_CLASSES = ['aurora-heatmap-bucket-0', 'aurora-heatmap-bucket-1', 'aurora-heatmap-bucket-2', 'aurora-heatmap-bucket-3', 'aurora-heatmap-bucket-4'] as const` selected by `BUCKET_CLASSES[cell.bucket]` (CLAUDE.md Tailwind-literal rule); sets `aria-label="{date}: {jobCount} jobs"`; no tooltip yet (added in US2)
- [X] T015 [P] [US1] Create `components/projects/activity-heatmap-grid.tsx` — pure presentational CSS Grid (`grid-template-rows: repeat(7, minmax(14px, 1fr))`, `grid-template-columns: repeat(N, minmax(14px, 1fr))`, `gap: 2px`); renders an `<ActivityHeatmapCell>` for every date in `[startDate, endDate]` and omits grid slots for weekdays before `startDate` or after `endDate` to produce chipped corners (FR-004); month labels row above the grid aligned to the first column of each month (FR-005); day-of-week labels column on the left, every other row labeled (FR-006)
- [X] T016 [US1] Create `components/projects/activity-heatmap.tsx` (client, `'use client'`) accepting `{ userId: string; initialData: HeatmapData | null; initialError?: { message: string } }`; derive filters from `useSearchParams()` with invalid-value coercion; `useQuery` keyed via `queryKeys.heatmap.data(userId, periodKey, agentKey)` with `initialData: filtersMatch(current, initialData.filters) ? initialData : undefined`, `refetchInterval: 15_000`, `staleTime: 10_000`; render the summary header, `<ActivityHeatmapGrid />`, legend (5 swatches "Less"→"More"), empty-state, and non-blocking error card; depends on T014, T015
- [X] T017 [US1] Modify `app/projects/page.tsx` — read `searchParams` to derive initial filters, call `await getHeatmapData(userId, initialFilters)` in try/catch (`initialData = null; initialError = { message: "Couldn't load activity — please refresh" }` on failure so `<ProjectsContainer>` still renders — spec line 200); render `<ActivityHeatmap userId={userId} initialData={initialData} initialError={initialError} />` below `<ProjectsContainer />` (FR-001)

**Checkpoint**: US1 MVP functional — a signed-in user sees the grid, summary, legend, and empty state on `/projects` with SSR initial data and 15s silent polling.

---

## Phase 4: User Story 2 - See What a Specific Day Contained (Priority: P1)

**Goal**: Hovering a cell on desktop (or tapping on mobile) reveals a tooltip with the formatted date, tickets-shipped count, and job-count · total-cost line, with cost omitted entirely when any contributing job lacks a recorded cost.

**Independent Test**: On desktop, hover a non-empty cell and verify the tooltip shows "Tuesday, April 15, 2025", "1 ticket shipped", "4 jobs · $1.23"; on mobile, tap the cell and verify the tooltip appears pinned, tap outside and it dismisses; on a day where any contributing job has `costUsd === null`, verify the tooltip shows "4 jobs" alone — no "$NaN", "$0", or fabricated cost.

### Tests for User Story 2
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T018 [P] [US2] Extend `tests/unit/components/activity-heatmap.test.tsx` with: tooltip content on hover shows `{formattedDate}` + `"{shippedTicketCount} tickets shipped"` + `"{jobCount} jobs · $X.XX"` (FR-017); cost line is entirely absent when `totalCostUsd === null` — assert no "$NaN", "$0", or dollar glyph in the tooltip DOM (FR-018); mobile path via `matchMedia('(hover: none)')` mock uses `<Popover>` with outside-click dismissal (FR-019); only one tooltip/popover is open at a time

### Implementation for User Story 2

- [X] T019 [US2] Modify `components/projects/activity-heatmap-cell.tsx` to wrap the cell in a Radix `<Tooltip>` from `@/components/ui/tooltip` when `matchMedia('(hover: none)').matches === false` (desktop) or in a Radix `<Popover>` from `@/components/ui/popover` when hover is unavailable (touch devices); content renders the `date-fns`-formatted locale date, `"{shippedTicketCount} tickets shipped"` (or "1 ticket shipped" for singular), and `"{jobCount} jobs · $X.XX"` where the cost segment is conditionally rendered only when `totalCostUsd !== null` (FR-017, FR-018); close prior popover when another opens (FR-019)

**Checkpoint**: US1 + US2 deliver the complete P1 scope — users can view AND interrogate activity.

---

## Phase 5: User Story 3 - Change the Time Window (Priority: P2)

**Goal**: Year selector above the heatmap lets the user switch from the default rolling 12-month view to a specific calendar year; only years in which the account existed appear; selection updates the URL query parameter.

**Independent Test**: Create an account in 2024, add jobs spanning 2024–2026; open `/projects` in 2026 and verify the selector lists "Last 12 months" (default) + 2026 + 2025 + 2024; selecting "2025" re-renders the grid for 2025-01-01 to 2025-12-31 and updates the URL to include `?heatmapPeriod=2025`; a user created in the current calendar year sees no selector (or sees it disabled).

### Tests for User Story 3
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T020 [P] [US3] Extend `tests/unit/components/activity-heatmap.test.tsx` with: year `<Select>` offers "Last 12 months" + each year in `availableYears` descending; selecting a year calls mocked `router.push` with a query string containing `heatmapPeriod=YYYY` and with no `heatmapPeriod` key when selecting "Last 12 months" (FR-016 — defaults never in URL); year select is not rendered when `availableYears.length === 0` (FR-012)
- [X] T021 [P] [US3] Extend `tests/integration/analytics/heatmap-route.test.ts` with: `availableYears` descends from `currentYear` down to `accountCreationYear`; `availableYears` is `[]` when the user was created in the current calendar year (FR-011 / FR-012, spec edge case line 100)

### Implementation for User Story 3

- [X] T022 [US3] Modify `components/projects/activity-heatmap.tsx` to render a year `<Select>` (from `@/components/ui/select`) above the grid with options `"Last 12 months"` + each value from `availableYears` in descending order; hide the select when `availableYears.length === 0` (FR-012); on change, compute next filters and call `router.push(nextUrl, { scroll: false })` using a `buildFilterSearchParams` helper that deletes `heatmapPeriod` when the chosen value is `'last12months'` (FR-016, research §Pattern 2)

**Checkpoint**: US3 adds analytical flexibility; the MVP (US1 + US2) remains intact.

---

## Phase 6: User Story 4 - Filter by Agent (Priority: P2)

**Goal**: Agent filter above the heatmap lets multi-agent users scope the view to one agent; filter is hidden entirely when fewer than two distinct agents appear in the user's data; effective-agent resolution correctly includes tickets that inherit `project.defaultAgent`.

**Independent Test**: Seed a user with jobs on two agents across five projects (some tickets with explicit `ticket.agent`, others inheriting `project.defaultAgent`); verify the filter appears with "All" + each agent; selecting a specific agent updates the grid counts, tooltips, and the URL to `?heatmapAgent=<AGENT>`; copy the URL, open it in another tab (signed-in), and verify the same filtered view is reproduced; a user with jobs on a single agent sees no filter.

### Tests for User Story 4
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T023 [P] [US4] Extend `tests/unit/components/activity-heatmap.test.tsx` with: agent `<Select>` is not rendered when `availableAgents` contains fewer than 2 named agents (i.e., `availableAgents.length <= 2` counting the `"all"` sentinel — FR-014); when rendered, options include "All agents" + each named agent; selecting an agent calls `router.push` with `heatmapAgent=<AGENT>` and omits the key when selecting "All agents" (FR-016)
- [X] T024 [P] [US4] Extend `tests/integration/analytics/heatmap-route.test.ts` with: effective-agent inclusion — `ticket.agent === null` on a project with `defaultAgent = CLAUDE` IS included when filter is `CLAUDE`; explicit `ticket.agent = CODEX` on a project whose `defaultAgent = CLAUDE` is NOT included when filter is `CLAUDE` (FR-015); `availableAgents` only lists agents whose jobs live in the user's `accessibleProjectIds` (FR-013)

### Implementation for User Story 4

- [X] T025 [US4] Modify `components/projects/activity-heatmap.tsx` to render an agent `<Select>` beside the year select when `availableAgents.length > 2`; options built from `availableAgents` with `"All agents"` first (FR-013); on change, call `router.push` via the shared `buildFilterSearchParams` helper so `heatmapAgent` is deleted when the chosen value is `'all'` (FR-016)
- [X] T026 [US4] Add an inline `buildFilterSearchParams(current: URLSearchParams, next: HeatmapFilters): URLSearchParams` helper inside `components/projects/activity-heatmap.tsx` that sets `heatmapPeriod` / `heatmapAgent` only when they differ from defaults and deletes them otherwise (FR-016, research §Pattern 2) — shared by the T022 year selector and the T025 agent selector

**Checkpoint**: US4 delivers agent filtering without changing grid boundaries (FR-024). US1 + US2 + US3 + US4 cover all P1 and P2 scope.

---

## Phase 7: User Story 5 - Navigate and Scroll on Mobile (Priority: P3)

**Goal**: At narrow viewports the grid overflows horizontally with cells maintaining a tappable minimum size; the day-of-week label column remains pinned to the left as the grid scrolls beneath it.

**Independent Test**: Open `/projects` at 375 px viewport width; verify the grid overflows horizontally with a scroll affordance; cells are ≥ 14 px tall/wide; drag the grid horizontally and verify the leftmost day-of-week label column stays visible (sticky) while month labels and cells scroll underneath.

### Tests for User Story 5
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T027 [P] [US5] Extend `tests/unit/components/activity-heatmap.test.tsx` asserting: the grid outer container has the `overflow-x-auto` class (FR-021); the day-of-week label column has `position: sticky` / `left-0` classes (FR-022); cell classes come from `BUCKET_CLASSES` as complete string literals (no dynamic concatenation fragments present in the DOM — CLAUDE.md Tailwind-literal rule)

### Implementation for User Story 5

- [X] T028 [US5] Modify `components/projects/activity-heatmap-grid.tsx` to wrap the grid in a div with `overflow-x-auto` (FR-021); set `grid-template-rows: repeat(7, minmax(14px, 1fr))` and `grid-template-columns: repeat(N, minmax(14px, 1fr))` so cells never shrink below 14 px (spec Auto-Resolved decision #4); apply `position: sticky; left: 0; z-index: 1; background: var(--background)` to the day-of-week label column so it remains visible during horizontal scroll (FR-022); weekday rows must not wrap to a second visual row (FR-021)

**Checkpoint**: All five user stories are independently functional. Desktop + mobile, hover + tap, default period + year + agent filters all work.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Manual QA against the spec's Success Criteria and final gate validation per CLAUDE.md commit rules.

- [ ] T029 [P] Manual QA at 375 px viewport: verify day-of-week labels stay sticky during horizontal scroll, cells remain ≥ 14 px tappable targets, and the year's grid is fully reachable (SC-005)
- [ ] T030 [P] Manual QA dark-mode contrast: verify header text, legend "Less"/"More" labels, tooltip text, and empty-state message all meet WCAG AA 4.5:1 against their backgrounds (FR-027)
- [ ] T031 [P] Manual QA URL round-trip: open `/projects?heatmapPeriod=2025&heatmapAgent=CLAUDE`, verify the year and agent selects reflect the URL values and the grid renders the 2025 CLAUDE-filtered view (SC-004)
- [ ] T032 [P] Manual QA no-spinner cold load: open `/projects` with a seeded user on a fresh session, verify the grid is painted immediately with no loading spinner flash (FR-020, SC-001)
- [ ] T033 [P] Manual QA invalid-params: open `/projects?heatmapPeriod=1999&heatmapAgent=BOGUS`, verify the heatmap renders the default rolling-12-month all-agents view and the URL is silently corrected on the next filter interaction (spec edge case "Invalid query params")
- [X] T034 Run `bun run type-check` — must pass (CLAUDE.md commit rule)
- [X] T035 Run `bun run lint` — must pass (CLAUDE.md commit rule)
- [X] T036 Run `bun run test:unit tests/unit/heatmap-aggregations.test.ts tests/unit/components/activity-heatmap.test.tsx` — must pass
- [X] T037 Run `bun run test:integration tests/integration/analytics/heatmap-route.test.ts` — must pass
- [X] T038 Verify no new Prisma migrations were generated on the branch (SC-008): `git diff main..HEAD -- prisma/migrations` must be empty

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (requires T007 server function, T008 route, T010 query keys, T011 theme classes, T012 scroll fix)
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 (extends `activity-heatmap-cell.tsx` from T014)
- **User Story 3 (Phase 5)**: Depends on Foundational + US1 (extends `activity-heatmap.tsx` from T016; server already returns `availableYears`)
- **User Story 4 (Phase 6)**: Depends on Foundational + US1 (extends `activity-heatmap.tsx` from T016; server already returns `availableAgents`)
- **User Story 5 (Phase 7)**: Depends on Foundational + US1 (extends `activity-heatmap-grid.tsx` from T015)
- **Polish (Phase 8)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Core MVP — no dependency on other stories
- **US2 (P1)**: Extends the cell component from US1 but does not change US1's behavior; independently testable (US2 tooltips can be verified even with US3/US4 filters absent)
- **US3 (P2)**: Pure additive filter UI; grid rendering logic (US1) and tooltip (US2) untouched
- **US4 (P2)**: Pure additive filter UI; independent of US3 but both modify `activity-heatmap.tsx` so they serialize at the file level (not true parallel)
- **US5 (P3)**: Pure additive grid-layout concern; independent of US2/US3/US4

### Within Each User Story

- Tests MUST be written and FAIL before implementation (constitution §III TDD)
- Types before utilities before server before route before client (Phase 2 internal order)
- Client entry component before child components when the parent owns data (T016 depends on T014 + T015 per `plan.md §Phase C`)
- Story complete (and independently validated) before moving to next priority

### Parallel Opportunities

- **Setup**: T002 can run in parallel with baseline observation after T001
- **Foundational**: T004 and T005 can run in parallel with each other (aggregation utils + their unit tests); T010 (query keys) and T011 (globals.css) and T012 (projects-container fix) can run in parallel with each other and with T004/T005 (all touch different files); T003 (types) blocks T007 (which imports them); T006 (export keyword) blocks T007; T007 blocks T008 which blocks T009
- **User Story 1**: T013 (tests) can run in parallel with T014 and T015 (different files); T016 depends on T014 and T015; T017 depends on T016
- **User Story 2**: T018 (test extension) and T019 (cell implementation) touch different files and can be drafted in parallel, but test MUST fail before T019 lands
- **User Story 3**: T020 (component test) and T021 (integration test) touch different files — parallel
- **User Story 4**: T023 (component test) and T024 (integration test) touch different files — parallel; T025 and T026 both modify `activity-heatmap.tsx` — sequential
- **User Story 5**: T027 and T028 touch different files — parallel
- **Polish**: T029–T033 (manual QA) and T034–T038 (automated gates) can all run in parallel

---

## Parallel Example: Foundational Phase

```bash
# After T003 (types) lands, run these in parallel:
Task T004: "Extend lib/analytics/aggregations.ts with quantile + bucket utilities"
Task T005: "Create tests/unit/heatmap-aggregations.test.ts covering quantile edge cases"
Task T010: "Extend app/lib/query-keys.ts with heatmap entry"
Task T011: "Add aurora-heatmap-bucket-0..4 utilities to app/globals.css"
Task T012: "Remove overflow cap from components/projects/projects-container.tsx"
```

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch in parallel:
Task T013: "Create tests/unit/components/activity-heatmap.test.tsx with SSR/empty/error tests"
Task T014: "Create components/projects/activity-heatmap-cell.tsx with BUCKET_CLASSES literal lookup"
Task T015: "Create components/projects/activity-heatmap-grid.tsx (7×N CSS grid, chipped corners)"

# Then sequentially:
Task T016: "Create components/projects/activity-heatmap.tsx (depends on T014 + T015)"
Task T017: "Modify app/projects/page.tsx to SSR initial data (depends on T016)"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T012) — blocks everything
3. Complete Phase 3: User Story 1 (T013–T017) — grid renders with SSR + polling
4. Complete Phase 4: User Story 2 (T018–T019) — tooltips on hover/tap
5. **STOP and VALIDATE**: Verify both P1 stories independently against their Independent Test criteria
6. Deploy/demo — the feature is now shippable

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. + US1 → Users see activity — Deploy (partial MVP)
3. + US2 → Users can interrogate days — Deploy (full MVP)
4. + US3 → Users can pick historical years — Deploy
5. + US4 → Multi-agent users can filter — Deploy
6. + US5 → Mobile experience is polished — Deploy
7. + Polish → Ship candidate

### Parallel Execution Strategy

After Phase 2 completes, US3, US4, and US5 are all additive and can be drafted in parallel by separate agents. US2 extends the cell component and should land before or alongside US3/US4/US5 (it does not conflict with them at the file level). US3 and US4 both modify `components/projects/activity-heatmap.tsx` and therefore must serialize at the file level — if parallelized, the second merger will need to rebase.

---

## Notes

- [P] tasks operate on different files or have no dependency on an in-progress task
- [Story] label maps tasks to user stories for traceability
- Each user story is independently completable and testable; checkpoints separate story deliverables
- Tests MUST fail before implementation (constitution §III TDD)
- Commit after each task or logical group; never use `--no-verify` (CLAUDE.md)
- **Test-file selection justification** (constitution §III): three new test files — `tests/unit/heatmap-aggregations.test.ts` (no existing file covers quantile math), `tests/integration/analytics/heatmap-route.test.ts` (sibling to `tests/integration/analytics/analytics-route.test.ts`; user-scoped route is a different concern from single-project analytics), `tests/unit/components/activity-heatmap.test.tsx` (existing `tests/unit/components/comparison-compliance-heatmap.test.tsx` covers a per-ticket compliance matrix — a different domain)
- **Forbidden patterns** enforced throughout: no `--no-verify`, no hardcoded hex/rgb in cell classes (T011, T014), no dynamic Tailwind concatenation (T014 uses literal array), no new Prisma migrations (T038 verifies SC-008), no new UI libraries (T019 uses only Radix-backed shadcn/ui primitives)
