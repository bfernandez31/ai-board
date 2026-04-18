# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-681-activity-heatmap-on` | **Date**: 2026-04-18
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented a GitHub-style activity heatmap on the /projects page showing AI job activity across all user projects. Features: CSS Grid 7×N-week layout with violet intensity scale, percentile-based thresholds, tooltip on hover/tap with job count/shipped/cost, year selector dropdown, agent filter with effective agent resolution, URL-shareable filters, empty state, mobile horizontal scroll with sticky labels, SSR initial data for no loading flash, keyboard accessibility.

## Key Decisions

Used pure CSS Grid (not SVG/Canvas) for sticky label support and Tailwind integration. Server-side aggregation returns max 365 day-level rows. Percentile-based intensity thresholds adapt to each user's activity volume. User-scoped API endpoint aggregates across all owned+member projects. Exported `buildEffectiveAgentWhere()` from analytics module for reuse.

## Files Modified

**Created**: `lib/heatmap/types.ts`, `lib/heatmap/queries.ts`, `app/api/heatmap/route.ts`, `app/lib/hooks/queries/use-heatmap.ts`, `components/heatmap/activity-heatmap.tsx`, `components/heatmap/heatmap-grid.tsx`, `components/heatmap/heatmap-tooltip.tsx`, `components/heatmap/heatmap-legend.tsx`, `components/heatmap/heatmap-header.tsx`, `tests/unit/heatmap-grid.test.ts`, `tests/unit/components/activity-heatmap.test.tsx`, `tests/integration/heatmap/heatmap-route.test.ts`
**Modified**: `app/lib/query-keys.ts`, `lib/analytics/queries.ts`, `app/projects/page.tsx`, `components/projects/projects-container.tsx`

## ⚠️ Manual Requirements

None
