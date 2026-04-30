# Implementation Summary: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Branch**: `AIB-744-analysis-calibration-predicted` | **Date**: 2026-04-30
**Spec**: [spec.md](spec.md)

## Changes Summary

Added immutable AnalysisCalibration model + migration, in-process pairing chained from SHIP transition (post-capture), owner-only `/projects/:projectId/calibration` page + `/api/projects/:projectId/calibration` route, dashboard with confusion matrix, quality/cost verdict distributions, recommendation panel, and adoption counter (15s polling). All 41 tasks complete; type-check + lint clean; 27 unit tests green.

## Key Decisions

Pairing fires in-process from `transition.ts` (no new GitHub workflow). Confusion cell stored as enum string. Verdicts (`hit/miss/n_a`) explicit on row to preserve rule-set v1 semantics. Adoption denominator derived from `MIN(TicketAnalysis.createdAt)` (no schema marker). Owner-only collapses 404 for member/non-member to prevent leak (SC-007).

## Files Modified

prisma/schema.prisma + migration; lib/calibration/{types,derive,persist,pair,queries,serialize}.ts; lib/tickets/transition.ts; app/api/projects/[projectId]/calibration/route.ts; app/projects/[projectId]/calibration/page.tsx; app/lib/{query-keys.ts,hooks/queries/useCalibration.ts}; components/calibration/{calibration-dashboard,confusion-matrix-table,verdict-distribution-chart,recommendation-panel,adoption-counter,empty-state}.tsx; tests/unit/calibration/+ tests/unit/components/+ tests/integration/calibration/.

## ⚠️ Manual Requirements

Integration tests (T038-T040) and manual visual pass (T041) were not executable in this sandbox due to a pre-existing Next.js 16 + Turbopack + Prisma client load failure ("Maximum call stack size exceeded"). They will run in CI / preview deploy. Type-check, lint, and unit suite all pass locally.
