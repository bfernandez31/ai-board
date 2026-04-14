# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-644-activity-heatmap-on` | **Date**: 2026-04-14
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a workspace activity heatmap to `/projects` with server-loaded initial data, a new authenticated `GET /api/projects/activity` endpoint, rolling and calendar-year views, effective-agent filtering, daily tooltip-ready metrics, and mobile-safe layout behavior. Added focused unit, integration, and Playwright coverage plus query-key updates.

## Key Decisions

Used a dedicated workspace heatmap endpoint instead of changing the existing projects list payload. Aggregation reuses owner-or-member workspace scope and effective-agent resolution, treats job intensity as `Job.startedAt` counts, shipped totals as `Ticket.updatedAt` in `SHIP`, and preserves full-year zero-activity grids for empty scopes.

## Files Modified

`lib/projects/activity-heatmap.ts`, `lib/projects/activity-heatmap-types.ts`, `app/api/projects/activity/route.ts`, `components/projects/projects-activity-heatmap.tsx`, `app/projects/page.tsx`, `components/projects/projects-container.tsx`, `app/lib/query-keys.ts`, `tests/unit/query-keys.test.ts`, `tests/unit/components/projects/projects-activity-heatmap.test.tsx`, `tests/integration/projects/activity-heatmap.test.ts`, `tests/e2e/projects-activity-heatmap.spec.ts`

## ⚠️ Manual Requirements

None
