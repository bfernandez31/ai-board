# Quickstart: AIB-405 Health Scan Metrics

## Prerequisites
- Node.js 22.20.0, Bun installed
- PostgreSQL 14+ running with seeded data
- `bun install` completed

## Dev Setup
```bash
bun run dev                # Start dev server
```

## Key Files to Modify

### Data Layer (start here)
1. `lib/health/types.ts` — Add `TrendDataPoint`, `HealthTrendsResponse`, extend `ScanHistoryItem`
2. `app/api/projects/[projectId]/health/scans/route.ts` — Add `tokensUsed`, `costUsd` to select
3. `app/api/projects/[projectId]/health/trends/route.ts` — New trend endpoint
4. `app/lib/query-keys.ts` — Add `trends` key
5. `app/lib/hooks/useHealthTrends.ts` — New fetch-once hook

### UI Layer
6. `components/health/drawer/drawer-history.tsx` — Metric icons with tooltips
7. `components/health/health-module-card.tsx` — Sparkline rendering
8. `components/health/health-dashboard.tsx` — Wire trend data
9. `components/health/scan-detail-drawer.tsx` — Area chart in drawers

## Reference Patterns
- **Area chart**: `components/health/drawer/quality-gate-drawer.tsx` (lines 132-166)
- **Tooltip**: `components/ui/tooltip.tsx` + usage in `components/board/job-status-indicator.tsx`
- **Number formatting**: `lib/analytics/aggregations.ts` (`formatAbbreviatedNumber`, `formatCost`, `formatDuration`)
- **Query keys**: `app/lib/query-keys.ts`

## Validate
```bash
bun run type-check         # TypeScript
bun run lint               # ESLint
bun run test:unit          # Component tests
bun run test:integration   # API tests
```
