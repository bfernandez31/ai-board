# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-701-activity-heatmap-on` | **Date**: 2026-04-20
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a cross-project activity heatmap below the projects grid with server-rendered initial data, a dedicated `/api/projects/activity-heatmap` route, rolling/calendar period support, effective-agent filtering, URL-synced client refresh, tooltip day details, mobile horizontal scrolling, and targeted unit/integration coverage for aggregation, route behavior, and UI state.

## Key Decisions

Used a dedicated route plus shared server aggregation helper instead of extending `/api/projects`; derived periods from `User.createdAt`; counted shipped work only from successful `ship` jobs deduped per ticket/day; aggregated by UTC completion date; reset the agent filter to `all` on period changes to keep the client state and available server options aligned without blanking the current view.

## Files Modified

`app/api/projects/activity-heatmap/route.ts`, `app/projects/page.tsx`, `app/lib/query-keys.ts`, `components/projects/project-activity-heatmap.tsx`, `components/projects/projects-container.tsx`, `lib/projects/activity-heatmap.ts`, `lib/db/users.ts`, `tests/unit/query-keys.test.ts`, `tests/unit/lib/projects/activity-heatmap.test.ts`, `tests/unit/components/projects/project-activity-heatmap.test.tsx`, `tests/integration/projects/activity-heatmap-route.test.ts`

## ⚠️ Manual Requirements

None
