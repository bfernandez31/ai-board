# Research: Activity Heatmap on Projects Page (AIB-681)

## Existing Files

### Source Files to Extend

| File | Coverage | Action |
|------|----------|--------|
| `app/projects/page.tsx` | Projects page (server component) — renders header, `UsageBanner`, `ProjectQuotaGate`, `ProjectsContainer` | **Extend**: Add heatmap section below `ProjectsContainer`; pass server-fetched heatmap initial data |
| `components/projects/projects-container.tsx` | Grid of `ProjectCard` components with `overflow-y-auto max-h-[calc(100vh-200px)]` | **Modify**: Remove or relax the `max-h` scroll constraint so the heatmap is naturally reachable below the cards (FR-021) |
| `app/lib/query-keys.ts` | Centralized TanStack Query key factory | **Extend**: Add `heatmap` key under a new top-level `heatmap` namespace |
| `lib/analytics/queries.ts` | Prisma query helpers for analytics — includes `buildEffectiveAgentWhere()` | **Reuse**: Import `buildEffectiveAgentWhere()` for heatmap agent filtering; do NOT duplicate |
| `lib/analytics/aggregations.ts` | Pure functions: `getDateRangeStart`, `formatDateForGrouping`, `getAgentLabel` | **Reuse**: Import utilities as needed for date formatting |
| `app/lib/utils/agent-resolution.ts` | `ALL_AGENTS`, `AGENT_LABELS`, `resolveEffectiveAgent()` | **Reuse as-is** for agent filter options and effective agent resolution |

### Source Files — Pattern References

| File | Pattern | Why |
|------|---------|-----|
| `app/api/projects/[projectId]/analytics/route.ts` | API route with Zod query validation, `verifyProjectAccess()`, try-catch error handling | Template for heatmap API route |
| `components/analytics/analytics-dashboard.tsx` | Client component with `initialData`, `useQuery`, URL filter sync via `useSearchParams` + `useRouter` | Template for heatmap client component architecture |
| `components/analytics/empty-state.tsx` | Empty state with centered message inside chart area | Template for heatmap empty state |
| `components/analytics/time-range-selector.tsx` | shadcn `Select` dropdown for filter UI | Template for year selector dropdown |
| `lib/analytics/types.ts` | TypeScript interfaces for analytics data contracts | Template for heatmap type definitions |

### New Files to Create

| File | Purpose |
|------|---------|
| `app/api/heatmap/route.ts` | GET endpoint aggregating cross-project heatmap data for the authenticated user |
| `lib/heatmap/types.ts` | TypeScript interfaces: `HeatmapData`, `HeatmapCell`, `HeatmapFilters`, `HeatmapPeriod` |
| `lib/heatmap/queries.ts` | Prisma queries: aggregate jobs by date across all user projects, count shipped tickets, sum cost |
| `components/heatmap/activity-heatmap.tsx` | Main client orchestrator: filter state, `useQuery`, URL sync, renders sub-components |
| `components/heatmap/heatmap-grid.tsx` | SVG/CSS grid rendering: 7-row × N-week matrix with cells, month labels, day-of-week labels |
| `components/heatmap/heatmap-tooltip.tsx` | Tooltip component: date, job count, shipped tickets, cost (conditional) |
| `components/heatmap/heatmap-legend.tsx` | Intensity legend: 5 color swatches from "Less" to "More" |
| `components/heatmap/heatmap-header.tsx` | Summary counter, year selector, agent filter |
| `app/lib/hooks/queries/use-heatmap.ts` | TanStack Query hook wrapping the heatmap API |

### Test Files

| File | Action |
|------|--------|
| `tests/integration/heatmap/heatmap-route.test.ts` | **Create**: Integration tests for `GET /api/heatmap` |
| `tests/unit/components/activity-heatmap.test.tsx` | **Create**: Component tests for heatmap rendering, tooltip, filters |
| `tests/unit/heatmap-grid.test.ts` | **Create**: Unit tests for grid date math (chipped corners, week boundaries, UTC normalization) |

No existing test files cover the heatmap domain.

---

## Patterns to Follow

### 1. Effective Agent Resolution (queries.ts:51-69)

```typescript
function buildEffectiveAgentWhere(agent: NamedAgent | 'all'): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent },
      { agent: null, project: { is: { defaultAgent: agent } } },
    ],
  };
}
```

