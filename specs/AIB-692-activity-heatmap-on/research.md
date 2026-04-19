# Research: Activity Heatmap on Projects Page

## Resolved Unknowns

### 1. Heatmap Grid Rendering Approach

- **Decision**: Pure CSS/HTML grid (no Recharts). Use a `<div>` grid with CSS Grid layout.
- **Rationale**: GitHub-style contribution heatmaps are simple grids of colored cells. Recharts is designed for line/bar/area charts with axes and scales. A CSS Grid with 7 rows (days) and ~53 columns (weeks) is simpler, more performant, and easier to style with the aurora violet theme.
- **Alternatives considered**: Recharts heatmap (no native heatmap type, would require custom cells), SVG-based approach (unnecessary complexity), HTML `<table>` (less flexible for sticky columns).

### 2. Quantile-Based Intensity Calculation

- **Decision**: Compute intensity thresholds on the server. Return raw daily counts + threshold breakpoints in the API response. Client maps count to intensity level using the thresholds.
- **Rationale**: Server-side threshold computation avoids shipping the full data distribution to the client and keeps the algorithm consistent. The API returns `thresholds: [q25, q50, q75, q90]` alongside daily data. Client only needs simple comparisons.
- **Alternatives considered**: Client-side computation (wastes bandwidth shipping raw data distribution), fixed thresholds (poor UX for low/high activity users).

### 3. Server-Provided Initial Data

- **Decision**: Fetch heatmap data in the server component (`ProjectsPage`), pass as `initialData` prop to a client `ActivityHeatmap` component.
- **Rationale**: Follows the exact pattern established in `analytics-dashboard.tsx:92-100` where `initialData` is passed to `useQuery` to avoid loading flash.
- **Alternatives considered**: Client-only fetch with skeleton (violates FR-017), streaming/suspense (overengineered for this use case).

### 4. URL Query Parameters on Projects Page

- **Decision**: Use `useSearchParams` + `useRouter().push()` to sync heatmap filters to URL, following the pattern in `analytics-dashboard.tsx:85-109`.
- **Rationale**: Proven pattern in the codebase. `router.push('?...', { scroll: false })` updates URL without scroll jump.
- **Alternatives considered**: `nuqs` library (adds dependency), custom history API (fragile).

### 5. Scroll Constraint on Projects Page

- **Decision**: Remove the `overflow-y-auto max-h-[calc(100vh-200px)]` from `projects-container.tsx:15` so the page scrolls naturally to reveal the heatmap below.
- **Rationale**: FR-023 requires natural page scrolling. The current constraint clips the projects grid to the viewport height, which would hide the heatmap. The page itself should scroll, not the projects grid.
- **Alternatives considered**: Keeping the constraint and placing the heatmap above the grid (violates spec: heatmap goes below cards).

### 6. Shipped Ticket Counting

- **Decision**: Count tickets with a COMPLETED `ship` command job within the selected period (not based on stage transitions).
- **Rationale**: Spec explicitly states "shipped tickets are counted based on successful completion of a `ship` workflow job, not stage transitions" (FR-006, SC-003).
- **Alternatives considered**: Stage-based counting (spec forbids it).

### 7. Mobile Horizontal Scrolling with Sticky Labels

- **Decision**: Use `overflow-x-auto` on the grid container with `position: sticky; left: 0` on day-of-week label cells, matching the pattern in `comparison-compliance-heatmap.tsx:66,79`.
- **Rationale**: Proven sticky column pattern already in use. CSS `position: sticky` is well-supported on modern browsers.
- **Alternatives considered**: Virtualized scrolling (overkill for 53 columns), transform-based pinning (breaks on iOS Safari).

## Existing Files

### Source Files to Modify

| File | What it covers | Action |
|------|---------------|--------|
| `app/projects/page.tsx` | Projects page server component | Extend: add heatmap data fetch, pass to new `ActivityHeatmap` client component |
| `components/projects/projects-container.tsx` | Project cards grid with scroll constraint | Modify: remove `overflow-y-auto max-h-[calc(100vh-200px)]` |
| `app/lib/query-keys.ts` | TanStack Query key registry | Extend: add `heatmap` key under `projects` |

### Source Files as Pattern References

