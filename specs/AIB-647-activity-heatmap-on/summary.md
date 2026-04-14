# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-647-activity-heatmap-on` | **Date**: 2026-04-14
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented a GitHub-style activity heatmap on the projects page showing daily job activity across all user projects. Features include: 52-week CSS grid with violet intensity scale, hover tooltips with job/ticket/cost details, summary header with total jobs and shipped tickets, year selector (rolling 12 months or specific year), and agent filter dropdown. API endpoint aggregates data from existing Job/Ticket tables with 15s polling.

## Key Decisions

- Pure CSS grid with div cells instead of Recharts (heatmap is a fixed grid, not a chart)
- API at `/api/heatmap` (user-scoped, cross-project) with Zod validation and `requireAuth()`
- Sparse cell array from API, client fills empty days in grid layout
- Violet palette via Tailwind opacity classes for aurora theme coherence
- shadcn Select for filter dropdowns, shadcn Tooltip for cell hover details

## Files Modified

**Created**: `lib/heatmap/types.ts`, `lib/heatmap/queries.ts`, `app/api/heatmap/route.ts`, `app/lib/hooks/queries/use-heatmap.ts`, `components/heatmap/activity-heatmap.tsx`, `components/heatmap/heatmap-grid.tsx`, `components/heatmap/heatmap-cell.tsx`, `components/heatmap/heatmap-header.tsx`, `components/heatmap/heatmap-legend.tsx`, `components/heatmap/heatmap-filters.tsx`, `tests/integration/heatmap/heatmap-route.test.ts`, `tests/unit/components/activity-heatmap.test.tsx`
**Modified**: `app/lib/query-keys.ts`, `app/projects/page.tsx`, `components/projects/projects-container.tsx`

## ⚠️ Manual Requirements

None
