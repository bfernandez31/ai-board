# Implementation Summary: Admin home dashboard with business KPIs and trends

**Branch**: `AIB-800-admin-home-dashboard` | **Date**: 2026-05-12
**Spec**: [spec.md](spec.md)

## Changes Summary

Full admin home dashboard at `/admin` replacing the old redirect. Renders 5 sections: Alertes (conditional alert banners), Pulse (4 KPI tiles with 30-day sparklines), Santé Business (plan donut + activation funnel + churn panel), Tendances (signups/day, jobs/day, MRR/month charts), Détails actionnables (new paying, cancellations, top users, top projects tables). TanStack Query 30s polling with placeholderData for no-flash refresh.

## Key Decisions

Raw SQL via `$queryRaw` for DATE_TRUNC grouping (Prisma groupBy doesn't support it). Dynamic imports in snapshot.ts to isolate per-aggregator failures. `vi.hoisted()` for Prisma mocks to avoid hoisting-before-init errors. Recharts Tooltip formatters removed to avoid ValueType|undefined type conflicts with strict TS. WebhookOutcome seeding in E2E skipped — covered by integration tests.

## Files Modified

New: `prisma/schema.prisma` (WebhookOutcome+CronRun), `lib/admin/home/{types,format,snapshot,alerts,kpis,business,trends,tables}.ts`, `app/api/admin/home/route.ts`, `app/api/maintenance/cron-heartbeat/route.ts`, `app/admin/page.tsx`, 13 components, 12 unit test files, 4 integration test files, 1 E2E. Modified: stripe webhook route, 2 workflow YAMLs.

## ⚠️ Manual Requirements

T061 smoke check: start dev server, sign in as seeded admin, load `/admin`, confirm first paint < 3s and no visible skeleton during 30s refresh cycle. Provision `WORKFLOW_API_TOKEN` in all environments for cron-heartbeat endpoint.
