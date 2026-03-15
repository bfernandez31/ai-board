# Quickstart: Analytics Filters and Dynamic Shipping Metrics

**Feature**: AIB-289 - Analytics Filters and Dynamic Shipping Metrics
**Date**: 2026-03-13

## Implementation Order

### Phase 1: Shared Analytics Types and Helpers

1. Update `lib/analytics/types.ts`
   - Add `TicketOutcomeFilter`, `AgentFilter`, `AnalyticsFilters`, `AgentOption`, and `CompletionMetric`
   - Extend `OverviewMetrics` and `AnalyticsData`

2. Update `lib/analytics/aggregations.ts`
   - Add helpers for period labels and shared filter defaults
   - Keep pure helpers reusable by both server and client code

### Phase 2: Query Layer

1. Refactor `lib/analytics/queries.ts`
   - Accept a single filter object instead of only `range`
   - Centralize reusable Prisma `where` fragments for:
     - time range
     - outcome membership
     - effective agent
   - Return project-scoped `availableAgents`
   - Replace month-based shipped count with period-aware shipped and closed metrics

2. Preserve one coherent payload
   - `hasData` should represent job-backed sections only
   - Completion cards must still render when `hasData` is false

### Phase 3: API and SSR Loader

1. Update `app/api/projects/[projectId]/analytics/route.ts`
   - Validate `range`, `outcome`, and `agent` with Zod
   - Call `getAnalyticsData(projectId, filters)`

2. Update `app/projects/[projectId]/analytics/page.tsx`
   - Parse URL search params for all filters
   - Provide initial data using the same filter object

### Phase 4: Dashboard UI

1. Update `components/analytics/analytics-dashboard.tsx`
   - Add outcome and agent selectors
   - Synchronize all filters with the URL
   - Include all filters in the React Query key
   - Remove the full-page `EmptyState` bailout

2. Update `components/analytics/overview-cards.tsx`
   - Render separate shipped and closed cards
   - Show active period label on both cards

3. Adjust existing chart components only where needed
   - Reuse current per-chart empty states
   - Make empty copy reflect the currently selected filters if feasible without new shared UI complexity

### Phase 5: Tests

1. Search and extend existing tests first
   - `tests/unit/query-keys.test.ts`
   - analytics component tests if present, otherwise add a targeted dashboard test

2. Add integration coverage under `tests/integration/analytics/`
   - mixed `SHIP` and `CLOSED` tickets
   - mixed `CLAUDE` and `CODEX` effective agents
   - empty combinations that still show zeroed completion metrics

## Query and UI Notes

- Use `ticket.agent ?? project.defaultAgent` consistently anywhere agent filtering or agent option derivation occurs.
- Keep the default filters aligned with the spec:
  - `range=30d`
  - `outcome=shipped`
  - `agent=all`
- Prefer one state update path that changes URL params and local state together to avoid partial redraws.

## Suggested Validation Sequence

1. `bun run test:unit -- query-keys`
2. `bun run test:integration -- analytics`
3. `bun run type-check`
4. `bun run lint`

## Expected Files to Change During Implementation

- `app/api/projects/[projectId]/analytics/route.ts`
- `app/lib/query-keys.ts`
- `app/projects/[projectId]/analytics/page.tsx`
- `components/analytics/analytics-dashboard.tsx`
- `components/analytics/overview-cards.tsx`
- `lib/analytics/aggregations.ts`
- `lib/analytics/queries.ts`
- `lib/analytics/types.ts`
- `tests/integration/analytics/analytics-route.test.ts`
- `tests/unit/query-keys.test.ts`
- `tests/unit/components/analytics-dashboard.test.tsx`
