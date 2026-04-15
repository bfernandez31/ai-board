# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-651-activity-heatmap-on` | **Date**: 2026-04-15
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented a full-width activity heatmap below project cards on /projects. Features: cross-project aggregated data via new GET /api/heatmap endpoint, 7x53 CSS Grid with violet intensity levels (quartile-based), hover/tap tooltips showing date, job count, cost, and shipped tickets, year selector and agent filter with URL persistence, mobile horizontal scroll with sticky day labels, and SSR initial data with 15s TanStack Query polling.

## Key Decisions

Used server-side aggregation via dedicated heatmap endpoint (not analytics API) since heatmap is user-scoped across all projects. Reused `buildEffectiveAgentWhere` pattern from analytics for agent filtering. Quartile-based intensity bucketing adapts to varying activity levels. CSS Grid chosen over SVG for native accessibility. Removed `overflow-y-auto max-h-[...]` from projects container for natural page scroll.

## Files Modified

**Created**: `lib/heatmap/types.ts`, `lib/heatmap/queries.ts`, `lib/heatmap/utils.ts`, `app/api/heatmap/route.ts`, `components/heatmap/activity-heatmap.tsx`, `components/heatmap/heatmap-grid.tsx`, `components/heatmap/heatmap-tooltip.tsx`, `components/heatmap/heatmap-filters.tsx`, `components/heatmap/heatmap-legend.tsx`, `tests/unit/lib/heatmap-utils.test.ts`, `tests/unit/components/heatmap/activity-heatmap.test.tsx`, `tests/integration/heatmap/heatmap-route.test.ts`
**Modified**: `app/lib/query-keys.ts`, `app/projects/page.tsx`, `components/projects/projects-container.tsx`

## ⚠️ Manual Requirements

None
