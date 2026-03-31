# Tasks: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Input**: Design documents from `/specs/AIB-412-copy-of-copy/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included — plan.md defines a full testing strategy (integration, unit, component tests).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Types, query keys, and shared definitions needed across all user stories

- [ ] T001 [P] Add `TrendDataPoint` and `ModuleTrends` interfaces to `lib/health/types.ts`
- [ ] T002 [P] Add `tokensUsed: number | null` and `costUsd: number | null` to `ScanHistoryItem` interface in `lib/health/types.ts`
- [ ] T003 [P] Add `trends` query key to health section in `app/lib/query-keys.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API endpoints and client hook that MUST be complete before any user story UI work can begin

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add `tokensUsed: true` and `costUsd: true` to Prisma select clause in GET handler of `app/api/projects/[projectId]/health/scans/route.ts`
- [ ] T005 Create health trends GET endpoint in `app/api/projects/[projectId]/health/trends/route.ts` — validate projectId, verify access via `verifyProjectAccess()`, parse optional `limit` param (default 20, Zod 1-100), run 4 parallel Prisma queries per ACTIVE_SCAN_TYPE for COMPLETED scans with non-null scores, return `{ trends }` per contract
- [ ] T006 Create `useHealthTrends` hook in `app/lib/hooks/useHealthTrends.ts` — TanStack Query hook with `staleTime: 60_000`, `gcTime: 300_000`, no polling, returns typed `ModuleTrends`

**Checkpoint**: API and data layer ready — user story UI implementation can now begin

---

## Phase 3: User Story 1 + User Story 5 — View Enriched Scan History Metrics (Priority: P1) 🎯 MVP

**Goal**: Each completed scan in the history drawer shows score badge + up to 4 compact metric icons (issues, cost, tokens, duration) with tooltips. The scan history API returns `tokensUsed` and `costUsd` fields.

**Independent Test**: Open any module's scan history drawer after completing scans and verify all four metric icons appear with correct values and tooltips.

### Tests for User Story 1

- [ ] T007 [P] [US1] Create unit tests for metric formatting utilities in `tests/unit/health/format.test.ts` — test `formatCost`, `formatTokens`, `formatDuration` per plan Test 3 scenarios
- [ ] T008 [P] [US1] Create component tests for HistoryEntry metric icons in `tests/unit/components/health/drawer-history.test.tsx` — test all 4 icons present when telemetry exists, hidden for null values, tooltip text, no "X issues" text per plan Test 5 scenarios
- [ ] T009 [P] [US1] Create integration test for scan history telemetry fields in `tests/integration/health/scan-history-telemetry.test.ts` — verify `tokensUsed` and `costUsd` in response, null for scans without telemetry per plan Test 2 scenarios

### Implementation for User Story 1

- [ ] T010 [P] [US1] Create metric formatting utilities in `lib/health/format.ts` — `formatCost(costUsd)` → `"$0.42"`, `formatTokens(tokens)` → `"12.5k"` / `"1.2M"`, `formatDuration(ms)` → `"2.3s"` / `"1m 15s"`
- [ ] T011 [US1] Update `HistoryEntry` in `components/health/drawer/drawer-history.tsx` — replace "X issues" text with 4 metric icons (`AlertTriangle`, `Coins`, `Zap`, `Clock` from lucide-react, 12px), each with formatted value and shadcn/ui `Tooltip`, conditional on non-null values, horizontal flex layout with gap-2

**Checkpoint**: At this point, User Story 1 + 5 should be fully functional — enriched scan history with telemetry visible in drawer

---

## Phase 4: User Story 2 — View Score Trend Sparklines on Module Cards (Priority: P2)

**Goal**: Each active module card on the health dashboard shows a mini sparkline (~40px, no axes) of recent score trend when 3+ completed scans exist.

**Independent Test**: Run 3+ scans for a module and verify a sparkline appears on its card on the dashboard.

### Tests for User Story 2

- [ ] T012 [P] [US2] Create component tests for Sparkline in `tests/unit/components/health/sparkline.test.tsx` — renders nothing with <3 points, renders chart container with 3+ points, no axes/labels/grid per plan Test 4 scenarios

### Implementation for User Story 2

- [ ] T013 [P] [US2] Create `Sparkline` component in `components/health/sparkline.tsx` — `ResponsiveContainer` height={40}, `LineChart` with `Line` type="monotone" dot={false} strokeWidth={1.5}, color from prop, no axes/grid/tooltip/legend, return null if data.length < 3
- [ ] T014 [US2] Add optional `trendData` prop to `HealthModuleCard` in `components/health/health-module-card.tsx` — conditionally render `<Sparkline>` when `trendData.length >= 3`, color from `getScoreColor()` text class

**Checkpoint**: At this point, sparklines appear on module cards with sufficient data

---

## Phase 5: User Story 3 — View Score Trend Area Chart in Module Drawers (Priority: P2)

**Goal**: Each active module's drawer shows a full area chart of score evolution over time, matching the Quality Gate drawer pattern (date axis, score 0-100, hover tooltip).

**Independent Test**: Open any active module's drawer and verify the area chart renders with correct historical scores and interactive hover.

### Implementation for User Story 3

- [ ] T015 [P] [US3] Extract `ScoreTrendChart` component from Quality Gate drawer into `components/health/drawer/score-trend-chart.tsx` — accepts `data: { date: string; score: number }[]`, renders `ResponsiveContainer` > `AreaChart` with CartesianGrid, XAxis (date), YAxis (0-100), Tooltip, Area (primary color, monotone)
- [ ] T016 [US3] Refactor Quality Gate drawer to use `ScoreTrendChart` in `components/health/drawer/quality-gate-drawer.tsx` — replace inline AreaChart JSX (lines 136-165) with `<ScoreTrendChart data={data.trendData} />`
- [ ] T017 [US3] Add `trendData` prop and `ScoreTrendChart` to `ScanDetailDrawer` in `components/health/scan-detail-drawer.tsx` — render "Score Trend" section with `h-48` container between header and history, only when `trendData.length > 0`

**Checkpoint**: At this point, area charts appear in module drawers with score history

---

## Phase 6: User Story 4 — Dashboard Integration & Efficient Trend Fetching (Priority: P3)

**Goal**: Trend data is fetched once on dashboard mount via a single request and shared to all module cards (sparklines) and drawers (area charts). Not included in the 2s health polling cycle.

**Independent Test**: Monitor network requests on dashboard load — verify a single trends request is made, polling requests exclude trend data, and drawer charts render from pre-fetched data.

### Tests for User Story 4

- [ ] T018 [P] [US4] Create integration tests for trends endpoint in `tests/integration/health/trends.test.ts` — verify trend data for all 4 module types, only COMPLETED scans with non-null scores, respects limit param, empty arrays for no data, 401/403 for unauthorized per plan Test 1 scenarios

### Implementation for User Story 4

- [ ] T019 [US4] Wire `useHealthTrends(projectId)` into `HealthDashboard` in `components/health/health-dashboard.tsx` — compute per-module trend arrays from `trends.data`, pass `trendData` prop to each `HealthModuleCard` and `ScanDetailDrawer`

**Checkpoint**: All user stories fully wired — sparklines on cards, area charts in drawers, enriched history, single efficient fetch

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories

- [ ] T020 Verify WCAG AA compliance (4.5:1 contrast) across all new components — metric icons use `text-muted-foreground`, sparkline colors from `getScoreColor()`, area chart uses `hsl(var(--primary))`
- [ ] T021 Run `bun run type-check` and `bun run lint` to verify all new code passes
- [ ] T022 Run quickstart.md validation steps (`bun run test:unit`, `bun run test:integration`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types) — BLOCKS all user stories
- **US1+US5 (Phase 3)**: Depends on Phase 2 (API returns telemetry fields)
- **US2 (Phase 4)**: Depends on Phase 2 (trend data available via hook)
- **US3 (Phase 5)**: Depends on Phase 2 (trend data available via hook)
- **US4 (Phase 6)**: Depends on Phases 4 and 5 (components exist to receive trend data)
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **US1+US5 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P2)**: Can start after Foundational — no dependencies on other stories
- **US3 (P2)**: Can start after Foundational — no dependencies on other stories (but T016 depends on T015)
- **US4 (P3)**: Depends on US2 and US3 — wires their components into the dashboard

### Within Each User Story

- Tests written first (when included), verified to fail before implementation
- Types/utilities before UI components
- Core components before integration
- Story complete before dashboard wiring

### Parallel Opportunities

- **Phase 1**: All tasks (T001, T002, T003) can run in parallel — different files/sections
- **Phase 2**: T004 and T005 can run in parallel (different files); T006 depends on T003 (query key)
- **Phase 3**: Tests T007, T008, T009 in parallel; T010 in parallel with tests; T011 depends on T010
- **Phase 4**: T012 and T013 in parallel (different files); T014 depends on T013
- **Phase 5**: T015 independent; T016 depends on T015; T017 depends on T015
- **Phase 3, 4, 5**: Can all start in parallel after Phase 2 completes

---

## Parallel Example: Phases 3, 4, 5 (After Foundational)

```bash
# These three user stories can execute in parallel after Phase 2:

