---
description: "Task list for AIB-667 — Activity Heatmap on Projects Page"
---

# Tasks: Activity Heatmap on Projects Page

**Input**: Design documents from `specs/AIB-667-copy-of-activity/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/heatmap-api.md ✅

**Tests**: Included by default (constitution §III). Three new test files — no existing file covers the account-scoped heatmap domain (verified via Phase 0 inventory in research.md).

**Organization**: Tasks are grouped by user story. Each story phase is independently implementable, testable, and deliverable.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]`, `[US2]`, `[US3]` — maps to user stories from spec.md
- File paths are exact and validated against current repo state

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the directory scaffolding and shared CSS/utility classes the feature depends on.

- [ ] T001 Create new source directory `lib/activity/` (module for heatmap domain) at repo root
- [ ] T002 [P] Add aurora-cell utility classes `aurora-cell-0` through `aurora-cell-4` in `app/globals.css` under `@layer utilities` (violet gradient per FR-005; full literal class names only — no dynamic interpolation)
- [ ] T003 [P] Register `activityHeatmap` query-key factory in `app/lib/query-keys.ts` with signature `{ data: (year, agent, tz) => [...] }`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and pure helpers that every user story phase depends on. No UI and no DB access yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 [P] Create runtime DTO types (`HeatmapFilters`, `HeatmapDay`, `HeatmapGridRange`, `HeatmapAgentOption`, `HeatmapYearOption`, `HeatmapResponse`, `HeatmapYearSelection`, `HeatmapAgentFilter`) in `lib/activity/heatmap-types.ts` per data-model.md
- [ ] T005 [P] Create pure bucketing helpers `bucketJobsByLocalDay`, `buildGridSkeleton`, `getIntensityLevel`, `getIntensityClass`, `buildYearOptions`, `buildAgentOptions` in `lib/activity/heatmap-bucketing.ts` (depends on T004 for types; `totalCostUsd` MUST be omitted — never zero-filled — when no job had cost data per FR-015/SC-008; `getIntensityClass` returns full literal class strings per CLAUDE.md Tailwind rule)
- [ ] T006 [P] Create unit tests for bucketing helpers in `tests/unit/activity/heatmap-bucketing.test.ts` (new file — no existing coverage). Cases: tz day boundaries (PST vs EST), null-cost day omits `totalCostUsd`, 2024 (Monday start) → top-left chipped, year ending mid-week → bottom-right chipped, intensity thresholds at 0/1/3/7/100, `buildYearOptions` for current-year-only account vs multi-year account. Tests MUST be written and FAIL before T005 implementation is complete (TDD per constitution §III)

**Checkpoint**: Shared types + tested pure helpers + CSS tokens ready. User story phases can now begin.

---

## Phase 3: User Story 1 - See My AI Activity at a Glance (Priority: P1) 🎯 MVP

**Goal**: Render a server-rendered heatmap below the projects grid on `/projects` with a headline counter "X jobs · Y tickets shipped in the last year", violet-gradient cells, legend, and proper empty state — no spinner flash, no tooltip yet, no filters yet.

**Independent Test**: Navigate to `/projects` as a seeded user with historical jobs and at least one successful `ship` job. Verify: heatmap renders below the project cards on first paint (no spinner), cells are shaded by job count, counter reads the correct totals, zero-activity account shows the "No activity to show yet — your AI work will appear here" centered message with the legend still visible.

### Tests for User Story 1

**NOTE**: Write these tests FIRST, ensure they FAIL before implementation.

- [ ] T007 [P] [US1] Create integration tests for `GET /api/activity/heatmap` (baseline scope, auth, ship counting, contiguous days, timezone bucketing, perf sentinel) in `tests/integration/activity/heatmap-route.test.ts` (new file — no existing integration test covers account-scoped aggregation). Cases 1–5, 8, 9, 10 from plan.md §Testing Strategy — filter/agent cases land in US3
- [ ] T008 [P] [US1] Create component tests for the MVP heatmap shell (initial render from `initialData` with no loader, empty-state message, legend visibility) in `tests/unit/components/activity-heatmap.test.tsx` (new file — no existing component test covers account-wide heatmap). Cases 1 and 8 from plan.md §Testing Strategy — tooltip/filter cases land in US2/US3

### Implementation for User Story 1

