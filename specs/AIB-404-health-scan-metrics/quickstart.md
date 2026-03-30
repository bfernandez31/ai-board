# Quickstart: Health Scan Metrics

**Branch**: `AIB-404-health-scan-metrics`

## Prerequisites

- Node.js 22.20.0, Bun installed
- PostgreSQL 14+ running with existing `HealthScan` records
- Project dependencies installed (`bun install`)

## Development Setup

```bash
# 1. Switch to feature branch
git checkout AIB-404-health-scan-metrics

# 2. Install dependencies (if needed)
bun install

# 3. Ensure Prisma client is up to date (no schema changes, but good practice)
bunx prisma generate

# 4. Start dev server
bun run dev
```

## Verification Steps

### 1. Trend Endpoint
```bash
# Requires auth session or test header
curl http://localhost:3000/api/projects/3/health/trend \
  -H "x-test-user-id: test@e2e.local"
```
Expected: JSON with `trends.security`, `trends.compliance`, `trends.tests`, `trends.specSync` arrays.

### 2. Enriched Scan History
```bash
curl "http://localhost:3000/api/projects/3/health/scans?type=SECURITY&limit=5" \
  -H "x-test-user-id: test@e2e.local"
```
Expected: Each scan record now includes `tokensUsed` and `costUsd` fields.

### 3. Dashboard UI
1. Navigate to a project's health dashboard
2. Verify sparklines appear on module cards with 3+ completed scans
3. Open any active module drawer — verify area chart renders
4. Scroll to scan history — verify 4 metric icons per history line

## Running Tests

```bash
# Unit/component tests
bun run test:unit tests/unit/components/sparkline.test.tsx
bun run test:unit tests/unit/components/drawer-history-metrics.test.tsx

# Integration tests
bun run test:integration tests/integration/health/trend-endpoint.test.ts

# All tests
bun run test
```

## Key Files

| File | Purpose |
|------|---------|
| `app/api/projects/[projectId]/health/trend/route.ts` | New trend endpoint |
| `app/api/projects/[projectId]/health/scans/route.ts` | Modified: adds tokensUsed, costUsd |
| `app/lib/hooks/useHealthTrend.ts` | New hook: fetch trend data once |
| `components/health/sparkline.tsx` | New: mini sparkline component |
| `components/health/drawer/module-area-chart.tsx` | New: shared area chart |
| `components/health/health-module-card.tsx` | Modified: sparkline on cards |
| `components/health/drawer/drawer-history.tsx` | Modified: metric icons |
| `lib/health/types.ts` | Modified: TrendResponse types |
