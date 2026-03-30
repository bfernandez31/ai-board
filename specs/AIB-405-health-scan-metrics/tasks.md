# Tasks: Health Scan Metrics — Trend Lines, Sparklines & History Enrichment

**Input**: Design documents from `/specs/AIB-405-health-scan-metrics/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/health-trends.md, research.md, quickstart.md

**Tests**: Included — plan.md defines integration and component test files.

**Organization**: Tasks grouped by user story. US4 (Trend Data Service) is foundational for US2 and US3.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and query key registration shared across all user stories

- [ ] T001 [P] Add `TrendDataPoint` and `HealthTrendsResponse` interfaces to lib/health/types.ts
- [ ] T002 [P] Extend `ScanHistoryItem` interface with `tokensUsed: number | null` and `costUsd: number | null` in lib/health/types.ts
- [ ] T003 Add `trends` query key to health object in app/lib/query-keys.ts

---

## Phase 2: User Story 4 — Trend Data Service (Priority: P1) 🎯 MVP

**Goal**: Dedicated data source for trend information serving both sparklines (US2) and area charts (US3) without adding load to the main health polling cycle.

**Independent Test**: Call the trend endpoint and verify it returns the correct structure with recent scores per active module.

**⚠️ CRITICAL**: US2 and US3 depend on this phase. Must complete before sparklines or area charts can be wired.

### Tests for User Story 4

- [ ] T004 [P] [US4] Integration test: trend endpoint returns correct shape in tests/integration/health/trends.test.ts
- [ ] T005 [P] [US4] Integration test: trend endpoint filters only COMPLETED scans with non-null scores in tests/integration/health/trends.test.ts
- [ ] T006 [P] [US4] Integration test: trend endpoint caps at 20 data points per module in tests/integration/health/trends.test.ts
- [ ] T007 [P] [US4] Integration test: trend endpoint returns empty arrays when no qualifying scans exist in tests/integration/health/trends.test.ts

### Implementation for User Story 4

- [ ] T008 [US4] Create trend endpoint with `verifyProjectAccess`, query last 20 COMPLETED scans per active module (SECURITY, COMPLIANCE, TESTS, SPEC_SYNC) in app/api/projects/[projectId]/health/trends/route.ts
- [ ] T009 [US4] Create `useHealthTrends` hook with `staleTime: 5min`, no polling, `refetchOnWindowFocus: false` in app/lib/hooks/useHealthTrends.ts

**Checkpoint**: Trend endpoint returns correct data. US2 and US3 can now begin.

---

## Phase 3: User Story 1 — View Scan Telemetry in History (Priority: P1) 🎯 MVP

**Goal**: Enrich scan history lines with cost, token, and duration metric icons so users can monitor operational costs at a glance.

**Independent Test**: Open any module's scan history drawer and verify each completed scan line shows 4 metric icons (issues, cost, tokens, duration) with accurate values and working tooltips.

### Tests for User Story 1

- [ ] T010 [P] [US1] Integration test: scan history API includes `tokensUsed` and `costUsd` fields in tests/integration/health/scan-history.test.ts
- [ ] T011 [P] [US1] Integration test: scan history null telemetry returns null (not zero) in tests/integration/health/scan-history.test.ts
- [ ] T012 [P] [US1] Component test: HistoryEntry renders 4 metric icons with formatted values in tests/unit/components/drawer-history.test.tsx
- [ ] T013 [P] [US1] Component test: HistoryEntry shows dash for null metrics in tests/unit/components/drawer-history.test.tsx
- [ ] T014 [P] [US1] Component test: metric icon tooltips display correct descriptive text in tests/unit/components/drawer-history.test.tsx

### Implementation for User Story 1

- [ ] T015 [US1] Add `tokensUsed: true` and `costUsd: true` to Prisma select clause in app/api/projects/[projectId]/health/scans/route.ts
- [ ] T016 [US1] Replace current issues text layout with 4 metric icons (AlertTriangle, Coins, Zap, Clock) with Tooltip wrappers and formatted values using `formatAbbreviatedNumber`, `formatCost`, `formatDuration` in components/health/drawer/drawer-history.tsx

**Checkpoint**: Scan history drawer shows enriched telemetry. Fully testable independently of sparklines/charts.

---

## Phase 4: User Story 2 — At-a-Glance Score Trends on Module Cards (Priority: P2)

**Goal**: Mini sparklines on active module cards showing score trend without opening any drawer.

**Independent Test**: View the health dashboard for a project with 3+ completed scans per module and verify sparklines appear on active module cards.

**Depends on**: Phase 2 (US4 — trend endpoint and hook)

### Tests for User Story 2

- [ ] T017 [P] [US2] Component test: sparkline renders when trendData has ≥ 3 data points in tests/unit/components/health-module-card.test.tsx
- [ ] T018 [P] [US2] Component test: sparkline hidden when trendData has < 3 data points in tests/unit/components/health-module-card.test.tsx
- [ ] T019 [P] [US2] Component test: sparkline hidden for passive modules in tests/unit/components/health-module-card.test.tsx

### Implementation for User Story 2

- [ ] T020 [US2] Add optional `trendData?: TrendDataPoint[]` prop to `HealthModuleCard` and render Recharts `LineChart` sparkline (40px, no axes, monotone, `hsl(var(--primary))`, `aria-hidden="true"`) when `!passive && trendData.length >= 3` in components/health/health-module-card.tsx
- [ ] T021 [US2] Call `useHealthTrends(projectId)` in dashboard and pass per-module trend arrays to active `HealthModuleCard` components in components/health/health-dashboard.tsx

**Checkpoint**: Dashboard shows sparklines on module cards with sufficient scan history.

---

## Phase 5: User Story 3 — Detailed Score Trend in Module Drawers (Priority: P3)

**Goal**: Full area chart with axes, dates, and hover details inside module drawers for deeper score analysis.

**Independent Test**: Open any active module's drawer for a project with historical scan data and verify the area chart renders with axes, dates, and hover tooltip.

**Depends on**: Phase 2 (US4 — trend endpoint and hook)

### Tests for User Story 3

- [ ] T022 [P] [US3] Component test: area chart renders in drawer when trend data exists in tests/unit/components/scan-detail-drawer.test.tsx

### Implementation for User Story 3

- [ ] T023 [US3] Add `trendData?: TrendDataPoint[]` prop to drawer and render Recharts `AreaChart` matching Quality Gate pattern (192px height, CartesianGrid, XAxis with dates, YAxis [0,100], Tooltip, monotone Area with `hsl(var(--primary))`) with "Score Trend" heading in components/health/scan-detail-drawer.tsx
- [ ] T024 [US3] Wire trend data from `useHealthTrends` to module drawer components via dashboard in components/health/health-dashboard.tsx

**Checkpoint**: Module drawers show full area chart with interactive hover details.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation and accessibility sweep across all user stories

- [ ] T025 Run `bun run type-check` and fix any TypeScript errors
- [ ] T026 Run `bun run lint` and fix any linting issues
- [ ] T027 Verify WCAG AA contrast compliance — all new text uses Tailwind semantic tokens only (no hardcoded colors)
- [ ] T028 Run quickstart.md validation steps (`bun run test:unit`, `bun run test:integration`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **US4 (Phase 2)**: Depends on Setup (T001 for types) — BLOCKS US2 and US3
- **US1 (Phase 3)**: Depends on Setup (T002 for types) — independent of US4, US2, US3
- **US2 (Phase 4)**: Depends on US4 completion (trend endpoint + hook)
- **US3 (Phase 5)**: Depends on US4 completion (trend endpoint + hook)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US4 (P1)**: Can start after Setup — foundational for US2/US3
- **US1 (P1)**: Can start after Setup — fully independent of other stories
- **US2 (P2)**: Can start after US4 — depends on trend data
- **US3 (P3)**: Can start after US4 — depends on trend data

### Within Each User Story

- Tests written first (fail before implementation)
- Types/interfaces before API endpoints
- API endpoints before hooks
- Hooks before UI components
- Core implementation before integration wiring

### Parallel Opportunities

- T001, T002, T003 can run in parallel (Setup phase, different concerns in same/different files)
- T004–T007 can run in parallel (US4 integration tests, same file but independent test cases)
- T010–T014 can run in parallel (US1 tests, different test files)
- T017–T019 can run in parallel (US2 component tests, same file but independent test cases)
- **US1 and US4 can execute in parallel** after Setup (no cross-dependencies)
- **US2 and US3 can execute in parallel** after US4 (both depend on trend data, different files)

---

## Parallel Example: US1 + US4 After Setup

```bash
# After Phase 1 (Setup) completes, launch US1 and US4 in parallel:

