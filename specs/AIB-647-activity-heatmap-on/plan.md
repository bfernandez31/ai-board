# Implementation Plan: Activity Heatmap on Projects Page

**Branch**: `AIB-647-activity-heatmap-on`
**Spec**: `specs/AIB-647-activity-heatmap-on/spec.md`
**Status**: Ready for implementation

---

## Technical Context

| Aspect | Details |
|--------|---------|
| **Data Source** | Existing `Job` and `Ticket` tables (no new models — SC-008) |
| **API** | New `GET /api/heatmap` route (user-scoped, cross-project aggregation) |
| **UI** | New `components/heatmap/` feature folder with client components |
| **Rendering** | CSS grid with div cells (no Recharts — heatmap is a fixed grid, not a chart) |
| **State** | TanStack Query with 15s polling, local filter state (year, agent) |
| **Styling** | Violet palette via CSS custom properties, aurora theme tokens |
| **Tooltip** | shadcn/ui `Tooltip` component |
| **Mobile** | Horizontal scroll with `overflow-x-auto`, sticky day labels |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code will use strict types, explicit interfaces for `HeatmapData`, `HeatmapDayCell`, `HeatmapFilters` |
| II. Component-Driven | PASS | Feature folder `components/heatmap/`, shadcn/ui primitives (Select, Tooltip), Server Component page + Client Component heatmap |
| III. Test-Driven | PASS | Integration test for API route, component tests for heatmap UI. New test files needed (no existing coverage). |
| IV. Security-First | PASS | Zod validation on query params, `requireAuth()` for user ID, Prisma parameterized queries |
| V. Database Integrity | PASS | Read-only feature, no mutations. Existing indexes support the queries. |
| V. Spec Guardrails | PASS | Auto-resolved decisions documented in spec with trade-offs |

## Gate Evaluation

- **No new dependencies**: Pure implementation using existing stack (TanStack Query, shadcn/ui, Tailwind)
- **No schema changes**: Queries existing tables only
- **No security concerns**: Auth-gated, parameterized queries, no sensitive data exposure
- **No breaking changes**: Additive UI (new section below existing cards), one behavioral change (remove scroll constraint on project grid)

---

## Implementation Phases

### Phase 1: Data Layer (API + Query Functions)

**Files to create:**
- `lib/heatmap/types.ts` — TypeScript interfaces (`HeatmapData`, `HeatmapDayCell`, `HeatmapFilters`, `IntensityLevel`)
- `lib/heatmap/queries.ts` — Prisma query functions (daily jobs, daily shipped, available years/agents)
- `app/api/heatmap/route.ts` — GET handler with Zod validation, auth, and JSON response

**Pattern references:**
- Auth: `requireAuth()` from `lib/db/users.ts` (same as `getUserProjects`)
- Agent filter: `buildEffectiveAgentWhere()` from `lib/analytics/queries.ts:51-69`
- Parallel queries: `Promise.all()` pattern from `lib/analytics/queries.ts:649-667`
- Zod validation: pattern from `app/api/projects/[projectId]/analytics/route.ts`

**Key implementation details:**
- Query jobs across all projects where user is owner OR member (same WHERE clause as `getUserProjects` in `lib/db/projects.ts:30-35`)
- Group by `DATE(startedAt)` for job counts/cost, `DATE(completedAt)` for shipped tickets
- Date range: rolling 12 months (`new Date(now - 365 days)` to now) or Jan 1–Dec 31 for specific year
- Return sparse array (only days with activity) — client fills gaps

### Phase 2: Query Hook + Query Keys

**Files to modify:**
- `app/lib/query-keys.ts` — Add `heatmap` section

**Files to create:**
- `app/lib/hooks/queries/use-heatmap.ts` — `useHeatmap()` hook wrapping `useQuery` with 15s polling

**Pattern reference:**
- `app/lib/hooks/queries/use-project-activity.ts` — `useQuery` with `refetchInterval: 15000`, `staleTime: 10000`

### Phase 3: Heatmap UI Components

**Files to create (all in `components/heatmap/`):**
- `activity-heatmap.tsx` — Main client component: orchestrates grid, header, filters, tooltip
- `heatmap-grid.tsx` — Pure presentational: renders 52x7 CSS grid with colored cells, month labels, day labels
- `heatmap-cell.tsx` — Single cell with tooltip on hover (shadcn Tooltip)
- `heatmap-header.tsx` — Summary line: "X jobs · Y tickets shipped in the last year"
- `heatmap-legend.tsx` — Intensity scale from "Less" to "More"
- `heatmap-filters.tsx` — Year selector dropdown + agent filter (shadcn Select)

