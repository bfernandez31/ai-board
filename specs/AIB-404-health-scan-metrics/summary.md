# Implementation Summary: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Branch**: `AIB-404-health-scan-metrics` | **Date**: 2026-03-30
**Spec**: [spec.md](spec.md)

## Changes Summary

Added trend data endpoint (GET /health/trend) returning last 20 scores per active module with 4 parallel Prisma queries. Enriched scan history with tokensUsed/costUsd fields and 4 metric icons (issues, cost, tokens, duration) with tooltips and null→dash formatting. Created Sparkline component (Recharts LineChart, 40px, hidden axes) on active module cards (3+ data points threshold). Added ModuleAreaChart (Recharts AreaChart matching Quality Gate pattern) to module drawers.

## Key Decisions

Used 4 parallel Prisma queries (Promise.all) for trend endpoint rather than raw SQL window functions — simpler, indexed, sub-200ms for 20 rows each. Trend data fetched once on mount (staleTime: Infinity) to avoid adding load to polling cycle. Used `hsl(var(--primary))` for all chart strokes to ensure WCAG AA compliance across themes.

## Files Modified

- `app/api/projects/[projectId]/health/trend/route.ts` (NEW)
- `app/api/projects/[projectId]/health/scans/route.ts` (MODIFIED: +tokensUsed, +costUsd)
- `app/lib/hooks/useHealthTrend.ts` (NEW)
- `app/lib/query-keys.ts` (MODIFIED: +health.trend)
- `lib/health/types.ts` (MODIFIED: +TrendDataPoint, +TrendResponse, +ScanHistoryItem fields)
- `lib/health/format.ts` (NEW)
- `components/health/sparkline.tsx` (NEW)
- `components/health/drawer/module-area-chart.tsx` (NEW)
- `components/health/health-module-card.tsx` (MODIFIED: +sparkline)
- `components/health/drawer/drawer-history.tsx` (MODIFIED: +metric icons)
- `components/health/scan-detail-drawer.tsx` (MODIFIED: +area chart)
- `tests/integration/health/trend-endpoint.test.ts` (NEW: 7 tests)
- `tests/unit/components/sparkline.test.tsx` (NEW: 4 tests)
- `tests/unit/components/drawer-history-metrics.test.tsx` (NEW: 3 tests)

## Manual Requirements

None
