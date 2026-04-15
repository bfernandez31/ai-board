# Research: Activity Heatmap on Projects Page

## Existing Files

### Source Files to Modify

| File | Purpose | Action |
|------|---------|--------|
| `app/projects/page.tsx` | Server component for `/projects` — fetches projects, renders layout | Extend: add heatmap data fetch, pass as `initialData` to new client component |
| `components/projects/projects-container.tsx` | Renders project cards grid with `max-h-[calc(100vh-200px)] overflow-y-auto` scroll constraint | Modify: remove scroll constraint so heatmap below grid is naturally scrollable (FR-026) |
| `app/lib/query-keys.ts` | Centralized TanStack Query key factory | Extend: add `heatmap` key namespace |

### Source Files to Reuse As-Is (Pattern References)

| File | Purpose | Reuse Reason |
|------|---------|--------------|
| `lib/analytics/queries.ts` | Analytics aggregation queries (cost, agents, shipped tickets) | Pattern for `buildJobWhere`, `buildEffectiveAgentWhere`, `getAvailableAgents`, `getCompletionMetrics` |
| `lib/analytics/aggregations.ts` | Helper functions (date formatting, trends, granularity) | Reuse `getAgentLabel`, `formatDateForGrouping` |
| `app/lib/utils/agent-resolution.ts` | `resolveEffectiveAgent`, `ALL_AGENTS`, `AGENT_LABELS` | Reuse directly for agent filter logic |
| `app/projects/[projectId]/analytics/page.tsx` | Server-fetched `initialData` → client component pattern | Pattern for SSR data hydration without dehydrate/HydrationBoundary |
| `components/analytics/analytics-dashboard.tsx` | Client component with `useQuery({ initialData, refetchInterval: 15000 })` | Pattern for silent background refetch with server-provided initial data |
| `hooks/use-usage.ts` | 15s polling hook pattern | Pattern for `refetchInterval: 15_000, staleTime: 10_000` |
| `components/ui/tooltip.tsx` | shadcn/ui Tooltip (Radix-based) | Use for heatmap cell tooltips |
| `components/ui/select.tsx` | shadcn/ui Select component | Use for year selector dropdown |

### Test Files to Extend or Reference

| File | Purpose | Action |
|------|---------|--------|
| `tests/integration/projects/projects-with-health.test.ts` | Integration tests for projects page | Reference pattern; heatmap API tests go in a new file (different domain) |
| `tests/unit/components/comparison-compliance-heatmap.test.tsx` | Unit test for existing heatmap component | Reference RTL patterns for heatmap grid testing |
| `tests/unit/activity-events.test.ts` | Unit tests for activity event derivation | Reference pattern for pure function tests |

### New Files to Create

| File | Purpose |
|------|---------|
| `lib/heatmap/queries.ts` | Server-side heatmap data aggregation (jobs by day, shipped tickets, cost, agents) |
| `lib/heatmap/types.ts` | TypeScript interfaces for heatmap data structures |
| `components/heatmap/activity-heatmap.tsx` | Main client component: grid, header, legend, filters |
| `components/heatmap/heatmap-grid.tsx` | SVG/div grid rendering with day cells, month labels, day-of-week labels |
| `components/heatmap/heatmap-tooltip.tsx` | Tooltip content for cell hover/tap |
| `app/api/heatmap/route.ts` | API route for heatmap data (cross-project aggregation) |
| `app/lib/hooks/queries/use-heatmap.ts` | TanStack Query hook with `initialData` + 60s polling |
| `tests/unit/lib/heatmap-queries.test.ts` | Unit tests for date range logic and aggregation helpers |
| `tests/unit/components/heatmap/activity-heatmap.test.tsx` | RTL component tests for heatmap rendering |
| `tests/integration/heatmap/heatmap-route.test.ts` | Integration tests for heatmap API endpoint |

## Patterns to Follow

### 1. Server-Fetched Initial Data Pattern
**Reference**: `app/projects/[projectId]/analytics/page.tsx:49-98`

The project uses a **props-based** SSR data pattern (NOT dehydrate/HydrationBoundary):
1. Server component fetches data via direct DB access (`getAnalyticsData()`)
2. Data passed as `initialData` prop to client component
3. Client component uses `useQuery({ initialData, refetchInterval })` — TanStack Query uses server data immediately, then silently refetches in background

The heatmap MUST follow this same pattern:
- `page.tsx` calls `getHeatmapData(userId)` server-side
- Passes result to `<ActivityHeatmap initialData={data} />`
- Client hook uses `initialData` to avoid loading flash (FR-020)

### 2. Polling Hook Pattern
**Reference**: `hooks/use-usage.ts:1-10`

