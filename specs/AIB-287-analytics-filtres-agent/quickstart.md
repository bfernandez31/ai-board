# Quickstart: AIB-287 Analytics Filters Implementation

## Files to Modify (in order)

### 1. Types (`lib/analytics/types.ts`)
- Add `StatusFilter` type: `'shipped' | 'closed' | 'all'`
- Add `AnalyticsFilters` interface
- Add `ticketsClosed: number` to `OverviewMetrics`
- Add `availableAgents: string[]` to `AnalyticsData`

### 2. Aggregations (`lib/analytics/aggregations.ts`)
- Add `getTimeRangeLabel(range: TimeRange): string` — returns "last 7 days", "last 30 days", etc.
- Add `getStagesFromStatus(status: StatusFilter): ('SHIP' | 'CLOSED')[]` — maps filter value to Prisma stage array

### 3. Queries (`lib/analytics/queries.ts`)
- Update `getAnalyticsData()` signature: add `status: StatusFilter`, `agent: string | null` params
- Update all 8 sub-query functions to accept and apply `stages` and `agent` filters
- Fix `getOverviewMetrics()`: replace `monthStart` with `rangeStart` for ticket counts
- Add `ticketsClosed` count query alongside existing `ticketsShipped`
- Add `getAvailableAgents()`: SELECT DISTINCT model FROM Job WHERE projectId = ? AND model IS NOT NULL
- Update `getVelocityData()`: use `stages` param instead of hardcoded `'SHIP'`
- Update `getWorkflowDistribution()`: add stage filter

### 4. API Route (`app/api/projects/[projectId]/analytics/route.ts`)
- Add Zod validation for `status` and `agent` query params
- Pass validated params to `getAnalyticsData()`

### 5. Query Keys (`app/lib/query-keys.ts`)
- Update `analytics.data` key to include status and agent

### 6. New: Status Filter (`components/analytics/status-filter.tsx`)
- shadcn Select with options: Shipped (default), Closed, Shipped + Closed
- Props: `value: StatusFilter`, `onChange: (v: StatusFilter) => void`

### 7. New: Agent Filter (`components/analytics/agent-filter.tsx`)
- shadcn Select with "All Agents" default + dynamic agent list
- Props: `value: string | null`, `onChange: (v: string | null) => void`, `agents: string[]`

### 8. Dashboard (`components/analytics/analytics-dashboard.tsx`)
- Add `status` and `agent` state (initialized from URL params)
- Sync state changes to URL via `router.push()`
- Pass all filters to TanStack Query fetch function
- Render StatusFilter and AgentFilter components in filter bar

### 9. Overview Cards (`components/analytics/overview-cards.tsx`)
- Add 5th card: "Tickets Closed" with XCircle icon
- Update "Tickets Shipped" label from "this month" to dynamic time range label
- Accept `timeRange` prop for label rendering

### 10. Page (`app/projects/[projectId]/analytics/page.tsx`)
- Parse `status` and `agent` from searchParams
- Validate and pass to `getAnalyticsData()` for SSR

## Key Patterns to Follow

- **Existing time range selector**: See `time-range-selector.tsx` for shadcn Select pattern
- **Existing URL sync**: See `analytics-dashboard.tsx` lines using `router.push()` with `useSearchParams()`
- **Existing Prisma patterns**: See `queries.ts` for consistent filter spreading `...(condition && { field: value })`
- **Existing card pattern**: See `overview-cards.tsx` for Card + icon + metric layout
