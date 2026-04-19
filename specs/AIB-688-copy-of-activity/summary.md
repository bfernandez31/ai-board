# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-688-copy-of-activity` | **Date**: 2026-04-19
**Spec**: [spec.md](spec.md)

## Changes Summary

Delivered a GitHub-style contribution heatmap on `/projects` that aggregates AI-job activity across every accessible project (owner OR member) with quartile-based intensity, shipped-ticket tooltips, and 15s polling. Period + agent filters drive URL state, hydrate from SSR initialData (no spinner flash), and silently coerce invalid params. Mobile: horizontal scroll, 14px cells, pinned day labels. All 3 user stories + polish tasks land green; 26/26 impacted unit tests pass; type-check and lint clean.

## Key Decisions

Ship counting deliberately uses `command='ship' AND status=COMPLETED` (NOT `COMPLETED_TICKET_STAGES`) per FR-008 — a stage-only SHIP ticket without a successful ship job must not count. Tooltip uses shadcn `Popover` (not `Tooltip`) so mobile tap-outside-to-dismiss works natively. Future-day level-0 cells render only when the view is truly the current calendar year (rangeStart=Jan 1 AND rangeEnd=today AND same year) — last-12-months must not pad with future cells. Browser tz read in a post-mount `useEffect` with a targeted lint disable, since this is a genuine platform-API lookup.

## Files Modified

Created: `lib/analytics/heatmap-types.ts`, `lib/analytics/heatmap-queries.ts`, `app/api/activity-heatmap/route.ts`, `hooks/use-activity-heatmap.ts`, `components/projects/activity-heatmap/{index,heatmap-grid,heatmap-legend,heatmap-tooltip,heatmap-filters}.tsx`, `tests/unit/lib/heatmap-queries.test.ts`, `tests/unit/components/activity-heatmap.test.tsx`, `tests/integration/activity-heatmap/heatmap-route.test.ts`, `tests/e2e/projects/activity-heatmap.spec.ts`. Modified: `app/projects/page.tsx`, `app/lib/query-keys.ts`, `components/projects/projects-container.tsx`.

## ⚠️ Manual Requirements

None. All tasks T001–T033 complete. E2E and integration suites require a live DB + dev server; CI will exercise them. Impacted unit tests (26) were run locally and pass.