# Parallel stream A — US4 (Trend Data Service):
Task T004-T007: Integration tests for trend endpoint
Task T008: Create trend endpoint route
Task T009: Create useHealthTrends hook

# Parallel stream B — US1 (Scan Telemetry):
Task T010-T014: Integration + component tests for history enrichment
Task T015: Extend scan history API select clause
Task T016: Add metric icons to drawer-history.tsx
```

---

## Parallel Example: US2 + US3 After US4

```bash
# After US4 completes, launch US2 and US3 in parallel:

# Parallel stream A — US2 (Sparklines):
Task T017-T019: Component tests for sparkline
Task T020: Add sparkline to HealthModuleCard
Task T021: Wire trend data in dashboard

# Parallel stream B — US3 (Area Charts):
Task T022: Component test for area chart
Task T023: Add area chart to drawer
Task T024: Wire trend data to drawer
```

---

## Implementation Strategy

### MVP First (US4 + US1)

1. Complete Phase 1: Setup (types + query keys)
2. Complete Phase 2: US4 — Trend Data Service (endpoint + hook)
3. Complete Phase 3: US1 — Scan Telemetry in History (API + icons)
4. **STOP and VALIDATE**: Both P1 stories independently testable
5. Deploy/demo if ready — users see enriched scan history

### Incremental Delivery

1. Setup → Foundation ready
2. US4 + US1 (parallel) → Trend API + enriched history → Test independently → MVP!
3. US2 + US3 (parallel) → Sparklines + area charts → Test independently → Full feature
4. Polish → Type-check, lint, accessibility → Ship

### Parallel Execution Strategy

1. Complete Setup (Phase 1) sequentially
2. Launch US4 and US1 in parallel (both P1, no cross-dependencies)
3. After US4 completes, launch US2 and US3 in parallel
4. Polish after all stories complete
