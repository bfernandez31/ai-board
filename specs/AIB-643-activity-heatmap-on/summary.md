# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-643-activity-heatmap-on` | **Date**: 2026-04-14
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented a GitHub-style activity heatmap on the `/projects` page. The heatmap displays a 52×7 day grid with 5 violet intensity levels showing job activity across all user projects. Includes tooltip on hover (tickets shipped, job count, cost, date), year selector dropdown ("Last 12 months" + specific years), and agent filter (All/Claude/Codex/Mistral/Gemini). Data is fetched via a new cross-project API endpoint with 15s polling.

## Key Decisions

- Used custom HTML grid (not Recharts) since heatmap is a matrix, not a chart
- Used percentile-based intensity thresholds relative to user's max daily count
- Cross-project aggregation via owner+member OR pattern matching existing auth patterns
- All Tailwind classes are static literals (no dynamic construction)
- Removed scroll constraint from ProjectsContainer to enable natural page scrolling

## Files Modified

- **Created**: `lib/activity-heatmap/types.ts`, `lib/activity-heatmap/queries.ts`, `app/api/activity-heatmap/route.ts`, `hooks/use-activity-heatmap.ts`, `components/projects/activity-heatmap.tsx`
- **Modified**: `app/lib/query-keys.ts` (heatmap keys), `app/projects/page.tsx` (mount heatmap), `components/projects/projects-container.tsx` (remove scroll constraint)
- **Tests**: `tests/unit/components/activity-heatmap.test.tsx` (12 tests), `tests/integration/activity-heatmap/route.test.ts` (8 tests)

## ⚠️ Manual Requirements

None
