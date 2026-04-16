# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-664-activity-heatmap-on` | **Date**: 2026-04-16
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a GitHub-style activity heatmap below the projects grid, scoped to the user's accessible projects. Server-rendered with initialData + 15s TanStack Query polling. Supports "Last 12 months" rolling window plus per-year selection, and an agent filter that only appears when ≥2 distinct effective agents are present. Cells show job count, shipped tickets, and null-safe total cost in a Radix tooltip. Mobile view scrolls horizontally with sticky day-of-week labels.

## Key Decisions

- No Prisma migration (FR-018); reused `Job.completedAt`, `Ticket.agent`, `Project.defaultAgent`, `User.createdAt`.
- Zod `.catch()` silent fallback for invalid filter params — route never 400s.
- `availableAgents` computed from UNFILTERED jobs so toggling agent never hides the filter.
- Inline `HeatmapCell` with controlled Radix Tooltip (no separate file — component stays under 300 lines).
- Removed `max-h-[calc(100vh-200px)]` scroll trap on `projects-container` (FR-017).

## Files Modified

- `app/api/heatmap/route.ts` (new)
- `lib/heatmap/{types,aggregations,queries}.ts` (new)
- `lib/db/projects.ts` (+`getAccessibleProjectIdsForUser`)
- `app/lib/query-keys.ts` (+`heatmap.data`)
- `components/projects/activity-heatmap.tsx` (new)
- `components/projects/projects-container.tsx` (scroll trap removed)
- `app/projects/page.tsx` (heatmap wiring)
- `tests/unit/heatmap-aggregations.test.ts`, `tests/unit/components/activity-heatmap.test.tsx`
- `tests/integration/heatmap/{heatmap-queries,heatmap-route}.test.ts`
- `tests/integration/projects/accessible-ids.test.ts`

## ⚠️ Manual Requirements

None — fully automated. Follow-up: consider `@@index([completedAt])` on `Job` if p95 server-render regresses at 10k-job scale (deferred per data-model.md §Indexes).
