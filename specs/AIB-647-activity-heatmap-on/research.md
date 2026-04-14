# Research: Activity Heatmap on Projects Page

## Existing Files

### Source Files (to modify)

| Path | Purpose | Action |
|------|---------|--------|
| `app/projects/page.tsx` | Projects page (server component) | Extend — add heatmap section below `ProjectsContainer` |
| `components/projects/projects-container.tsx` | Project cards grid with `overflow-y-auto max-h-[calc(100vh-200px)]` scroll constraint | Modify — remove scroll constraint (FR-015) |
| `app/lib/query-keys.ts` | TanStack Query key registry | Extend — add `heatmap` query key |

### Source Files (pattern references — reuse as-is)

| Path | Purpose | Reuse Pattern |
|------|---------|---------------|
| `lib/analytics/queries.ts` | Prisma query helpers for analytics | Pattern: `buildJobWhere`, `buildEffectiveAgentWhere`, `Promise.all` parallelism |
| `lib/analytics/aggregations.ts` | Pure aggregation/formatting utilities | Pattern: `getDateRangeStart`, `getAgentLabel`, `COMMAND_TO_STAGE` |
| `lib/analytics/types.ts` | Analytics type definitions | Pattern: typed filter enums (`AgentFilter`, `NamedAgent`) |
| `components/analytics/analytics-dashboard.tsx` | Client dashboard with TanStack Query polling | Pattern: `useQuery` with `refetchInterval: 15000`, filter state, `fetchAnalytics` |
| `components/analytics/overview-cards.tsx` | Summary metric cards | Pattern: card layout, metric display |
| `components/analytics/time-range-selector.tsx` | Filter dropdown using shadcn Select | Pattern: `<Select>/<SelectTrigger>/<SelectContent>/<SelectItem>` |
| `components/analytics/empty-state.tsx` | Empty state component | Pattern: centered message with icon |
| `app/api/projects/[projectId]/analytics/route.ts` | Analytics API route with Zod validation | Pattern: auth + Zod + try/catch + JSON response |

### Test Files (to extend or create)

| Path | Purpose | Action |
|------|---------|--------|
| `tests/integration/analytics/analytics-route.test.ts` | Analytics API integration tests | Pattern reference — seed fixtures, call route handler, verify response |
| `tests/unit/components/analytics-dashboard.test.tsx` | Analytics dashboard component tests | Pattern reference — mock child components, `renderWithProviders`, filter testing |
| (new) `tests/integration/heatmap/heatmap-route.test.ts` | Heatmap API integration tests | Create — no existing file covers cross-project heatmap aggregation |
| (new) `tests/unit/components/activity-heatmap.test.tsx` | Heatmap component tests | Create — no existing file covers heatmap UI |

## Patterns to Follow

### Query Pattern (from `lib/analytics/queries.ts`)

1. **Auth via query helper**: All data-access functions receive `projectId` (already auth-validated by API route). The heatmap needs cross-project, so the query layer receives `userId` instead.
2. **Filter building**: Compose Prisma `where` clauses with helper functions (`buildEffectiveAgentWhere`, `buildJobWhere`). The heatmap reuses `buildEffectiveAgentWhere` for agent filtering.
3. **Parallel fetching**: Use `Promise.all()` for independent queries (see `getAnalyticsData` at `queries.ts:649-667`).
4. **Date grouping**: Use `formatDateForGrouping` from `aggregations.ts` for daily bucketing.

### API Route Pattern (from `app/api/projects/[projectId]/analytics/route.ts`)

1. Auth check → Zod validation → query function → JSON response
2. For the heatmap, since it spans ALL user projects, the route lives at `/api/heatmap` (not under a single project)
3. Auth: use `requireAuth()` from `lib/db/users.ts` to get userId

### Component Pattern (from `components/analytics/analytics-dashboard.tsx`)

1. Client component with `"use client"`
2. `useQuery` with `queryKeys.heatmap.data(...)` and `refetchInterval: 15000`
3. Filter state in `useState` (year selector, agent filter)
4. Fetch function: `fetch('/api/heatmap?...')` with filter params
5. Loading/empty state handling

### Error Handling Pattern

1. API routes: try/catch wrapping entire handler, return `{ error: string }` with appropriate status code
2. Query functions: let Prisma errors propagate (caught by API route)
3. Client: TanStack Query handles error state via `isError` / `error`

### Security Pattern

1. All API routes validate auth before any data access
2. Prisma parameterized queries only (no raw SQL)
3. Zod validation on all query params

## Decisions

### 1. API Endpoint Location

- **Decision**: `GET /api/heatmap` (user-scoped, not project-scoped)
- **Rationale**: The heatmap aggregates across ALL user projects, so it doesn't belong under `/api/projects/[projectId]/`. Auth via `requireAuth()` provides the userId.
- **Alternatives**: Could nest under `/api/users/me/heatmap` but the flat `/api/heatmap` is simpler and consistent with the single-resource pattern.

### 2. No New Database Models

- **Decision**: Query existing `Job` and `Ticket` tables directly (SC-008)
- **Rationale**: Jobs have `startedAt`, `costUsd`, `projectId`; tickets have `stage` for shipped detection. A `ship` command job's `completedAt` determines the shipped date. No materialized view needed — the query is bounded by date range.
- **Alternatives**: A materialized daily_activity table would improve query speed but adds migration complexity for a read-only feature.

### 3. Heatmap Grid Rendering

- **Decision**: Pure CSS grid (no Recharts) — render SVG or div grid directly
- **Rationale**: Recharts is designed for charts (bar, line, area). A heatmap is a fixed grid of colored cells with tooltips. Using native `<div>` grid with Tailwind + shadcn Tooltip is simpler, more performant, and follows the GitHub contribution graph approach.
- **Alternatives**: Recharts custom shape renderer — adds unnecessary abstraction.

### 4. Color Scale Implementation

- **Decision**: 5 discrete CSS classes using violet palette from aurora theme tokens
- **Rationale**: Matches spec FR-005. Use CSS custom properties so the scale adapts to theme. Map job count to level using percentile-based thresholds relative to the max day in the period.
- **Alternatives**: Continuous gradient — harder to distinguish, worse accessibility.

### 5. Year Options

- **Decision**: Query the earliest job `startedAt` across user projects to determine available years
- **Rationale**: Only show years that actually have data, plus the rolling "Last 12 months" default.
- **Alternatives**: Hardcode recent years — inaccurate for new/old users.

### 6. Shipped Ticket Detection

- **Decision**: Count tickets where a `ship` command job has `completedAt` on that day (per spec auto-resolved decision)
- **Rationale**: More precise than ticket `updatedAt`. Query: jobs with `command = 'ship'`, `status = 'COMPLETED'`, grouped by `completedAt` date.
- **Alternatives**: Ticket `updatedAt` where `stage = 'SHIP'` — less precise.
