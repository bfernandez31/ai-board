# Implementation Summary: Copy of Activity Heatmap on Projects Page

**Branch**: `AIB-653-copy-of-activity` | **Date**: 2026-04-15
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented the shared projects-page AI activity heatmap end to end: authenticated aggregation and API route, server-rendered initial payload on `/projects`, URL-synced period and agent filters with 15-second retained-data refreshes, responsive heatmap UI with mobile scrolling and day details, and new unit/integration/E2E coverage for shipped-count, filter validation, inherited-agent filtering, and refresh persistence.

## Key Decisions

Kept aggregation in `lib/db/projects.ts` so the page render and `/api/projects/activity` share identical auth, period, and shipped-ticket rules. The initial payload is fetched server-side for no-flash first render, while filter changes use TanStack Query with prior-data retention. Agent filtering uses `resolveEffectiveAgent(ticket.agent, project.defaultAgent)` and keeps period boundaries fixed even for zero-count views.

## Files Modified

`app/projects/page.tsx`, `components/projects/projects-container.tsx`, `components/projects/projects-activity-heatmap.tsx`, `app/api/projects/activity/route.ts`, `lib/db/projects.ts`, `app/lib/utils/projects-activity-filters.ts`, `app/lib/hooks/queries/use-projects-activity-heatmap.ts`, `app/lib/types/project.ts`, `app/lib/query-keys.ts`, `tests/integration/projects/crud.test.ts`, `tests/unit/agent-resolution.test.ts`, `tests/unit/components/projects/projects-activity-heatmap.test.tsx`, `tests/e2e/projects-activity-heatmap.spec.ts`.

## ⚠️ Manual Requirements

None
