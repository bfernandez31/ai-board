# Implementation Plan: Activity Heatmap on Projects Page

**Ticket**: AIB-651
**Branch**: `AIB-651-activity-heatmap-on`
**Spec**: `specs/AIB-651-activity-heatmap-on/spec.md`

## Technical Context

| Aspect | Detail |
|--------|--------|
| Framework | Next.js 16 App Router, React 18, TypeScript 5.9 strict |
| Styling | TailwindCSS 3.4, aurora theme (violet/mauve gradient tokens in globals.css) |
| Data fetching | TanStack Query v5 with 15s polling, SSR initial data |
| Database | PostgreSQL via Prisma 6.x — no new models (FR-023) |
| Auth | NextAuth.js session-based (`requireAuth()` from `lib/db/auth-helpers`) |
| Existing patterns | Per-project analytics at `lib/analytics/queries.ts`, dashboard at `components/analytics/` |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TS with explicit types |
| II. Component-Driven | PASS | Feature folder `components/heatmap/`, shadcn/ui for Select dropdown, server component default |
| III. Test-Driven | PASS | Unit tests for utils, component tests for heatmap, integration tests for API |
| IV. Security-First | PASS | Zod validation on API params, auth check, no raw SQL |
| V. Database Integrity | PASS | Read-only queries, no schema changes |
| V. Spec Guardrails | PASS | Auto-resolved decisions documented in spec with trade-offs |

## Design Artifacts

- `research.md` — decisions, existing files, patterns to follow
- `data-model.md` — derived TypeScript interfaces and query patterns
- `contracts/heatmap-api.md` — GET /api/heatmap request/response contract

## Implementation Phases

### Phase 1: Data Layer (Backend)

**Goal**: API endpoint returning aggregated heatmap data across all user projects.

#### 1.1 Type Definitions
- **Create** `lib/heatmap/types.ts`
  - `HeatmapDay`, `HeatmapData`, `HeatmapFilters` interfaces (from data-model.md)
  - Reuse `AgentOption` from `lib/analytics/types`
  - Reuse `AGENT_FILTER_VALUES` for Zod validation

#### 1.2 Query Functions
- **Create** `lib/heatmap/queries.ts`
  - `getHeatmapData(userId, filters)`: main aggregation function
  - Queries COMPLETED jobs across all projects owned by user
  - Groups by date, sums costUsd (null-safe), collects shipped ticketKeys
  - Reuse `buildEffectiveAgentWhere()` pattern from `lib/analytics/queries.ts:51-69`
  - Date range: "last-12-months" = today - 364 days (Sunday-aligned); calendar year = Jan 1 – Dec 31
  - Available agents: derived from distinct effective agents across all user projects
  - Available years: derived from distinct years in user's completed job data

#### 1.3 API Route
- **Create** `app/api/heatmap/route.ts`
  - Follow pattern from `app/api/projects/[projectId]/analytics/route.ts`
  - Zod schema: `year` (enum "last-12-months" + dynamic years), `agent` (AGENT_FILTER_VALUES)
  - Auth: `requireAuth()` (user-scoped, not project-scoped)
  - Error handling: ZodError → 400, auth → 401, fallback → 500

### Phase 2: Client Utilities

**Goal**: Pure functions for grid computation and color bucketing.

#### 2.1 Heatmap Utils
- **Create** `lib/heatmap/utils.ts`
  - `buildHeatmapGrid(days, periodStart, periodEnd)`: generates 7×53 cell matrix with chipped corners
  - `computeIntensityLevels(cells)`: quartile-based bucketing (0-4 levels)
  - `getPeriodBounds(year)`: returns `{ start: Date, end: Date }` for "last-12-months" or calendar year
  - `getMonthLabels(periodStart)`: returns month label positions for top axis
  - `getDayLabels()`: returns abbreviated day-of-week labels (Mon, Wed, Fri)
  - All functions are pure — no side effects, fully unit-testable

### Phase 3: UI Components

**Goal**: Heatmap rendering with interactivity.

#### 3.1 Main Container
- **Create** `components/heatmap/activity-heatmap.tsx` (client component)
  - TanStack Query: `useQuery` with `queryKeys.heatmap.data(year, agent)`, 15s `refetchInterval`
  - `initialData` prop from server component for zero-flash rendering (FR-011)
  - Filter state: `year` and `agent` in `useState`, synced to URL search params (FR-018)
  - Header: summary line "X jobs · Y tickets shipped in the last year" (FR-007)
  - Delegates to sub-components: grid, filters, legend, tooltip

