# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-654-copy-of-activity` | **Date**: 2026-04-15
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented GitHub-style activity heatmap on the projects page showing AI job activity across all user projects. Features include: div-based grid with violet intensity coloring (quartile-based), header counter (jobs/shipped), year selector dropdown, agent filter, tooltips with shipped ticket details and cost, mobile horizontal scroll with sticky day labels, and empty state. Data fetched server-side with 60s client polling via TanStack Query.

## Key Decisions

Used pure HTML/CSS div grid instead of SVG for simplicity and accessibility. Set 60s polling interval (not 15s) due to expensive cross-project aggregate query. Static CSS utility classes (heatmap-level-0 through heatmap-level-4) to avoid dynamic Tailwind class construction. Removed scroll constraint from ProjectsContainer to enable natural page scrolling with heatmap below.

## Files Modified

- `lib/heatmap/types.ts` (new) - HeatmapDay, HeatmapData, HeatmapFilters types
- `lib/heatmap/queries.ts` (new) - getHeatmapData, computeQuartiles, getIntensityLevel
- `app/api/heatmap/route.ts` (new) - GET /api/heatmap with Zod validation
- `app/lib/hooks/queries/use-heatmap.ts` (new) - TanStack Query hook with 60s polling
- `components/heatmap/activity-heatmap.tsx` (new) - Main client component
- `components/heatmap/heatmap-grid.tsx` (new) - Grid rendering
- `components/heatmap/heatmap-tooltip.tsx` (new) - Tooltip content
- `app/projects/page.tsx` (modified) - Server-side heatmap fetch
- `components/projects/projects-container.tsx` (modified) - Removed scroll constraint
- `app/lib/query-keys.ts` (modified) - Added heatmap key
- `app/globals.css` (modified) - Added heatmap intensity CSS classes

## Manual Requirements

None
