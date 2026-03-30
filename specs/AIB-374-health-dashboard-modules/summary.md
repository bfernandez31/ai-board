# Implementation Summary: Health Dashboard - Passive Modules Quality Gate & Last Clean

**Branch**: `AIB-374-health-dashboard-modules` | **Date**: 2026-03-30
**Spec**: [spec.md](spec.md)

## Changes Summary

Added two passive Health Dashboard modules: Quality Gate (30-day average quality score with trend, distribution, dimension breakdown, recent tickets, and weekly trend chart) and Last Clean (cleanup job status with staleness detection, overdue alerts, and history drawer). Quality Gate contributes to global Health Score at equal weight; Last Clean does not.

## Key Decisions

- Quality Gate aggregation queries both current and previous 30-day periods for trend calculation using raw score delta (not percentage)
- Last Clean parses `filesCleaned`/`remainingIssues` from Job.logs JSON field (defaults to 0)
- Drawer components receive data as props from enriched health API response (no separate fetch)
- Recharts LineChart for QG trend following existing analytics pattern

## Files Modified

- `lib/health/types.ts` — Extended with QualityGateModuleStatus, LastCleanModuleStatus, and aggregate types
- `lib/health/quality-gate.ts` — New: 30-day QG aggregation module
- `lib/health/last-clean.ts` — New: Last Clean derivation module
- `app/api/projects/[projectId]/health/route.ts` — Extended with QG and LC aggregate data
- `components/health/health-module-card.tsx` — QG trend/distribution, LC overdue alert
- `components/health/drawer/quality-gate-drawer-content.tsx` — New: QG drawer
- `components/health/drawer/last-clean-drawer-content.tsx` — New: LC drawer
- `components/health/scan-detail-drawer.tsx` — Routes passive modules to dedicated drawers
- Tests: 4 new test files (2 integration, 2 component)

## ⚠️ Manual Requirements

None
