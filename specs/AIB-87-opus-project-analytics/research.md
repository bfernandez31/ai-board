# Research: Project Analytics Dashboard

**Feature**: AIB-87-opus-project-analytics
**Date**: 2025-11-28

## Resolved Clarifications

### 1. Chart Library Selection

**Decision**: Recharts
**Rationale**: Lightweight (~50KB gzipped), React-native composition, compatible with shadcn/ui theming patterns
**Alternatives Considered**:
- Chart.js: Requires wrapper library for React, heavier bundle
- D3: Low-level, requires significant custom code for standard charts
- ECharts: Better for 20,000+ data points, overkill for our scale (<1,000 jobs)
- Tremor: Opinionated component library, may conflict with shadcn/ui

### 2. Data Fetching Strategy

**Decision**: Server-side API aggregation with TanStack Query polling on client
**Rationale**:
- Matches existing `useJobPolling` pattern in `components/board/board.tsx:99`
- Keeps complex Prisma aggregations on server
- Enables 15-second polling consistent with notifications
**Alternatives Considered**:
- Client-side aggregation: Would require fetching all raw Job records, poor performance
- Server Components only: Would prevent real-time updates without full page reload

### 3. Time Range Implementation

**Decision**: Preset options (7d, 30d, 90d, all time) with URL state
**Rationale**:
- CONSERVATIVE approach per spec (no custom date pickers)
- URL state enables shareable links and browser history
- Follows existing query param pattern in board.tsx
**Alternatives Considered**:
- Custom date range picker: Higher complexity, not needed per spec decision

### 4. Chart Granularity Logic

**Decision**: Auto-adjusting (daily <30 days, weekly >=30 days)
**Rationale**: Prevents cluttered charts while maintaining detail when appropriate
**Implementation**: Pure function in `lib/analytics/aggregations.ts` for testability

### 5. Stage Derivation from Job Command

**Decision**: Map command to stage at query time
**Rationale**: No schema changes needed; commands already encode stage intent
**Mapping**:
```typescript
const COMMAND_TO_STAGE: Record<string, string> = {
  'specify': 'SPECIFY',
  'plan': 'PLAN',
  'implement': 'BUILD',
  'quick-impl': 'BUILD',
  'verify': 'VERIFY',
  'deploy-preview': 'VERIFY',
  'comment-specify': 'SPECIFY',
  'comment-plan': 'PLAN',
  'comment-build': 'BUILD',
  'comment-verify': 'VERIFY',
  'clean': 'BUILD', // Cleanup creates tickets in BUILD
  'rollback-reset': 'PLAN',
};
```

## Technology Research

### Recharts Integration with Next.js 15

**Key Finding**: All Recharts components must be in client components (`'use client'` directive)

**Pattern**:
```typescript
// Server Component (page.tsx)
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { getAnalyticsData } from '@/lib/analytics/queries';

export default async function AnalyticsPage({ params }) {
  const initialData = await getAnalyticsData(params.projectId);
  return <AnalyticsDashboard projectId={params.projectId} initialData={initialData} />;
}

// Client Component (analytics-dashboard.tsx)
'use client';
import { useQuery } from '@tanstack/react-query';
// ... Recharts imports
```

### Responsive Charts Pattern

**Key Finding**: Parent container must have explicit height for ResponsiveContainer

```typescript
<div className="w-full h-80">
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data}>{/* ... */}</AreaChart>
  </ResponsiveContainer>
</div>
```

### shadcn/ui Theming Integration

**Key Finding**: Use CSS variables for dark mode support

```typescript
// Use existing shadcn colors
const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  muted: 'hsl(var(--muted))',
  accent: 'hsl(var(--accent))',
  // Custom chart palette
  chart1: 'hsl(var(--chart-1, 220 70% 50%))',
  chart2: 'hsl(var(--chart-2, 160 60% 45%))',
  chart3: 'hsl(var(--chart-3, 30 80% 55%))',
  chart4: 'hsl(var(--chart-4, 280 65% 60%))',
};
```

### Custom Tooltip Pattern

```typescript
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          {entry.name}: {formatValue(entry.value)}
        </p>
      ))}
    </div>
  );
}
```

## Existing Codebase Patterns

### Query Keys Pattern

Found in `app/lib/query-keys.ts` (referenced in board.tsx):
```typescript
// Extend with analytics keys
analytics: {
  all: (projectId: number) => ['analytics', projectId],
  overview: (projectId: number, range: string) => ['analytics', projectId, 'overview', range],
}
```

### API Route Pattern

Existing routes follow `app/api/projects/[projectId]/*/route.ts` pattern with:
- `verifyProjectAccess(projectId)` for authorization
- Zod schema validation
- Try-catch with structured error responses

### Component Structure Pattern

- Server Components for pages (data fetching)
- Client Components for interactivity (`'use client'`)
- Feature folders in `/components/[feature]/`
- shadcn/ui primitives for all UI elements

## Performance Considerations

### Database Query Optimization

For projects with 1,000 jobs (spec requirement), queries should:
1. Use indexed fields: `projectId`, `status`, `startedAt`, `completedAt`
2. Aggregate in database, not in JS
3. Filter by time range before aggregating

**Estimated Query Patterns**:
```sql
-- Cost over time (daily)
SELECT DATE(completed_at) as date, SUM(cost_usd) as cost
FROM jobs
WHERE project_id = ? AND completed_at >= ? AND status = 'COMPLETED'
GROUP BY DATE(completed_at)
ORDER BY date

-- Cost by stage (command aggregation)
SELECT command, SUM(cost_usd) as cost
FROM jobs
WHERE project_id = ? AND completed_at >= ? AND status = 'COMPLETED'
GROUP BY command
```

### Bundle Size

Recharts adds ~50KB gzipped. Impact acceptable given:
- Analytics page is separate route (code-split)
- Not loaded on main board view
- One-time load for dashboard users

## Security Considerations

- All analytics endpoints use `verifyProjectAccess(projectId)`
- No new secrets or credentials required
- Read-only access to existing data
- No user PII in analytics (only aggregated metrics)

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Should we add chart CSS variables to globals? | Yes, add `--chart-1` through `--chart-5` following shadcn pattern |
| How to handle null telemetry fields? | Exclude from aggregations; show "N/A" in UI |
| Should velocity include all workflow types? | Yes, but CLEAN tickets shown separately in distribution chart |
