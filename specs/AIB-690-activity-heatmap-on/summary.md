# Implementation Summary: Activity Heatmap on Projects Page

**Branch**: `AIB-690-activity-heatmap-on` | **Date**: 2026-04-19
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a GitHub-style activity heatmap below project cards on `/projects`. Server-side aggregation across Job/Ticket/Project/ProjectMember (user-scoped, read-only) powers a SSR-rendered 7×N grid with 15s polling. Supports rolling-12-month (default) or calendar-year view, per-agent filter, tooltips on hover (desktop) and popover on touch, URL-shareable state (`heatmapPeriod`, `heatmapAgent`), empty-state and non-blocking error card. No DB schema changes.

## Key Decisions

- Quantile-based (p25/p50/p75) intensity bucketing with empty-bucket-1 guard for flat distributions.
- UTC calendar-day grouping via `formatUTCDate` for timezone-deterministic server aggregation.
- Effective-agent resolution: `ticket.agent OR (ticket.agent IS NULL AND project.defaultAgent = agent)`.
- Tailwind literal classes via `BUCKET_CLASSES` array (no dynamic concatenation).
- Invalid filter params silently coerced to defaults rather than 400.

## Files Modified

Created: `lib/analytics/heatmap-types.ts`, `lib/analytics/heatmap-queries.ts`, `app/api/activity/heatmap/route.ts`, `components/projects/activity-heatmap{,-grid,-cell}.tsx`, `tests/unit/heatmap-aggregations.test.ts`, `tests/unit/components/activity-heatmap.test.tsx`, `tests/integration/analytics/heatmap-route.test.ts`. Modified: `lib/analytics/aggregations.ts`, `lib/analytics/queries.ts`, `app/lib/query-keys.ts`, `app/globals.css`, `components/projects/projects-container.tsx`, `app/projects/page.tsx`.

## ⚠️ Manual Requirements

Manual QA (T029–T033) pending: 375px viewport sticky scroll, dark-mode WCAG AA contrast, URL round-trip with `?heatmapPeriod=2025&heatmapAgent=CLAUDE`, no-spinner cold load, and invalid-param silent coercion. All automated gates (type-check, lint, 35 unit tests, 13 integration tests) pass.
