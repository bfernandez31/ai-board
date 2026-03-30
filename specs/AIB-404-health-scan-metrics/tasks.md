# Tasks: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Input**: Design documents from `/specs/AIB-404-health-scan-metrics/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/trend-endpoint.md

**Tests**: Included per plan.md Testing Strategy (integration for trend endpoint, component tests for UI).

**Organization**: Tasks grouped by user story. US1 and US2 are independent P1 stories. US3 and US4 depend on US1 (trend data).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared types and query key configuration needed by multiple user stories

- [ ] T001 Add TrendDataPoint, TrendResponse, and extended ScanHistoryItem types in lib/health/types.ts
- [ ] T002 [P] Add health.trend query key in app/lib/query-keys.ts
- [ ] T003 [P] Create metric formatting utilities (issues, cost, tokens, duration, null→dash) in lib/health/format.ts

---

## Phase 2: User Story 1 - Dedicated Trend Data Service (Priority: P1) MVP

**Goal**: Single endpoint returning last 20 scores per active module, fetched once on dashboard mount. Data backbone for sparklines (US3) and area charts (US4).

**Independent Test**: Call GET /api/projects/:projectId/health/trend and verify it returns score arrays for all 4 active modules.

### Tests for User Story 1

- [ ] T004 [P] [US1] Integration test for trend endpoint in tests/integration/health/trend-endpoint.test.ts — test 200 with data, empty modules, auth/403, invalid projectId

### Implementation for User Story 1

- [ ] T005 [US1] Create trend API route handler in app/api/projects/[projectId]/health/trend/route.ts — 4 parallel Prisma queries (COMPLETED, non-null score, take 20, orderBy completedAt desc), reverse for oldest-first, verifyProjectAccess auth
- [ ] T006 [US1] Create useHealthTrend hook in app/lib/hooks/useHealthTrend.ts — TanStack Query with staleTime Infinity (fetch once on mount, no polling), uses health.trend query key

**Checkpoint**: Trend endpoint returns correct data. Hook fetches once on mount. Integration tests pass.

---

## Phase 3: User Story 2 - Viewing Enriched Scan History (Priority: P1)

**Goal**: Each scan history line in the drawer shows 4 compact metric icons (issues, cost, tokens, duration) with tooltips. Null values display as dash.

**Independent Test**: Open any module's scan detail drawer and verify 4 metric icons appear with correct values and tooltips on each history line.

### Tests for User Story 2

- [ ] T007 [P] [US2] Component test for enriched history metrics in tests/unit/components/drawer-history-metrics.test.tsx — render with full data, null values (dash display), tooltip text

### Implementation for User Story 2

- [ ] T008 [US2] Modify scan history API to include tokensUsed and costUsd in select clause in app/api/projects/[projectId]/health/scans/route.ts
- [ ] T009 [US2] Enrich drawer history lines with 4 metric icons (issues via AlertTriangle, cost via DollarSign, tokens via Zap, duration via Clock) with tooltips in components/health/drawer/drawer-history.tsx — use formatting utils from T003, display dash for null values

**Checkpoint**: Scan history API returns tokensUsed/costUsd. Drawer history shows 4 metric icons with tooltips. Component tests pass.

---

## Phase 4: User Story 3 - Sparkline Score Trends on Module Cards (Priority: P2)

**Goal**: Mini sparklines (~40px, no axes) on active module cards showing score trend. Visible when 3+ completed scans exist, hidden otherwise.

**Independent Test**: Verify sparklines appear on module cards when 3+ scans exist and are absent when fewer scans are available.

**Depends on**: US1 (trend data from useHealthTrend hook)

### Tests for User Story 3

- [ ] T010 [P] [US3] Component test for sparkline in tests/unit/components/sparkline.test.tsx — render with 3+ data points, hidden with <3 points, WCAG contrast (primary color)

### Implementation for User Story 3

- [ ] T011 [US3] Create Sparkline component in components/health/sparkline.tsx — Recharts LineChart in ResponsiveContainer (~40px height), hidden axes/grid/tooltip, primary color stroke, accepts TrendDataPoint[] data prop, renders nothing when data.length < 3
- [ ] T012 [US3] Add sparkline to active module cards in components/health/health-module-card.tsx — consume useHealthTrend data, pass module trend data to Sparkline component, only render for active modules (Security, Compliance, Tests, Spec Sync)

