# Implementation Summary: Admin home dashboard with business KPIs and trends

**Branch**: `AIB-797-admin-home-dashboard` | **Date**: 2026-05-12
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced `/admin → /admin/insights` redirect with a 5-stratum operator dashboard: alerts strip, 4 hero KPIs (Users / MAU / MRR estimé / Active payants), business-health row (plan donut + activation funnel + churn), trends row (signups/jobs/MRR), actionable 2×2 tables. Powered by a single consolidated `GET /api/admin/home` endpoint polled every 30s with TanStack Query (keepPreviousData). New `CronRunLog` Prisma model + `POST /api/admin/cron-markers` callback wired into nightly workflows.

## Key Decisions

Single consolidated endpoint (FR-027, SC-010) over per-section routes. Aggregator fans out via `Promise.all`; errors propagate (no partial 200, FR-028). MAU + top-tables derive userId via Project ownership since Job lacks userId. MRR via `PLANS.PRO/TEAM.priceMonthly` cents (FR-012); 12-mo retroactive uses current prices (FR-021 documented). Hard-coded `CRITICAL_CRONS` list; alert deep link from `process.env.GITHUB_REPOSITORY`. Append-only marker log with lazy 7d prune (no FK, instant index).

## Files Modified

New: `app/api/admin/home/route.ts`, `app/api/admin/cron-markers/route.ts`, `app/lib/admin/home/*` (types, formatters, pulse, alerts, business-health, trends, actionable, dashboard-snapshot), `app/lib/hooks/queries/use-admin-home-snapshot.ts`, `components/admin/home/*` (11 components), `prisma/migrations/20260512000000_add_cron_run_log/`, 11 test files. Modified: `app/admin/page.tsx`, `prisma/schema.prisma`, `.github/workflows/nightly-{health,log-prune}.yml`.

## ⚠️ Manual Requirements

Run `bunx prisma migrate deploy` on prod before workflow steps roll out (first nightly will 404 otherwise but `continue-on-error: true` swallows it). Integration tests (`parity-404`, `cron-markers/post`, `home/snapshot`) require a running `TEST_MODE=true bun run dev` + DB; not executed here.
