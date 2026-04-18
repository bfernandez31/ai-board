# Implementation Plan: Activity Heatmap on Projects Page (AIB-681)

**Branch**: `AIB-681-activity-heatmap-on`
**Spec**: `specs/AIB-681-activity-heatmap-on/spec.md`
**Status**: Ready for implementation

## Technical Context

| Aspect | Details |
|--------|---------|
| **Framework** | Next.js 16 (App Router), React 18, TypeScript 5.9 strict |
| **Data Layer** | Prisma 6.x → PostgreSQL 14+; existing Job/Ticket/Project models (no migrations) |
| **State** | TanStack Query v5 with server-rendered `initialData` pattern |
| **Styling** | TailwindCSS 3.4, shadcn/ui, aurora theme tokens (`--primary-violet`, `--ctp-mauve`) |
| **Charts** | Custom CSS Grid (not Recharts — heatmap is a grid, not a chart) |
| **Auth** | NextAuth.js session; user-scoped API (no per-project access check) |
| **Existing patterns** | `lib/analytics/queries.ts` (agent resolution), `components/analytics/analytics-dashboard.tsx` (initialData + URL sync) |

## Constitution Check

| Rule | Status | Notes |
|------|--------|-------|
| TypeScript strict, no `any` | PASS | All new types explicitly defined in `lib/heatmap/types.ts` |
| shadcn/ui components only | PASS | Year selector uses shadcn `Select`; tooltip uses `Popover` or custom positioned div |
| Server Components by default | PASS | `app/projects/page.tsx` stays server; heatmap is `"use client"` (interactive) |
| Feature-based folder structure | PASS | `components/heatmap/` for all heatmap components |
| Tests verify behavior from specs | PASS | Integration tests for API, unit tests for grid math, component tests for UI |
| Search existing tests FIRST | PASS | No existing heatmap tests — all new files (verified in research.md) |
| Validate inputs with Zod | PASS | API route validates `year` and `agent` params with Zod |
| No raw SQL | PASS | All queries via Prisma |
| Mocks target same module instance | PASS | Tests will mock `lib/heatmap/queries.ts` at import level |
| No hardcoded hex/rgb colors | PASS | Uses Tailwind semantic tokens and CSS custom properties |

## Implementation Phases

### Phase 1: Types & Data Layer

**Goal**: Types, Prisma queries, and API endpoint — the foundation everything else depends on.

#### Task 1.1: Define heatmap types

- **File**: `lib/heatmap/types.ts` (CREATE)
- **What**: `HeatmapCell`, `HeatmapPeriod`, `HeatmapFilters`, `HeatmapData`, `HeatmapAgentOption` interfaces
- **Pattern**: Mirror `lib/analytics/types.ts` structure
- **Spec refs**: FR-004 (cell intensity), FR-008 (summary counter), FR-012 (tooltip data)

#### Task 1.2: Implement heatmap queries

