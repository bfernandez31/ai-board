# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-672-activity-heatmap-on` | **Date**: 2026-04-17
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented a GitHub-style contribution heatmap on `/projects` below the project cards, aggregating AI job activity across all user-accessible projects (owner + member). Covers all five user stories (US1 MVP through US5 URL sharing): full-year grid with intensity levels, per-day tooltips with shipped tickets + cost, calendar-year selector, effective-agent filter, and URL state sync. No Prisma schema changes.

## Key Decisions

Split pure helpers into `lib/analytics/activity-heatmap-helpers.ts` so unit tests don't transitively pull in `next-auth`. Used TanStack Query with SSR `initialData` handoff for zero-spinner first paint. Static `INTENSITY_CLASSES` frozen lookup avoids dynamic Tailwind class construction. Effective-agent resolution (`ticket.agent ?? project.defaultAgent`) runs server-side only; client just sends `a` query param. Quartile thresholds `[ceil(max*n)]` per research.md.

## Files Modified

New: `lib/analytics/activity-heatmap.ts`, `lib/analytics/activity-heatmap-helpers.ts`, `app/api/activity-heatmap/route.ts`, `components/projects/activity-heatmap.tsx`, `tests/unit/lib/analytics/activity-heatmap.test.ts`, `tests/unit/components/projects/activity-heatmap.test.tsx`, `tests/integration/activity-heatmap/route.test.ts`. Edited: `app/projects/page.tsx`, `components/projects/projects-container.tsx`, `app/globals.css`.

## ⚠️ Manual Requirements

None — fully automated. 27 unit tests and 10 integration tests pass; `bun run type-check` and `bun run lint` are clean.