Standard polling config:
```typescript
useQuery({
  queryKey: queryKeys.heatmap.data(year, agent),
  queryFn: () => fetchHeatmapData(year, agent),
  refetchInterval: 60_000,  // 60s — spec Decision 1 notes expensive cross-project query
  staleTime: 30_000,
  initialData,
})
```

**Decision**: Use 60s polling instead of 15s. The spec's Decision 1 reviewer notes flag that a cross-project year-spanning aggregate query may be expensive. 60s is appropriate for historical data that changes infrequently.

### 3. Effective Agent Resolution Pattern
**Reference**: `lib/analytics/queries.ts:190-245` (getAvailableAgents)

For building the agent filter options:
```typescript
// Resolve effective agent: ticket.agent ?? project.defaultAgent
const effectiveAgent = (ticket.agent ?? ticket.project.defaultAgent) as NamedAgent;
```

For filtering by agent in queries:
```typescript
// buildEffectiveAgentWhere pattern from analytics/queries.ts
OR: [
  { agent: selectedAgent },           // Explicit match
  { agent: null, project: { is: { defaultAgent: selectedAgent } } }  // Inherited
]
```

### 4. Cost Aggregation Pattern
**Reference**: `lib/analytics/queries.ts:313-328`

```typescript
const totalCost = completedJobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0);
const costsIncomplete = completedJobs.some((job) => job.costUsd == null);
```

For the heatmap tooltip: only sum non-null `costUsd` values. Omit cost line entirely when ALL jobs on that day have null cost (FR-014).

### 5. Shipped Ticket Counting Pattern
**Reference**: `lib/analytics/queries.ts:247-282` (getCompletionMetrics)

The spec requires counting shipped tickets by **completed `ship` jobs** (FR-009), NOT stage transitions. The query must:
```typescript
// Count tickets with completed 'ship' command jobs
where: {
  command: 'ship',
  status: 'COMPLETED',
  completedAt: { gte: rangeStart, lte: rangeEnd }
}
```
Attribution date = `job.completedAt` (FR-010).

### 6. Error Handling Pattern
**Reference**: Constitution §IV (Error Handling)

All API routes MUST:
- Use try-catch blocks
- Return structured `{ error: string }` responses
- Return 401/403 for auth errors
- Log errors with context

### 7. Query Key Pattern
**Reference**: `app/lib/query-keys.ts`

Add to existing `queryKeys` object:
```typescript
heatmap: {
  data: (year: string, agent: string) => ['heatmap', year, agent] as const,
}
```

## Key Decisions

### Decision 1: Heatmap Rendering Approach
- **Decision**: Pure HTML/CSS div-based grid (not SVG, not canvas, not Recharts)
- **Rationale**: GitHub's heatmap uses a simple table/grid. A div grid with CSS Grid is the simplest approach, works well with Tailwind, supports easy tooltip integration via shadcn/ui Tooltip, and is accessible. SVG adds complexity without benefit for a static grid.
- **Alternatives considered**: SVG (more complex, harder tooltip integration), Recharts (no heatmap chart type), canvas (not accessible)

### Decision 2: API Route vs. Direct Server Fetch
- **Decision**: New API route `GET /api/heatmap` for client refetching, plus direct server-side query for initial data
- **Rationale**: The `initialData` pattern requires both: server component calls query function directly, client hook calls API route for refetches. This matches the analytics dashboard pattern.
- **Alternatives considered**: Server-only (no background refresh), SWR (project uses TanStack Query)

### Decision 3: Polling Interval
- **Decision**: 60 seconds
- **Rationale**: Heatmap shows historical daily aggregates — data changes slowly. Cross-project aggregate query is expensive. 60s balances freshness with server load. Spec Decision 1 reviewer notes support a longer interval.
- **Alternatives considered**: 15s (spec default, too aggressive for this query), 120s (too stale if user just ran a job)

### Decision 4: Scroll Constraint Adjustment
- **Decision**: Remove `max-h-[calc(100vh-200px)] overflow-y-auto` from `ProjectsContainer` and let the page scroll naturally
- **Rationale**: FR-026 requires natural scrolling to reveal the heatmap below project cards. The current scroll constraint traps the grid in a fixed viewport area, preventing the heatmap from being visible without a separate scroll container.
- **Alternatives considered**: Nested scroll containers (poor UX, confusing scroll behavior)

### Decision 5: Color Scale
- **Decision**: 5-level violet gradient using `--primary-violet` and catppuccin violet/mauve tokens: `ctp-surface0` (empty) → 4 increasing violet opacities
- **Rationale**: Spec requires "violet color gradient consistent with aurora theme" (FR-005). Using existing `--primary-violet` (258 90% 66%) and `ctp-mauve` tokens ensures theme consistency.
- **Alternatives considered**: Green scale (GitHub default, doesn't match aurora theme), blue scale (conflicts with chart-4)
