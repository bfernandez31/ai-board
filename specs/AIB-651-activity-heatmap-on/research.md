# Research: Activity Heatmap on Projects Page

## Decisions

### 1. Data Aggregation Strategy
- **Decision**: Server-side aggregation via a new API endpoint, returning pre-bucketed daily job counts for the selected period
- **Rationale**: The heatmap needs cross-project data (all user projects), which differs from the existing per-project analytics API. A dedicated endpoint avoids overloading the existing analytics route and returns a compact payload (~365 daily buckets max).
- **Alternatives considered**: Client-side aggregation (too many round trips), reuse existing analytics API (scoped to single project, wrong shape)

### 2. Color Intensity Scale
- **Decision**: Quartile-based bucketing from the user's actual data distribution (5 levels: 0, 1-25th, 25-50th, 50-75th, 75th+)
- **Rationale**: Adapts to users with vastly different activity volumes. Spec auto-resolved this as CONSERVATIVE.
- **Alternatives considered**: Fixed thresholds (would render poorly for low/high activity users)

### 3. Data Refresh Interval
- **Decision**: 15-second polling interval using TanStack Query, consistent with analytics dashboard pattern
- **Rationale**: Matches established polling intervals (analytics: 15s). Heatmap data changes infrequently but consistency with project patterns is preferred.
- **Alternatives considered**: 60s interval (diverges from established patterns)

### 4. Grid Layout Algorithm
- **Decision**: 7 rows (Sun-Sat) x 53 columns (weeks), rendered as CSS Grid with fixed cell sizes
- **Rationale**: Matches GitHub heatmap layout. CSS Grid provides native alignment without SVG complexity. 14px cells + 2px gap fits 52+ weeks at 1280px viewport.
- **Alternatives considered**: SVG-based rendering (more complex, no accessibility benefit), Recharts (overkill for a grid)

### 5. Shipped Ticket Counting
- **Decision**: Count tickets with a COMPLETED `ship` command job on that day (not stage transitions)
- **Rationale**: FR-008 explicitly requires this — stage changes to SHIP without a completed ship job must NOT count.
- **Alternatives considered**: Stage-based counting (rejected by spec)

### 6. Timezone Handling
- **Decision**: Server returns UTC dates; client groups by local timezone using `toLocaleDateString()`
- **Rationale**: Edge case spec says "Job dates are based on completedAt timestamp, displayed in user's local timezone"
- **Alternatives considered**: Server-side timezone conversion (requires knowing user TZ, adds complexity)

## Existing Files

### Source Files to Modify

| File | What it covers | Action |
|------|---------------|--------|
| `app/projects/page.tsx` | Projects page (server component) | Extend: add heatmap data fetching, pass as prop |
| `components/projects/projects-container.tsx` | Project cards grid with scroll constraint | Modify: remove `overflow-y-auto max-h-[calc(100vh-200px)]` per FR-022 |
| `app/lib/query-keys.ts` | TanStack Query key registry | Extend: add `heatmap` query keys |

### Source Files to Reference (Patterns)

| File | Pattern to extract |
|------|-------------------|
| `app/api/projects/[projectId]/analytics/route.ts` | API route pattern: Zod validation, verifyProjectAccess, error handling |
| `lib/analytics/queries.ts` | `buildEffectiveAgentWhere()` for agent filtering, `buildJobWhere()` patterns |
| `lib/analytics/aggregations.ts` | Date formatting, agent label helpers |
| `components/analytics/analytics-dashboard.tsx` | TanStack Query polling with initialData, URL search params sync |
| `components/analytics/velocity-chart.tsx` | Recharts component pattern (for reference, but heatmap won't use Recharts) |

### New Files to Create

| File | Responsibility |
|------|---------------|
| `app/api/heatmap/route.ts` | API: aggregate cross-project heatmap data for authenticated user |
| `lib/heatmap/queries.ts` | Prisma queries for heatmap data aggregation |
| `lib/heatmap/types.ts` | TypeScript interfaces for heatmap data |
| `lib/heatmap/utils.ts` | Grid computation, quartile bucketing, date range helpers |
| `components/heatmap/activity-heatmap.tsx` | Main heatmap client component (grid + header + legend) |
| `components/heatmap/heatmap-grid.tsx` | CSS Grid rendering with cells |
| `components/heatmap/heatmap-tooltip.tsx` | Hover/tap tooltip component |
| `components/heatmap/heatmap-filters.tsx` | Year selector + agent filter controls |
| `components/heatmap/heatmap-legend.tsx` | Color intensity legend |

### Test Files

| File | Covers | Action |
|------|--------|--------|
| `tests/integration/analytics/analytics-route.test.ts` | Analytics API route | Reference only (pattern) |
| `tests/unit/components/analytics-dashboard.test.tsx` | Dashboard component | Reference only (pattern) |
| `tests/unit/components/comparison-compliance-heatmap.test.tsx` | Compliance heatmap grid | Reference only (closest grid test pattern) |
| `tests/unit/components/heatmap/activity-heatmap.test.tsx` | **NEW** — heatmap component tests |
| `tests/unit/lib/heatmap-utils.test.ts` | **NEW** — grid computation, quartile, date utils |
| `tests/integration/heatmap/heatmap-route.test.ts` | **NEW** — heatmap API integration tests |

## Patterns to Follow

### API Route Pattern (from `app/api/projects/[projectId]/analytics/route.ts`)
- Zod schema for query param validation with `.default()` fallbacks
- `verifyProjectAccess()` for auth (but heatmap is user-scoped, not project-scoped — use `requireAuth()` instead)
- Structured try/catch: ZodError → 400, Unauthorized → 403, fallback → 500
- Return `NextResponse.json(data)`

### Agent Resolution Pattern (from `lib/analytics/queries.ts:51-69`)
- `buildEffectiveAgentWhere()` creates an OR clause: `{ agent }` OR `{ agent: null, project: { is: { defaultAgent: agent } } }`
- Must be reused or extracted for the heatmap agent filter

### TanStack Query Polling Pattern (from `components/analytics/analytics-dashboard.tsx`)
- `useQuery` with `initialData` from server component for zero-flash rendering
- `refetchInterval: 15_000` for background refresh
- URL search params synchronized with filter state via `router.replace()`
- `getInitialFilters()` hydrates from URL params, falling back to initial data

### State Management Pattern (from `components/analytics/analytics-dashboard.tsx:60-72`)
- Filter state in `useState`, initialized from URL search params
- Filter changes trigger both state update and URL param update
- Query key includes all filter values for automatic cache separation

### Error Handling Pattern (from `lib/analytics/queries.ts`)
- All queries return empty arrays/objects for no-data cases (no throws)
- Null-safe aggregation with `?? 0` fallbacks
- Cost summing skips null values: `job.costUsd ?? 0`