#### 3.2 Grid Component
- **Create** `components/heatmap/heatmap-grid.tsx`
  - CSS Grid: 7 rows × N columns, ~14px cells with 2px gap
  - Violet gradient colors using aurora theme tokens (`--ctp-mauve`, `--primary-violet`)
  - 5 intensity levels: `bg-muted` (0), 4 violet opacity steps
  - Chipped corners: cells outside period bounds are invisible
  - Month labels along top (FR-005)
  - Day-of-week labels on left, sticky for mobile scroll (FR-019)
  - Mobile: horizontal scroll container, cells maintain tappable size (FR-020)

#### 3.3 Tooltip Component
- **Create** `components/heatmap/heatmap-tooltip.tsx`
  - Desktop: shows on hover (mouseenter/mouseleave)
  - Mobile: shows on tap, dismisses on outside tap (FR-014)
  - Content: formatted date, job count, cost (only if non-null), shipped tickets (FR-012, FR-013)
  - Positioning: above cell by default, repositions below near top edge
  - Uses absolute positioning relative to grid container

#### 3.4 Filter Controls
- **Create** `components/heatmap/heatmap-filters.tsx`
  - Year selector: shadcn/ui `Select` with "Last 12 months" default + available years (FR-009)
  - Hidden when only "Last 12 months" available (FR-010)
  - Agent filter: shadcn/ui `Select` with "All" + available agents (FR-015, FR-016)
  - Hidden when 0 or 1 agents
  - Filter changes update URL params and trigger re-fetch

#### 3.5 Legend Component
- **Create** `components/heatmap/heatmap-legend.tsx`
  - "Less" label → 5 colored squares → "More" label (FR-006)
  - Uses same violet gradient as grid cells

#### 3.6 Empty State
- Inline in `activity-heatmap.tsx`: when zero activity after filters, show centered message (FR-021)
- "No activity to show yet — your AI work will appear here"
- Legend and filters remain visible

### Phase 4: Page Integration

**Goal**: Wire heatmap into the projects page.

#### 4.1 Layout Adjustment
- **Modify** `components/projects/projects-container.tsx`
  - Remove `overflow-y-auto max-h-[calc(100vh-200px)]` wrapper (FR-022)
  - Page scrolls naturally to reveal both project cards and heatmap

#### 4.2 Server Data Fetching
- **Modify** `app/projects/page.tsx`
  - Add `getHeatmapData()` call (parallel with `getProjects()`)
  - Pass heatmap initial data to `ActivityHeatmap` component
  - Render `ActivityHeatmap` below `ProjectsContainer`

#### 4.3 Query Key Registration
- **Modify** `app/lib/query-keys.ts`
  - Add `heatmap: { data: (year, agent) => [...] }` query key

## Testing Strategy

### Unit Tests (Pure functions — `tests/unit/lib/heatmap-utils.test.ts`)
- `buildHeatmapGrid`: correct 7×53 matrix, chipped corners, Sunday alignment
- `computeIntensityLevels`: quartile bucketing with edge cases (1 day, all same count, sparse data)
- `getPeriodBounds`: "last-12-months" starts on Sunday, calendar years correct
- `getMonthLabels`: correct positions and labels

### Component Tests (`tests/unit/components/heatmap/activity-heatmap.test.tsx`)
- Renders grid with correct number of cells for a known period
- Shows summary counter with correct totals
- Renders legend with 5 intensity levels
- Empty state when zero activity
- Year selector hidden when user created this year
- Agent filter hidden when ≤1 agent
- Tooltip shows correct content on cell hover
- Filter changes update displayed data

### Integration Tests (`tests/integration/heatmap/heatmap-route.test.ts`)
- Returns 401 for unauthenticated requests
- Returns correct daily job counts for seeded data
- Filters by agent with effective agent resolution
- Filters by calendar year
- Cost aggregation: null when no costs, correct sum when partial costs
- Shipped tickets: only counts COMPLETED ship jobs, deduplicates same-day
- Available years derived from actual data
- Invalid filter values return 400

## Implementation Order

1. Phase 1 (Data Layer) — can be tested via integration tests immediately
2. Phase 2 (Utils) — pure functions, unit tested independently
3. Phase 3 (UI Components) — depends on Phase 1+2
4. Phase 4 (Page Integration) — final wiring

Phases 1 and 2 can be implemented in parallel.