**How to apply**: The heatmap query MUST use this exact pattern when filtering by agent. Import from `lib/analytics/queries.ts` — do NOT duplicate. The heatmap filters jobs through their parent ticket's effective agent.

### 2. API Route Error Handling (analytics/route.ts:13-51)

Pattern: Zod schema parse → `verifyProjectAccess()` → business logic → structured error responses with specific HTTP codes (400 for validation, 403 for access denied, 404 for not found, 500 for unexpected).

**How to apply**: The heatmap API route is cross-project (no single projectId), so it verifies the authenticated user's session instead of project access. But the error handling structure (Zod → auth → logic → catch) must be identical.

### 3. Server-Rendered Initial Data (analytics-dashboard.tsx:36-54)

Pattern: Server component fetches data → passes as `initialData` prop → client component uses `useQuery({ initialData })` to avoid loading flash → background refetch at interval.

**How to apply**: `app/projects/page.tsx` (server component) fetches heatmap data for default filters → passes to `<ActivityHeatmap initialData={data} />` → client component uses `useQuery` with `initialData` and `staleTime` to prevent refetch flash.

### 4. URL Filter Sync (analytics-dashboard.tsx:56-80)

Pattern: Read filters from `useSearchParams()` on mount → `useState` for local filter state → on filter change, update state AND push new URL params via `router.replace()` → `useQuery` key includes filters for automatic refetch.

**How to apply**: The heatmap uses `?year=2025&agent=CLAUDE` query params. Default values ("Last 12 months", "All agents") produce NO query params for a clean URL.

### 5. Query Key Structure (query-keys.ts:47-51)

Pattern: `analytics: { all: (id) => [...], data: (id, ...filters) => [...] }` — hierarchical keys with filter parameters for automatic cache invalidation.

**How to apply**: Add `heatmap: { all: ['heatmap'], data: (year, agent) => ['heatmap', year, agent] }` following the same pattern.

---

## Decisions

### Decision 1: API Route — User-Scoped (Cross-Project) vs Per-Project

- **Decision**: Create a single `GET /api/heatmap` endpoint scoped to the authenticated user, aggregating across ALL their projects (owned + member).
- **Rationale**: The heatmap is on the `/projects` page (not a project-specific page), showing activity across all projects. A per-project endpoint would require N requests or a separate aggregation layer.
- **Alternatives considered**: Per-project endpoint with client-side aggregation — rejected due to N+1 request problem and complexity.

### Decision 2: Heatmap Grid — Pure CSS Grid vs SVG vs Canvas

- **Decision**: Pure CSS Grid with `div` cells.
- **Rationale**: CSS Grid handles the 7×N layout natively, supports `position: sticky` for day labels on mobile scroll, integrates with Tailwind classes, and cells are naturally interactive (hover/click for tooltips). SVG would require manual event handling and can't use sticky positioning. Canvas is overkill for ~365 cells.
- **Alternatives considered**: SVG (like GitHub) — rejected because sticky labels require CSS; Canvas — rejected because interactive tooltips are harder.

### Decision 3: Data Aggregation — Server-Side vs Client-Side

- **Decision**: Server-side aggregation. The API returns pre-aggregated day-level data (date → { jobCount, shippedCount, totalCost }).
- **Rationale**: Reduces payload size (365 rows max vs potentially thousands of raw jobs). Keeps the client simple — just render the grid from the data array. Matches the analytics API pattern where all aggregation happens server-side.
- **Alternatives considered**: Client-side aggregation from raw jobs — rejected due to large payloads and unnecessary computation in the browser.

### Decision 4: Color Intensity Thresholds

- **Decision**: Use percentile-based thresholds computed server-side from the dataset. Level 0 = 0 jobs, then divide non-zero counts into quartiles for levels 1-4.
- **Rationale**: Absolute thresholds (e.g., 1-2 = low, 3-5 = medium) don't adapt to users with vastly different activity levels. Percentile-based thresholds ensure visual variety regardless of volume. This is GitHub's approach.
- **Alternatives considered**: Fixed thresholds — rejected because a power user's "low" might be a new user's "maximum".

### Decision 5: No New Database Models or Migrations

- **Decision**: The heatmap reads from existing Job and Ticket tables. No schema changes.
- **Rationale**: The spec explicitly assumes "no new database models or migrations are needed." Job.createdAt, Job.completedAt, Job.costUsd, Job.command, Job.status, and Ticket.agent provide all necessary data.
- **Alternatives considered**: Materialized view or summary table for performance — deferred unless query performance is insufficient.
