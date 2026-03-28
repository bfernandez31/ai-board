# Implementation Summary: Health Dashboard - Page, Sidebar, Score Global, Data Model and API

**Branch**: `AIB-370-health-dashboard-page` | **Date**: 2026-03-28
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented full Health Dashboard feature: Prisma models (HealthScan, HealthScore), 3 API endpoints (GET health score, POST trigger scan, PATCH status callback, GET scan history), score calculator with proportional weight redistribution, 4 UI components (hero, sub-score badge, module card with 4 states, dashboard), useHealthPolling (2s conditional polling), useTriggerScan mutation, Health page at /projects/[projectId]/health, sidebar nav entry with HeartPulse icon. 56 tests passing.

## Key Decisions

Reused getScoreThreshold/getScoreColor from quality-score.ts for consistent theming. Quality Gate and Last Clean are passive modules derived from existing Job records (no new scans needed). Concurrent scan prevention at application level with 409 response. Scan history uses cursor-based pagination. HealthScore is a cached aggregate upserted on each scan completion.

## Files Modified

New: lib/health/{types,score-calculator,scan-dispatch}.ts, app/api/projects/[projectId]/health/{route,scans/route,scans/[scanId]/status/route}.ts, components/health/{dashboard,hero,module-card,sub-score-badge}.tsx, app/lib/hooks/{useHealthPolling,mutations/useTriggerScan}.ts, app/projects/[projectId]/health/page.tsx. Modified: prisma/schema.prisma, nav-items.ts, query-keys.ts, db-cleanup.ts.

## ⚠️ Manual Requirements

None
