# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-702-activity-heatmap-on` | **Date**: 2026-04-20
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented a GitHub-style activity heatmap on the Projects page. The heatmap visualizes AI jobs and shipped tickets over a rolling 12-month period or selected calendar years. Features include activity intensity levels, special styling for shipped tickets, detailed tooltips with cost data, and filtering by AI agent. Horizontal scrolling and sticky labels ensure a good mobile experience. All features are server-rendered for initial load and dynamically update via URL search parameters.

## Key Decisions

- Used Next.js search parameters for filtering to ensure URL-sync and SSR compatibility.
- Implemented a unified database aggregation layer in `lib/db/activity.ts` for efficient single-pass data processing.
- Leveraged Aurora theme tokens for intensity levels and special "shipped" states.
- Created dedicated integration and unit tests for date logic and data aggregation to ensure accuracy across year boundaries.
- Decided to use a single grid for both rolling and calendar views, handled by utility functions.

## Files Modified

- `lib/types/activity.ts` (Types & Zod schemas)
- `lib/db/activity.ts` (Aggregation logic)
- `lib/utils/activity-date-utils.ts` (Grid & boundary logic)
- `app/api/activity/heatmap/route.ts` (Authenticated API)
- `components/projects/activity-heatmap/` (Heatmap components)
- `app/projects/page.tsx` (Component injection)
- `app/globals.css` (Aurora intensity classes)
- `tests/unit/activity/`, `tests/integration/activity/`, `tests/e2e/` (Full test suite)

## ⚠️ Manual Requirements

None