| File | Pattern | Lines |
|------|---------|-------|
| `components/analytics/analytics-dashboard.tsx` | URL filter sync, initial data, polling, Select filters | 60-109 |
| `components/comparison/comparison-compliance-heatmap.tsx` | Tooltip, sticky columns, aurora cell styling | 27-125 |
| `lib/analytics/queries.ts` | `buildEffectiveAgentWhere()` for agent resolution | 51-69 |
| `lib/analytics/queries.ts` | `buildJobWhere()` for Prisma job filtering | 147-163 |
| `app/lib/hooks/queries/use-project-activity.ts` | Polling pattern with `useQuery` | Full file |
| `components/activity/activity-feed.tsx` | Empty state pattern | Full file |
| `lib/db/projects.ts` | `requireAuth()` for user session | 28-35 |
| `app/globals.css` | `--primary-violet`, `aurora-bg-subtle`, aurora utility classes | 38-41, 315-317 |

### New Files to Create

| File | Responsibility |
|------|---------------|
| `app/api/projects/activity-heatmap/route.ts` | GET endpoint: daily job counts, shipped tickets, cost aggregation |
| `components/activity-heatmap/activity-heatmap.tsx` | Client component: grid rendering, filters, tooltips |
| `components/activity-heatmap/types.ts` | TypeScript types for heatmap data and props |
| `components/activity-heatmap/heatmap-grid.tsx` | Grid rendering sub-component (if >300 lines in parent) |
| `lib/heatmap/queries.ts` | Server-side data aggregation and threshold calculation |
| `lib/heatmap/types.ts` | Shared types for API request/response |
| `tests/unit/components/activity-heatmap.test.tsx` | Component tests for heatmap rendering |
| `tests/integration/activity-heatmap/api.test.ts` | Integration tests for heatmap API |

### Test Files

| Existing test file | Relevance | Action |
|-------------------|-----------|--------|
| `tests/unit/components/comparison-compliance-heatmap.test.tsx` | Pattern reference for heatmap component testing | Reference only |
| `tests/unit/components/analytics-dashboard.test.tsx` | Pattern for testing components with useSearchParams, filters | Reference only |
| `tests/unit/components/projects/` | Projects page component tests | May need update if `ProjectsContainer` interface changes |

## Patterns to Follow

### 1. Effective Agent Resolution (lib/analytics/queries.ts:51-69)

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
**Where to apply**: Heatmap API query to filter jobs by effective agent.

### 2. Initial Data + Polling Pattern (analytics-dashboard.tsx:92-100)

```typescript
const { data } = useQuery({
  queryKey: queryKeys.analytics.data(projectId, filters.range, filters.outcome, filters.agent),
  queryFn: () => fetchAnalytics(projectId, filters),
  initialData: shouldUseInitialData ? initialData : undefined,
  refetchInterval: 15000,
  staleTime: 10000,
});
```
**Where to apply**: Heatmap client component. Use 60000ms refetchInterval, 30000ms staleTime.

### 3. URL Filter Sync Pattern (analytics-dashboard.tsx:105-109)

```typescript
const updateFilters = (nextFilters: Filters) => {
  setFilters(nextFilters);
  const params = buildFilterSearchParams(searchParams, nextFilters);
  router.push(`?${params.toString()}`, { scroll: false });
};
```
**Where to apply**: Heatmap year/agent filter changes.

### 4. Tooltip in Grid Cells (comparison-compliance-heatmap.tsx:102-114)

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <div data-testid="heatmap-cell" className={cellStyle.className} />
  </TooltipTrigger>
  <TooltipContent>
    <p className="max-w-xs text-sm">{content}</p>
  </TooltipContent>
</Tooltip>
```
**Where to apply**: Each heatmap cell.

### 5. Sticky Column for Horizontal Scroll (comparison-compliance-heatmap.tsx:66,79)

```tsx
<th className="sticky left-0 z-10 ... aurora-bg-subtle">Label</th>
```
**Where to apply**: Day-of-week labels on mobile horizontal scroll.

### 6. Error Handling in API Routes

All API routes use try-catch with structured error responses. Auth failures return 401. The heatmap API must follow the same pattern as `app/api/projects/[projectId]/analytics/route.ts`.
