# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-704-activity-heatmap-on` | **Date**: 2026-04-21
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a GitHub-style AI activity heatmap to `/projects` spanning all owned/member projects. Rolling 12-month or per-year view with agent filter, URL-synced filters (period/agent), touch-toggle tooltips with shipped tickets + daily cost, and mobile horizontal scroll with sticky weekday column. All 6 user stories (US1-US6) delivered: SSR initial data, period selector, tooltips, agent filter, URL sync, and responsive layout.

## Key Decisions

- Ship detection: `Job.command='ship' && status='COMPLETED'` (FR-003) — diverges from analytics stage-based counting for accuracy.
- Percentile-based intensity buckets (p50/p75/p90) with degenerate-safe monotonic thresholds.
- Effective agent uses `ticket.agent ?? project.defaultAgent`; `availableAgents` computed on unfiltered dataset (invariant #8).
- Controlled Radix Tooltip via `open`/`onOpenChange` for touch toggle + outside-tap dismissal.
- URL omits defaults (`12m`, `all`); hydrates filters from `searchParams` on mount.

## Files Modified

- `lib/heatmap/{types,period,buckets,queries}.ts` (aggregation + domain logic)
- `app/api/projects/activity-heatmap/route.ts` (GET handler)
- `hooks/use-activity-heatmap.ts` (TanStack Query, 15s polling)
- `components/projects/activity-heatmap-{section,grid,legend,empty}.tsx`
- `components/projects/projects-container.tsx` + `app/projects/page.tsx` (integration)
- Tests: `tests/unit/heatmap/{period,buckets}.test.ts`, `tests/unit/components/projects/activity-heatmap-{grid,section}.test.tsx`, `tests/integration/heatmap/heatmap-route.test.ts`, extended `projects-with-health.test.ts`

## ⚠️ Manual Requirements

T047: Manual browser verification required — sign in, open `/projects`, confirm SC-001..SC-005 (populated on first paint, period/agent update within 1s, refresh preserves view, mobile horizontal scroll with sticky weekday column).