# Stream 1 — US1 (Enriched History):
Task T010: "Create formatting utilities in lib/health/format.ts"
Task T011: "Update HistoryEntry with metric icons in drawer-history.tsx"

# Stream 2 — US2 (Sparklines):
Task T013: "Create Sparkline component in components/health/sparkline.tsx"
Task T014: "Add sparkline to HealthModuleCard in health-module-card.tsx"

# Stream 3 — US3 (Area Charts):
Task T015: "Extract ScoreTrendChart in score-trend-chart.tsx"
Task T016: "Refactor QG drawer to use ScoreTrendChart"
Task T017: "Add area chart to ScanDetailDrawer"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 5 Only)

1. Complete Phase 1: Setup (types, query keys)
2. Complete Phase 2: Foundational (API endpoints, hook)
3. Complete Phase 3: US1+US5 (enriched history metrics)
4. **STOP and VALIDATE**: Scan history shows all telemetry metrics with tooltips
5. Deploy/demo if ready — operational telemetry is now visible

### Incremental Delivery

1. Setup + Foundational → API and data layer ready
2. Add US1+US5 → Enriched scan history → Deploy/Demo (MVP!)
3. Add US2 → Sparklines on cards → Deploy/Demo
4. Add US3 → Area charts in drawers → Deploy/Demo
5. Add US4 → Dashboard wiring connects everything → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, US1, US2, US3 can run in parallel:
   - Parallel stream 1: US1+US5 (enriched history)
   - Parallel stream 2: US2 (sparklines)
   - Parallel stream 3: US3 (area charts)
3. After US2 + US3 complete, US4 wires dashboard integration
4. Polish phase validates everything end-to-end

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- No schema changes needed — all HealthScan fields already exist
- All dependencies (Recharts, TanStack Query, lucide-react, shadcn/ui) already in package.json
- 13 files total: 5 new, 8 modified