- [ ] T009 [US1] Implement Prisma aggregation query `getHeatmapData(viewerId, filters)` in `lib/activity/heatmap-queries.ts` — account-scoped (owned + member projects), status IN (COMPLETED, FAILED), `completedAt` range filter, select `ticketId/projectId/command/status/completedAt/costUsd/ticket.agent/project.defaultAgent` (depends on T004; replicates the `buildEffectiveAgentWhere` pattern from `lib/analytics/queries.ts:51-69` — agent filter path implemented here but exercised in US3)
- [ ] T010 [US1] Implement `GET /api/activity/heatmap` route in `app/api/activity/heatmap/route.ts` (requireAuth; Zod `querySchema` per contracts/heatmap-api.md; compute valid year set from `user.createdAt`; build response via `getHeatmapData` + bucketing helpers; `Cache-Control: private, no-store`; error handling mirrors `app/api/projects/[projectId]/analytics/route.ts:36-50`; depends on T005, T009)
- [ ] T011 [P] [US1] Create `ActivityHeatmapLegend` in `components/activity/activity-heatmap-legend.tsx` — renders "Less □□■■■ More" with 5 swatches using `aurora-cell-0..4` (depends on T002)
- [ ] T012 [P] [US1] Create `ActivityHeatmapCounter` in `components/activity/activity-heatmap-counter.tsx` — renders "X jobs · Y tickets shipped {periodLabel}" from `counters` prop (no filter label wording yet — just the base case "in the last year" / "in {YYYY}")
- [ ] T013 [P] [US1] Create `ActivityHeatmapCell` (MVP variant — no tooltip yet) in `components/activity/activity-heatmap-cell.tsx` — renders a single shaded div, `aria-label` includes date + job count, uses `getIntensityClass` helper
- [ ] T014 [US1] Create `ActivityHeatmapGrid` in `components/activity/activity-heatmap-grid.tsx` — 7-row grid, month labels on top, day-of-week labels pinned left, horizontal scroll on narrow viewports, chipped corners via `buildGridSkeleton`, min cell size ≥14px per SC-005 (depends on T005, T013)
- [ ] T015 [US1] Create `use-activity-heatmap` TanStack Query hook in `hooks/use-activity-heatmap.ts` — `refetchInterval: 15_000`, `staleTime: 10_000`, `placeholderData: (prev) => prev`, `refetchIntervalInBackground` left default so polling pauses when tab hidden; accepts `initialData` and `shouldUseInitialData` logic mirroring `components/analytics/analytics-dashboard.tsx:85-100` (depends on T003, T004)
- [ ] T016 [US1] Create `ActivityHeatmap` client shell (`"use client"`) in `components/activity/activity-heatmap.tsx` — composes grid + counter + legend; reads `initialData: HeatmapResponse` prop; renders centered empty-state message "No activity to show yet — your AI work will appear here" when `counters.totalJobs === 0` while keeping legend visible (FR-007); uses `useActivityHeatmap` hook (depends on T011, T012, T014, T015)
- [ ] T017 [US1] Modify `app/projects/page.tsx` to (a) fetch the initial heatmap payload server-side (pass viewer tz via header or UTC fallback per research.md Timezone Strategy) and (b) render `<ActivityHeatmap initialData={…} />` beneath `<ProjectsContainer />` (depends on T010, T016)
- [ ] T018 [US1] Modify `components/projects/projects-container.tsx` to lift the `overflow-y-auto max-h-[calc(100vh-200px)]` scroll cap so the page scrolls naturally to reveal the heatmap (FR-027)

**Checkpoint**: User Story 1 is fully functional — users see their heatmap on first paint with silent 15s polling, counter is accurate, empty state works. No tooltip, no filters yet.

---

## Phase 4: User Story 2 - Drill Into a Specific Day (Priority: P2)

**Goal**: Hovering (or tapping) a cell reveals a tooltip with the formatted date, number of tickets shipped, number of jobs, and — only when at least one job had recorded cost — the total cost. Never renders `$NaN` or `$0`.

**Independent Test**: With the US1 heatmap rendered, hover a cell for a day with 3 jobs, 1 ticket shipped, $1.42 cost — tooltip shows all four lines. Hover a cell for a day with jobs but null cost — tooltip shows job/ticket lines and the cost line is absent. On a touch device, tapping a cell opens the tooltip and tapping outside dismisses.