**Checkpoint**: Sparklines visible on module cards with sufficient data. Hidden when <3 scans. Component tests pass.

---

## Phase 5: User Story 4 - Area Chart in Module Drawers (Priority: P3)

**Goal**: Full area chart in each active module's detail drawer showing score evolution over time, matching Quality Gate drawer chart pattern.

**Independent Test**: Open each active module's drawer and verify area chart renders with date axis, score axis (0-100), and hover tooltip.

**Depends on**: US1 (trend data from useHealthTrend hook)

### Implementation for User Story 4

- [ ] T013 [US4] Create ModuleAreaChart component in components/health/drawer/module-area-chart.tsx — Recharts AreaChart with CartesianGrid, XAxis (date formatted), YAxis (domain [0,100]), Area (monotone, primary stroke, 10% fill), Tooltip with date+score, "Not enough data" message when <2 points
- [ ] T014 [US4] Add area chart section to scan detail drawer in components/health/scan-detail-drawer.tsx — consume useHealthTrend data, render ModuleAreaChart for the selected module, position above history section

**Checkpoint**: Area charts visible in module drawers. Hover tooltips show date+score. "Not enough data" shown when <2 scans.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories

- [ ] T015 WCAG AA contrast validation — verify all new text and graphical elements meet 4.5:1 (text) and 3:1 (non-text) contrast ratios across light and dark themes
- [ ] T016 Responsive validation — verify sparklines, metric icons, and area charts render correctly at 375px viewport width
- [ ] T017 Run quickstart.md verification steps (trend endpoint curl, scan history curl, dashboard visual check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Setup (T001, T002 for types and query keys)
- **US2 (Phase 3)**: Depends on Setup (T001, T003 for types and formatting) — independent of US1
- **US3 (Phase 4)**: Depends on US1 (trend data hook T006)
- **US4 (Phase 5)**: Depends on US1 (trend data hook T006)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Independent — data backbone
- **US2 (P1)**: Independent — only touches scan history endpoint + drawer history
- **US3 (P2)**: Depends on US1 (consumes useHealthTrend hook)
- **US4 (P3)**: Depends on US1 (consumes useHealthTrend hook)
- **US3 and US4**: Independent of each other, can run in parallel after US1

### Within Each User Story

- Tests written first, verify they compile
- API/data layer before UI components
- Core component before integration into existing components

### Parallel Opportunities

- T002 and T003 can run in parallel (different files)
- T004 and T007 and T010 can run in parallel (different test files)
- US1 and US2 can run in parallel after Setup (no shared files)
- US3 and US4 can run in parallel after US1 completes
- T013 and T011 can run in parallel (different component files)

---

## Parallel Example: After Setup

```
# US1 and US2 in parallel:
Stream A: T004 → T005 → T006     (Trend endpoint + hook)
Stream B: T007 → T008 → T009     (Enriched scan history)

# Then US3 and US4 in parallel:
Stream C: T010 → T011 → T012     (Sparklines)
Stream D: T013 → T014            (Area charts)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: US1 — Trend endpoint + hook (T004-T006)
3. Complete Phase 3: US2 — Enriched history (T007-T009)
4. **STOP and VALIDATE**: Trend endpoint returns data, history shows metrics
5. Deploy/demo if ready — core data and most visible UI enhancement delivered

### Incremental Delivery

1. Setup + US1 + US2 → MVP with data service and enriched history
2. Add US3 → Sparklines on cards → enhanced dashboard at-a-glance
3. Add US4 → Area charts in drawers → complete trend visualization
4. Polish → WCAG, responsive, quickstart validation

### Parallel Execution Strategy

1. Complete Setup sequentially (T001 first, then T002+T003 in parallel)
2. US1 and US2 in parallel (no shared files)
3. After US1: US3 and US4 in parallel
4. Polish after all stories complete

---

## Notes

- No database schema changes — all fields already exist on HealthScan model
- No new dependencies — uses existing Recharts, TanStack Query, shadcn/ui, lucide-react
- Trend data fetched once on mount (staleTime: Infinity) — no polling
- Formatting utils (T003) shared between US2 metric icons and potential future use
- Quality Gate area chart pattern (in quality-gate-drawer.tsx) is the reference for US4
