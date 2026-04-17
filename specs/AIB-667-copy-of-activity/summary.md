# Implementation Summary: Copy of Activity Heatmap on Projects Page

**Branch**: `AIB-667-copy-of-activity` | **Date**: 2026-04-17
**Spec**: [spec.md](spec.md)

## Changes Summary

Account-scoped GitHub-style activity heatmap rendered below project cards on `/projects`. SSR initial paint via `getHeatmapData()`, client shell polls every 15s via TanStack Query. Counter, tooltip, legend, and year+agent filters with URL-shareable state. Empty state when no jobs. Zero DB schema changes — composes existing Job/Ticket/Project/User models.

## Key Decisions

- Timezone: server renders with UTC fallback; client re-hydrates with IANA tz from `Intl.DateTimeFormat()` and refetches.
- Effective agent: ticket.agent ?? project.defaultAgent, replicating `buildEffectiveAgentWhere` pattern from analytics queries.
- Filters derived from `useSearchParams` via `useMemo` (no setState-in-effect) so URL is the single source of truth; `router.push({ scroll: false })` preserves scroll.
- Cost segment in tooltip guarded by `totalCostUsd !== undefined` (never `$0`/`$NaN`).

## Files Modified

New: `app/api/activity/heatmap/route.ts`, `lib/activity/{heatmap-types,heatmap-queries,heatmap-bucketing}.ts`, `hooks/use-activity-heatmap.ts`, `components/activity/activity-heatmap{,-cell,-counter,-filters,-grid,-legend}.tsx`, `tests/{integration/activity/heatmap-route,unit/activity/heatmap-bucketing,unit/components/activity-heatmap}.test.{ts,tsx}`.
Modified: `app/projects/page.tsx`, `components/projects/projects-container.tsx`, `app/globals.css`, `app/lib/query-keys.ts`.

## ⚠️ Manual Requirements

T030 manual 375px viewport verification (SC-005) — horizontal scroll, pinned day-of-week labels, ≥14px cells — requires browser; cannot be validated by the agent.
