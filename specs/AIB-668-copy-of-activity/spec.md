# Quick Implementation: Copy of Activity Heatmap on Projects Page

**Feature Branch**: `AIB-668-copy-of-activity`
**Created**: 2026-04-17
**Mode**: Quick Implementation

## Description

Add a GitHub-style contribution heatmap to the `/projects` page (below the project cards grid) that visualizes AI activity across all of the current user's projects.

## Implementation Summary

- **Data layer**: `lib/activity-heatmap/{types.ts,aggregations.ts,queries.ts}` — pure grid/intensity helpers plus Prisma queries that aggregate `Job` rows by day across all user-owned + member projects and count distinct shipped tickets from completed `ship` jobs.
- **API**: `GET /api/user/activity-heatmap` — accepts `period` (`last-12-months` | `YYYY`) and `agent` (`all` | named agent) query params; enforces session auth via `requireAuth`.
- **Server-rendered initial data**: `app/projects/page.tsx` fetches the heatmap via `getActivityHeatmapData` and hydrates TanStack Query in the client, avoiding a loading flash.
- **Client component**: `components/activity-heatmap/activity-heatmap.tsx` — 7-row × N-column grid built with `buildHeatmapGrid`, violet intensity classes (`aurora-heatmap-cell-*`) defined in `globals.css`, tooltip with job count / cost (omitted when no cost recorded) / tickets shipped, year selector built from user creation year, agent filter honoring effective-agent resolution.
- **URL state**: filter changes push `heatmapPeriod` and `heatmapAgent` query params so the view is shareable.
- **Filter visibility**: agent selector hides when 0–1 distinct agents exist; period selector hides when only the default option is available.
- **Mobile**: grid scrolls horizontally via `overflow-x-auto` with sticky day-of-week labels on the left.
- **Layout**: removed the vertical scroll constraint on `ProjectsContainer` so the heatmap reveals via page scroll.

## Tests

- `tests/unit/activity-heatmap-aggregations.test.ts` — period resolution, grid construction with chipped corners, intensity thresholds, available-periods dropdown logic.
- `tests/unit/components/activity-heatmap.test.tsx` — server-data hydration, agent filter visibility gate, empty state, URL push on filter change.
- `tests/integration/account/activity-heatmap-route.test.ts` — empty dataset, day aggregation + ship-job accounting, effective-agent filtering, validation, 401 handling.
