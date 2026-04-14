# Research: Activity Heatmap on Projects Page

**Ticket**: AIB-643
**Date**: 2026-04-14

## Decisions

### D1: Data Aggregation Strategy
- **Decision**: New cross-project API endpoint aggregates Job + Ticket data server-side using Prisma
- **Rationale**: The heatmap needs data from ALL user projects (owner + member), not a single project. Existing analytics queries in `lib/analytics/queries.ts` are per-project. A new endpoint that aggregates across projects is needed.
- **Alternatives considered**: Client-side aggregation (N+1 requests, bad perf), reuse per-project analytics (doesn't support cross-project)

### D2: Color Scale Implementation
- **Decision**: 5-level violet intensity using CSS custom properties, thresholds based on percentile of user's own max daily activity
- **Rationale**: Spec requires violet palette with WCAG AA contrast. Catppuccin theme already has `--ctp-mauve` and `--primary-violet` tokens. Percentile-based thresholds prevent a single high-activity day from washing out all other days.
- **Alternatives considered**: Absolute thresholds (punishes low-activity users), 3-level scale (too coarse)

### D3: Year Selector Range
- **Decision**: Query distinct years from user's job data to populate year options
- **Rationale**: Shows only years with actual data, avoids empty year options. The "Last 12 months" option is always first and default.
- **Alternatives considered**: Hardcoded year range (shows empty years), derive from account creation (may have no data for early years)

### D4: Client vs Server Rendering
- **Decision**: Heatmap is a client component with TanStack Query for data fetching (15s polling like analytics)
- **Rationale**: The heatmap has interactive controls (year selector, agent filter, tooltips) requiring client-side state. TanStack Query provides caching and polling. Server rendering the initial data is unnecessary since the projects page is already force-dynamic.
- **Alternatives considered**: Server component with client interactivity wrapper (adds complexity for minimal benefit)

### D5: Scroll Constraint Fix
- **Decision**: Remove `overflow-y-auto max-h-[calc(100vh-200px)]` from `ProjectsContainer` wrapper div
- **Rationale**: Current constraint clips content below project cards (see `components/projects/projects-container.tsx:15`). The heatmap renders below the grid and needs natural page scroll. Remove the constraint entirely — the page container handles overflow.
- **Alternatives considered**: Placing heatmap inside the scroll container (breaks layout intent), using position sticky (unnecessary complexity)

## Existing Files

### Source Files to Modify
| File | What it covers | Action |
|------|---------------|--------|
| `app/projects/page.tsx` | Projects page server component | Extend — add ActivityHeatmap below ProjectsContainer |
| `components/projects/projects-container.tsx` | Project cards grid with scroll constraint | Modify — remove overflow/max-height constraint |
| `app/lib/query-keys.ts` | TanStack Query key registry | Extend — add `heatmap` key |

### Source Files as Pattern References
| File | Pattern to extract |
|------|-------------------|
| `lib/analytics/queries.ts` | Prisma query patterns for Job/Ticket aggregation, agent filtering with `buildEffectiveAgentWhere` |
| `lib/analytics/aggregations.ts` | Date grouping utilities (`formatDateForGrouping`, `getDateRangeStart`) |
| `components/comparison/comparison-compliance-heatmap.tsx` | Heatmap grid rendering with tooltips and aurora styling |
| `hooks/use-usage.ts` | TanStack Query hook pattern with polling |
| `lib/db/projects.ts:27-42` | Cross-project query with owner+member access (WHERE OR pattern) |
| `lib/db/auth-helpers.ts` | `requireAuth` + project access verification |
| `app/lib/utils/agent-resolution.ts` | ALL_AGENTS array and AGENT_LABELS for agent filter options |

### New Files to Create
| File | Purpose |
|------|---------|
| `app/api/activity-heatmap/route.ts` | GET endpoint — aggregates job/ticket data across all user projects |
| `components/projects/activity-heatmap.tsx` | Main heatmap client component (grid, controls, tooltip) |
| `lib/activity-heatmap/types.ts` | TypeScript types for heatmap data |
| `lib/activity-heatmap/queries.ts` | Prisma query functions for heatmap aggregation |

### Test Files
| File | Action |
|------|--------|
| `tests/integration/activity-heatmap/route.test.ts` | **Create** — integration test for the API endpoint |
| `tests/unit/components/activity-heatmap.test.tsx` | **Create** — component test for heatmap rendering |

No existing test files cover activity heatmap or cross-project aggregation.

## Patterns to Follow

### P1: Cross-Project Data Access (from `lib/db/projects.ts:27-42`)
```typescript
// Pattern: Query across all projects the user owns or is a member of
where: {
  OR: [
    { userId },                          // Owner access
    { members: { some: { userId } } }   // Member access
  ]
}
```
The heatmap API MUST use this same OR pattern to aggregate jobs from all accessible projects.

### P2: Agent Filtering (from `lib/analytics/queries.ts:51-69`)
```typescript
// Pattern: Resolve effective agent from ticket.agent ?? project.defaultAgent
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
The heatmap MUST use this same pattern for agent filtering to match analytics behavior.

### P3: TanStack Query Hook (from `hooks/use-usage.ts`)
```typescript
// Pattern: Query with polling interval and stale time
export function useUsage() {
  return useQuery({
    queryKey: usageKeys.current(),
    queryFn: fetchUsage,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
```
The heatmap hook should follow this pattern with 15s polling to match analytics refresh rate.

### P4: Tooltip Pattern (from `components/comparison/comparison-compliance-heatmap.tsx:1-8`)
```typescript
// Pattern: shadcn Tooltip with TooltipProvider wrapper
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><div className="..." /></TooltipTrigger>
    <TooltipContent><p>...</p></TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### P5: Aurora Styling (from `components/comparison/comparison-compliance-heatmap.tsx:13-26`)
```typescript
// Pattern: Aurora-styled cells with CSS utility classes
// Use Card with className="border-ctp-mauve/15 aurora-bg-subtle" for the container
// Use cursor-pointer rounded for interactive cells
```

### P6: API Route Auth (from `lib/db/auth-helpers.ts:18-20`)
```typescript
// Pattern: Use requireAuth() to get userId for cross-project queries
const userId = await requireAuth(request);
```
The heatmap API endpoint MUST use `requireAuth()` directly since it's not project-scoped.

### P7: Error Handling (from `lib/analytics/queries.ts`)
```typescript
// Pattern: API routes use try-catch with structured error responses
// Return { error: string } with appropriate HTTP status codes
// Cost data with null handling: jobs with null costUsd included in counts, excluded from cost totals
```