**Pattern references:**
- Filter dropdowns: `components/analytics/time-range-selector.tsx` (shadcn Select pattern)
- Empty state: `components/analytics/empty-state.tsx`
- Tooltip: shadcn/ui `<Tooltip>/<TooltipTrigger>/<TooltipContent>`

**Key implementation details:**
- Grid: CSS grid `grid-template-columns: auto repeat(53, 1fr)` (day labels + 53 week columns)
- Color levels: 5 CSS classes mapping to violet opacity/saturation levels using `--ctp-mauve` or custom violet tokens
- Month labels: Calculate which week column each month starts in, render label above that column
- Day labels: Render Mon/Wed/Fri on left column (GitHub convention per FR-004)
- Tooltip content: "N tickets shipped · M jobs · $X.XX" and formatted date; "No activity" for empty cells (FR-010, FR-011, FR-012)
- Mobile: `overflow-x-auto` wrapper with `position: sticky` on day label column (FR-017)

### Phase 4: Page Integration

**Files to modify:**
- `app/projects/page.tsx` — Add `<ActivityHeatmap />` section below `ProjectsContainer`
- `components/projects/projects-container.tsx` — Remove `overflow-y-auto max-h-[calc(100vh-200px)]` constraint (FR-015)

### Phase 5: Tests

**Files to create:**
- `tests/integration/heatmap/heatmap-route.test.ts` — API route tests
  - Seed jobs across multiple projects for test user
  - Verify response shape, daily aggregation accuracy
  - Test year filter (rolling vs specific year)
  - Test agent filter
  - Test empty state (no jobs)
  - Test auth (401 without session)
  - Pattern: follows `tests/integration/analytics/analytics-route.test.ts`

- `tests/unit/components/activity-heatmap.test.tsx` — Component tests
  - Mock `useHeatmap` hook return value
  - Verify grid renders 7 rows (days of week)
  - Verify month labels render
  - Verify header shows correct summary
  - Verify tooltip content on cell hover
  - Verify year selector changes filter
  - Verify agent filter changes filter
  - Verify empty state message
  - Pattern: follows `tests/unit/components/analytics-dashboard.test.tsx`

---

## Testing Strategy

| Test Type | File | Coverage |
|-----------|------|----------|
| Integration | `tests/integration/heatmap/heatmap-route.test.ts` | API data aggregation, filters, auth, edge cases |
| Component | `tests/unit/components/activity-heatmap.test.tsx` | UI rendering, interactions, filter changes, tooltip, empty state |

**Decision tree applied:**
- API route with database queries → Vitest integration test
- React component with user interactions (hover, select) → Vitest + RTL component test
- No E2E needed: no browser-specific features (no OAuth, no drag-drop, no viewport-dependent behavior beyond CSS)

---

## File Inventory

### New Files (9)
| Path | Purpose |
|------|---------|
| `lib/heatmap/types.ts` | TypeScript interfaces |
| `lib/heatmap/queries.ts` | Prisma query functions |
| `app/api/heatmap/route.ts` | API endpoint |
| `app/lib/hooks/queries/use-heatmap.ts` | TanStack Query hook |
| `components/heatmap/activity-heatmap.tsx` | Main client component |
| `components/heatmap/heatmap-grid.tsx` | Grid renderer |
| `components/heatmap/heatmap-cell.tsx` | Cell + tooltip |
| `components/heatmap/heatmap-header.tsx` | Summary metrics |
| `components/heatmap/heatmap-legend.tsx` | Intensity legend |
| `components/heatmap/heatmap-filters.tsx` | Year + agent dropdowns |
| `tests/integration/heatmap/heatmap-route.test.ts` | API tests |
| `tests/unit/components/activity-heatmap.test.tsx` | Component tests |

### Modified Files (3)
| Path | Change |
|------|--------|
| `app/projects/page.tsx` | Add heatmap section below project cards |
| `components/projects/projects-container.tsx` | Remove scroll constraint |
| `app/lib/query-keys.ts` | Add `heatmap` query key section |
