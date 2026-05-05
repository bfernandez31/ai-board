# Implementation Summary: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Branch**: `AIB-773-copy-of-analysis` | **Date**: 2026-05-05
**Spec**: [spec.md](spec.md)

## Changes Summary

Added `AnalysisOutcomePairing` model + migration. Implemented fire-and-forget pairing on every SHIP transition, computing friction/cost/quality/recommendation deltas. Built owner-only drift dashboard at `/projects/[projectId]/analytics/drift` with 4 panels (confusion matrix, cost range, quality range, usage), 15s TanStack Query polling. Added nightly sweep cron for late outcomes.

## Key Decisions

Used plain HTML tables instead of `@/components/ui/table` (doesn't exist). All nullable Prisma fields use `?? null` (not `?? undefined`) for `exactOptionalPropertyTypes`. Owner-only auth returns 404 (not 403) to avoid information leak. Cursor pagination encodes `{shippedAt, id}` as base64 JSON.

## Files Modified

New: `lib/drift/{types,compute-deltas,persist,pair,sweep,queries}.ts`, `components/drift/{confusion-matrix,range-hit-panel,usage-panel,drift-dashboard}.tsx`, `app/api/projects/[id]/drift/route.ts`, `app/api/maintenance/sweep-unpaired-pairings/route.ts`, `app/projects/[id]/analytics/drift/page.tsx`, `.github/workflows/nightly-pairing-sweep.yml`, `prisma/migrations/…`. Modified: `prisma/schema.prisma`, `lib/tickets/transition.ts`, `app/projects/[id]/analytics/page.tsx`, `app/lib/query-keys.ts`.

## ⚠️ Manual Requirements

T034: Accessibility audit — verify text labels + aria-labels on all drift panel cells. T035: Performance test with 1000 paired records, confirm p95 < 1.5s.