### Tests for User Story 2

- [ ] T019 [US2] Extend `tests/unit/components/activity-heatmap.test.tsx` with tooltip scenarios: tooltip text matches spec wording for a full-data day; tooltip DOES NOT contain `$0` or `$NaN` on a null-cost day; touch tap opens tooltip, tap outside dismisses (Cases 2, 3 from plan.md §Testing Strategy)

### Implementation for User Story 2

- [ ] T020 [US2] Enhance `components/activity/activity-heatmap-cell.tsx` to wrap the cell in a shadcn `Tooltip` (`components/ui/tooltip.tsx`) with content built from `HeatmapDay`: formatted date, "N ticket(s) shipped", "M jobs · $X.YY" where the `· $X.YY` segment is included only when `totalCostUsd !== undefined` (guard strictly on presence of the optional field, never on `> 0`). Tap-to-open / tap-outside-to-dismiss behavior for touch devices

**Checkpoint**: User Stories 1 AND 2 work together — the heatmap is informative and interactive.

---

## Phase 5: User Story 3 - Scope by Year and Agent (Priority: P2)

**Goal**: Users can narrow the heatmap by calendar year and by AI agent. Selections are reflected in the URL (`?year=…&agent=…`) and reloading the URL reproduces the exact same view. Agent filter hidden when the viewer's full history has ≤1 distinct effective agent. Year selector exposes years from the account-creation year through the current year, with "Last 12 months" as default. Counter copy adapts to the selected period.

**Independent Test**: As a user with 2+ distinct historical agents and ≥2 years of history, change the year dropdown and agent dropdown — counter and cells update without blanking, URL updates without scrolling to top. Copy the URL, open it in a new incognito tab signed in as the same user — heatmap reproduces exactly. For a single-agent account: the agent filter is not in the DOM. For a same-year account: the year Select is disabled with only "Last 12 months".

### Tests for User Story 3

- [ ] T021 [US3] Extend `tests/integration/activity/heatmap-route.test.ts` with filter scenarios: `?agent=CLAUDE` reduces counter to Claude-only totals; `agentOptions` still reflects full account history; effective-agent rule — ticket with `agent=null` on a `defaultAgent=CLAUDE` project IS counted when `?agent=CLAUDE`; year filter respects `user.createdAt` bounds and rejects out-of-range years with 400 (Cases 6, 7 from plan.md §Testing Strategy)
- [ ] T022 [US3] Extend `tests/unit/components/activity-heatmap.test.tsx` with filter scenarios: mount with `?year=2025&agent=CLAUDE` → selects reflect both values; changing year calls `router.push` with `scroll: false`; agent filter hidden when `agentOptions` has ≤1 non-all entry; agent filter rendered when ≥2 non-all entries; year Select disabled when `user.createdAt` is in the current year (Cases 4, 5, 6, 7, 9 from plan.md §Testing Strategy)

### Implementation for User Story 3

- [ ] T023 [US3] Create `ActivityHeatmapFilters` in `components/activity/activity-heatmap-filters.tsx` — shadcn `Select` for year (built from `yearOptions`) + shadcn `Select` for agent (built from `agentOptions`, hidden when <2 non-all entries); on change calls `router.push(\`?${params.toString()}\`, { scroll: false })`; reads initial values from `useSearchParams` mirroring `components/analytics/analytics-dashboard.tsx:60,105-109`
- [ ] T024 [US3] Wire `ActivityHeatmapFilters` into `components/activity/activity-heatmap.tsx`, pass current `filters`, `yearOptions`, `agentOptions`; when filters change, invalidate via the query key (not via a full reload) so cells never blank (depends on T023, T016)
- [ ] T025 [US3] Update `components/activity/activity-heatmap-counter.tsx` to render the adapted `periodLabel` ("in 2025", "in the last year") and reflect filter-aware totals from the response (depends on T012)

**Checkpoint**: All three user stories independently functional. Users can glance, drill, and scope.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification pass across the feature.

