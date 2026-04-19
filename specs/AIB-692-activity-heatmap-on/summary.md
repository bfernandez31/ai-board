# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-692-activity-heatmap-on` | **Date**: 2026-04-19
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented a GitHub-style activity heatmap on the projects page showing daily AI job activity across all user projects. Features: violet-gradient CSS Grid with 5 intensity levels, quantile-based thresholds, year/agent filters, tooltips with cost/shipped data, URL state sync, mobile horizontal scroll with sticky labels, server-rendered initial data (no loading flash), and empty state.

## Key Decisions

Used pure CSS Grid instead of Recharts for the heatmap rendering — simpler, more performant, and easier to style with aurora theme. Quantile thresholds computed server-side to avoid shipping full data distribution. All intensity classes are static strings (no dynamic Tailwind). Component built as single file with all US1-US6 features integrated.

## Files Modified

- `lib/heatmap/types.ts` — Shared types, pure functions (thresholds, grid dates, intensity)
- `lib/heatmap/queries.ts` — Server-side data aggregation with Prisma
- `app/api/projects/activity-heatmap/route.ts` — GET endpoint with Zod validation
- `components/activity-heatmap/activity-heatmap.tsx` — Client component (grid, filters, tooltips, URL sync)
- `components/activity-heatmap/types.ts` — Component prop types
- `app/lib/query-keys.ts` — Added heatmap query key
- `app/projects/page.tsx` — Server-side heatmap fetch + render
- `components/projects/projects-container.tsx` — Removed scroll constraint
- `tests/unit/heatmap-queries.test.ts` — 18 unit tests
- `tests/unit/components/activity-heatmap.test.tsx` — 14 component tests
- `tests/integration/activity-heatmap/api.test.ts` — 10 integration tests

## Manual Requirements

None