- **File**: `lib/heatmap/queries.ts` (CREATE)
- **What**: `getHeatmapData(userId, filters)` function:
  1. Get user's project IDs (owned + member) via Prisma
  2. Query jobs grouped by `DATE(createdAt)` for job counts and cost aggregation
  3. Separate query for shipped tickets: `command = 'ship'` AND `status = 'COMPLETED'`, grouped by `DATE(completedAt)`
  4. Query available agents (distinct effective agents across user's tickets)
  5. Compute percentile-based intensity thresholds from non-zero job counts
  6. Get user's `createdAt` for available years calculation
- **Pattern**: Import `buildEffectiveAgentWhere()` from `lib/analytics/queries.ts` (do NOT duplicate — export it if not already exported). Follow the parallel `Promise.all` pattern from `lib/analytics/queries.ts`.
- **Key rules**:
  - All dates UTC-normalized (FR edge case)
  - `costUsd` aggregated only for non-null values; `totalCost = null` when all null (FR-013)
  - Ship counting uses `completedAt` date, not `createdAt` (FR-009)
  - Running jobs count toward activity on their `createdAt` date (edge case)
- **Spec refs**: FR-004, FR-009, FR-013, FR-014, FR-015, FR-016

#### Task 1.3: Create API endpoint

- **File**: `app/api/heatmap/route.ts` (CREATE)
- **What**: `GET /api/heatmap` with Zod-validated query params (`year`, `agent`)
- **Pattern**: Follow `app/api/projects/[projectId]/analytics/route.ts` exactly:
  - Zod schema with `.default()` values
  - Session auth (not project access — this is user-scoped)
  - try-catch with structured error responses (400/401/500)
  - `Cache-Control: no-store` header
- **Contract**: See `contracts/heatmap-api.md`
- **Spec refs**: FR-004 through FR-019

### Phase 2: Core Heatmap UI

**Goal**: Render the heatmap grid with data — the P1 visual experience.

#### Task 2.1: Create heatmap grid component

- **File**: `components/heatmap/heatmap-grid.tsx` (CREATE)
- **What**: CSS Grid rendering 7 rows × N weeks:
  - Compute grid dimensions from period start/end dates
  - Render month labels along top, day-of-week labels (Mon, Wed, Fri) on left
  - Render cells with intensity-based background colors using violet scale
  - Handle "chipped corners" — omit cells before first day and after last day of period
  - Minimum cell size for tappable targets on mobile (FR-020)
  - Horizontal scroll container with sticky day-of-week labels (FR-020)
- **Color scale**: 5 levels using CSS custom properties:
  - Level 0 (empty): `bg-ctp-surface-0` or `bg-muted/30`
  - Level 1-4: Violet gradient from `hsl(var(--primary-violet) / 0.2)` to `hsl(var(--primary-violet) / 1.0)`
- **Pattern**: Pure CSS Grid with `grid-template-rows: repeat(7, 1fr)` and `grid-auto-flow: column`
- **Spec refs**: FR-001 through FR-007, FR-020

#### Task 2.2: Create tooltip component

- **File**: `components/heatmap/heatmap-tooltip.tsx` (CREATE)
- **What**: Positioned tooltip showing:
  - Formatted date (e.g., "March 15, 2025")
  - "X tickets shipped" (if any)
  - "Y jobs" or "Y jobs · $Z.ZZ" (cost only when non-null)
  - "No activity" for empty cells
- **Behavior**: Desktop = hover; mobile = tap-to-show, tap-outside-to-dismiss
- **Pattern**: Use absolute positioning relative to cell; clamp to viewport on mobile
- **Spec refs**: FR-012, FR-013, Decision 2 (cost display), Decision 5 (mobile interaction)

#### Task 2.3: Create legend component

- **File**: `components/heatmap/heatmap-legend.tsx` (CREATE)
- **What**: Row of 5 color swatches with "Less" and "More" labels, positioned bottom-right
- **Pattern**: Simple flex row with same color classes as grid cells
- **Spec refs**: FR-007

#### Task 2.4: Create header component

- **File**: `components/heatmap/heatmap-header.tsx` (CREATE)
- **What**:
  - Summary counter: "X jobs · Y tickets shipped in the last year" (or period label)
  - Year selector: shadcn `Select` dropdown with "Last 12 months" + year options
  - Agent filter: shadcn `Select` dropdown, hidden when ≤1 distinct agent
- **Conditional rendering**:
  - Year selector hidden (static label) when `accountCreatedYear === currentYear` (FR-011)
  - Agent filter hidden when `availableAgents.length <= 2` (only "all" + one agent) (FR-015)
- **Pattern**: Follow `components/analytics/time-range-selector.tsx` for Select dropdown styling
- **Spec refs**: FR-008, FR-010, FR-011, FR-014, FR-015

#### Task 2.5: Create empty state

- **What**: Centered message "No activity to show yet — your AI work will appear here" replacing the grid when `cells` is empty
- **Can be inline** in the main orchestrator component (< 20 lines)
- **Spec refs**: FR-018

### Phase 3: Orchestration & Integration

**Goal**: Wire everything together — data fetching, filter state, URL sync, page integration.

#### Task 3.1: Create TanStack Query hook

- **File**: `app/lib/hooks/queries/use-heatmap.ts` (CREATE)
- **What**: `useHeatmap(filters, initialData)` hook wrapping `useQuery`:
  - Query key: `queryKeys.heatmap.data(year, agent)`
  - Fetch function: `GET /api/heatmap?year=...&agent=...`
  - `initialData` for SSR — no loading flash (FR-019)
  - `staleTime: 60_000` (1 minute — heatmap data changes slowly)
  - `refetchInterval: 60_000` (background refresh every minute)
  - `refetchOnWindowFocus: true`
- **Pattern**: Follow `app/lib/hooks/queries/use-project-activity.ts` structure
- **Spec refs**: FR-019

#### Task 3.2: Add query key

- **File**: `app/lib/query-keys.ts` (MODIFY)
- **What**: Add `heatmap` namespace:
  ```typescript
  heatmap: {
    all: ['heatmap'] as const,
    data: (year: string, agent: string) => ['heatmap', year, agent] as const,
  },
  ```

#### Task 3.3: Create main orchestrator component

- **File**: `components/heatmap/activity-heatmap.tsx` (CREATE)
- **What**: `"use client"` component that:
  1. Reads filters from `useSearchParams()` (year, agent)
  2. Manages local filter state with `useState`
  3. Uses `useHeatmap(filters, initialData)` for data
  4. On filter change: updates state + pushes URL params via `router.replace()`
  5. Renders `HeatmapHeader`, `HeatmapGrid` (or empty state), `HeatmapLegend`
- **URL sync**: Default filters produce NO query params (clean URL). Non-default filters add `?year=2025&agent=CLAUDE`.
- **Pattern**: Follow `components/analytics/analytics-dashboard.tsx` structure exactly (initialData prop, filtersMatch, getInitialFilters, buildFilterSearchParams)
- **Spec refs**: FR-017, FR-019, Decision 6

#### Task 3.4: Integrate into projects page

- **File**: `app/projects/page.tsx` (MODIFY)
- **What**:
  1. Import and call `getHeatmapData()` server-side for default filters
  2. Render `<ActivityHeatmap initialData={heatmapData} />` below `ProjectsContainer`
  3. Wrap in a section with appropriate spacing
- **Spec refs**: FR-001, FR-019, FR-021

#### Task 3.5: Fix projects container scroll constraint

- **File**: `components/projects/projects-container.tsx` (MODIFY)
- **What**: Remove `max-h-[calc(100vh-200px)]` from the outer div so the page scrolls naturally to reveal the heatmap below the project cards
- **Spec refs**: FR-021

### Phase 4: Polish & Edge Cases

**Goal**: Mobile UX, accessibility, edge case handling.

#### Task 4.1: Mobile horizontal scroll

- **What**: In `heatmap-grid.tsx`, ensure:
  - Outer container has `overflow-x-auto` for horizontal scroll
  - Day-of-week labels use `position: sticky; left: 0` with `z-index` to stay pinned
  - Cells maintain minimum 11px size (with 44px touch target via padding/spacing)
- **Spec refs**: FR-020

#### Task 4.2: WCAG contrast verification

- **What**: Verify all 5 violet intensity levels pass WCAG AA 4.5:1 contrast against:
  - Dark theme page background (`--background`)
  - Empty cell color vs page background (must be distinguishable)
- **Spec refs**: Decision 1 reviewer notes

#### Task 4.3: Keyboard accessibility

- **What**: Cells should be focusable (tabIndex) and show tooltip on Enter/Space. Not explicitly in spec but required for accessibility compliance.

## Testing Strategy

### Unit Tests

**File**: `tests/unit/heatmap-grid.test.ts` (CREATE)

Tests for pure grid computation functions (extracted or tested via component):
- Grid dimensions for rolling 12-month window (365/366 days)
- Grid dimensions for specific calendar years (2024 leap year, 2025 non-leap)
- Chipped corners: period starting mid-week, ending mid-week
- Intensity level assignment from thresholds (0 jobs → level 0, within quartiles → levels 1-4)
- UTC date normalization edge cases (DST boundary dates)
- Available years calculation from user creation date

### Component Tests

**File**: `tests/unit/components/activity-heatmap.test.tsx` (CREATE)

Tests for rendered UI behavior:
- Heatmap renders with correct number of cells for a given period
- Tooltip appears on hover with correct data (job count, shipped count, cost)
- Tooltip shows "No activity" for empty cells
- Cost line omitted when `totalCost` is null (FR-013)
- Year selector shows correct options based on `accountCreatedYear`
- Year selector hidden when `accountCreatedYear === currentYear` (FR-011)
- Agent filter hidden when ≤1 agent (FR-015)
- Empty state message shown when no cells (FR-018)
- Summary counter displays correct totals (FR-008)
- Legend renders 5 color swatches

### Integration Tests

**File**: `tests/integration/heatmap/heatmap-route.test.ts` (CREATE)

Tests for the `GET /api/heatmap` endpoint:
- Returns aggregated data for authenticated user's projects
- Filters by year (rolling vs specific calendar year)
- Filters by agent (effective agent resolution — ticket agent AND project default)
- Returns correct `shippedCount` (only COMPLETED ship jobs)
- Returns null `totalCost` when all jobs lack cost data
- Returns correct `thresholds` (percentile-based)
- Returns correct `availableYears` based on user creation date
- Returns 401 for unauthenticated requests
- Returns 400 for invalid year or agent parameters
- Returns empty cells array for period with no activity
- Excludes projects where user is neither owner nor member

### Test Type Rationale (Constitution §III Decision Tree)

| Test | Type | Rationale |
|------|------|-----------|
| Grid date math | Unit | Pure functions with no side effects (rule 1) |
| Component rendering | Component (RTL) | React components with user interactions (rule 2) |
| API endpoint | Integration | Database operations via Prisma (rule 3) |
| No E2E | — | No browser-only requirements (OAuth, drag-drop, viewport); all testable at lower levels |

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Query performance for users with many projects/jobs | Leverages existing indexes on `Job(projectId)` and `Job(startedAt)`; max 365 rows returned; monitor query time |
| `buildEffectiveAgentWhere` not exported | May need to export it from `lib/analytics/queries.ts`; alternatively, extract to shared utility |
| `max-h` removal on projects container | May affect users with many projects who relied on contained scrolling; the full page now scrolls instead |
| Percentile thresholds with few data points | Handle edge cases: 1 day → all level 4; 2-3 days → simplified bucket assignment |

## File Manifest

| Action | File |
|--------|------|
| CREATE | `lib/heatmap/types.ts` |
| CREATE | `lib/heatmap/queries.ts` |
| CREATE | `app/api/heatmap/route.ts` |
| CREATE | `components/heatmap/activity-heatmap.tsx` |
| CREATE | `components/heatmap/heatmap-grid.tsx` |
| CREATE | `components/heatmap/heatmap-tooltip.tsx` |
| CREATE | `components/heatmap/heatmap-legend.tsx` |
| CREATE | `components/heatmap/heatmap-header.tsx` |
| CREATE | `app/lib/hooks/queries/use-heatmap.ts` |
| MODIFY | `app/lib/query-keys.ts` |
| MODIFY | `app/projects/page.tsx` |
| MODIFY | `components/projects/projects-container.tsx` |
| CREATE | `tests/unit/heatmap-grid.test.ts` |
| CREATE | `tests/unit/components/activity-heatmap.test.tsx` |
| CREATE | `tests/integration/heatmap/heatmap-route.test.ts` |