- [ ] T026 [P] Run `bun run type-check` from repo root — fix any TypeScript errors introduced
- [ ] T027 [P] Run `bun run lint` from repo root — fix any ESLint errors introduced
- [ ] T028 [P] Run `bun run test:unit tests/unit/activity/heatmap-bucketing.test.ts` and `bun run test:unit tests/unit/components/activity-heatmap.test.tsx` — all green
- [ ] T029 Run `bun run test:integration tests/integration/activity/heatmap-route.test.ts` — all green including the p95 <150ms performance sentinel
- [ ] T030 Manual viewport verification at 375px width — horizontal scroll works, day-of-week labels stay pinned, cells ≥14px on short side, no row wrapping (SC-005)
- [ ] T031 Manual verify `prisma/schema.prisma` diff is empty (SC-010 / FR-028 — zero schema changes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1 MVP)**: Depends on Phase 2 — independently deliverable
- **Phase 4 (US2 tooltip)**: Depends on Phase 3 (enhances `activity-heatmap-cell.tsx`)
- **Phase 5 (US3 filters)**: Depends on Phase 3 (wires into `activity-heatmap.tsx`); independent of Phase 4
- **Phase 6 (Polish)**: Depends on all implemented user stories

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — pure MVP
- **US2 (P2)**: Depends on US1 (cell component must exist). Independent of US3
- **US3 (P2)**: Depends on US1 (shell + query hook must exist). Independent of US2

### Within Each User Story

- Tests written and failing BEFORE implementation (constitution §III TDD)
- Types → pure helpers → queries → route → leaf components → composite components → page integration
- Commit after each task or logical group

### Parallel Opportunities

- **Phase 1**: T002 and T003 run in parallel (different files, no deps)
- **Phase 2**: T004 and T006 run in parallel; T005 depends on T004 for types
- **Phase 3**: T007 and T008 run in parallel (different test files); T011, T012, T013 run in parallel (different component files); T009 and T010 are sequential (route uses the query)
- **Phase 4**: Single task dependency chain (T019 before T020)
- **Phase 5**: T021 and T022 run in parallel (different test files); T023, T024, T025 are sequential (compose on each other)
- **Phase 6**: T026, T027, T028 run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch new test files for US1 in parallel:
Task: "Create integration tests in tests/integration/activity/heatmap-route.test.ts"
Task: "Create component tests in tests/unit/components/activity-heatmap.test.tsx"

# Launch leaf components for US1 in parallel:
Task: "Create ActivityHeatmapLegend in components/activity/activity-heatmap-legend.tsx"
Task: "Create ActivityHeatmapCounter in components/activity/activity-heatmap-counter.tsx"
Task: "Create ActivityHeatmapCell (MVP) in components/activity/activity-heatmap-cell.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational — types + bucketing + CSS tokens)
3. Complete Phase 3 (US1) — heatmap appears on `/projects` with accurate counter, empty state, silent polling
4. **STOP and VALIDATE**: Seed a test account, visit `/projects`, confirm heatmap renders with no spinner flash
5. Ship / demo — this is the core value of the feature

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US1 → Ship MVP (heatmap visible, empty state, counter)
3. US2 → Ship tooltip enhancement
4. US3 → Ship filters + URL sharing
5. Polish pass → type-check, lint, mobile verify, schema diff check

### Parallel Execution Strategy (after Phase 2)

After Foundational is complete, US2 and US3 can proceed in parallel on separate branches:
- Parallel track A: US2 (touches `activity-heatmap-cell.tsx` + its test scenarios)
- Parallel track B: US3 (touches `activity-heatmap-filters.tsx`, `activity-heatmap.tsx` wiring, counter copy)

Merge order: either first — they do not conflict on file boundaries.

---

## Notes

- **`[P]` tasks** operate on different files with no dependencies on incomplete tasks
- **`[Story]` labels** (US1/US2/US3) map each task to a user story for traceability
- **No new DB schema** — this feature composes existing `Job`, `Ticket`, `Project`, `ProjectMember`, `User` models (FR-028, SC-010). Any `create`/`update`/`delete` Prisma call in this feature is a bug
- **No hardcoded hex colors** — aurora-cell utilities + semantic Tailwind tokens only (CLAUDE.md Colors rule)
- **No dynamic Tailwind class construction** — `getIntensityClass` returns full literal class strings (CLAUDE.md Tailwind Classes rule)
- **Tests MUST fail before implementation** — verify each test runs red before the matching implementation task
- **Commit after each logical group** — hooks will run `type-check` + `lint`; fix errors fully, never use `--no-verify`
