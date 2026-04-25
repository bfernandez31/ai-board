# Implementation Summary: Track Per-Turn Context Size on Jobs (AIB-725)

**Branch**: `AIB-725-track-per-turn` | **Date**: 2026-04-24
**Spec**: [spec.md](spec.md)

## Changes Summary

Added 3 nullable Job columns (`peakContextTokens`, `avgContextTokens`, `turnCount`) populated from per-event OTLP telemetry. Surfaced peak as a threshold-styled pill in the ticket jobs timeline, added avg + turn-count rows to expandable breakdown, and added a peak-context distribution histogram to project analytics with command/workflow/quality client-side filters.

## Key Decisions

- Reused existing OTLP DELTA/CUMULATIVE merge pattern; Mistral & Gemini avg/turnCount stay null.
- Centralized model→context-window registry in `lib/telemetry/context-window.ts` with conservative thresholds (60% / 80%).
- Reconstructed avg via `(prevAvg * prevCount) + batchSum` to avoid a 4th column.
- Static-only Tailwind class strings; no `var(--…)`-style hex codes.

## Files Modified

Created: `prisma/migrations/20260424195531_add_job_context_metrics/migration.sql`, `lib/telemetry/context-window.ts`, `components/analytics/peak-context-distribution-chart.tsx`, `tests/unit/telemetry/context-window.test.ts`, `tests/unit/components/jobs-timeline.test.tsx`. Extended: `prisma/schema.prisma`, `lib/telemetry/otlp-processor.ts`, `lib/types/job-types.ts`, `lib/utils/job-snapshots.ts`, `lib/analytics/{queries,types}.ts`, `components/{ticket/jobs-timeline,analytics/analytics-dashboard,board/board}.tsx`, `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`, plus 2 integration tests + 1 component test.

## ⚠️ Manual Requirements

Integration tests (T023) blocked locally by a pre-existing `next dev` failure: "Failed to load external module @prisma/client … Maximum call stack size exceeded" — also reproduces on `main`. Run `bun run test:integration tests/integration/telemetry/agent-agnostic.test.ts tests/integration/analytics/analytics-route.test.ts` in CI. Smoke check (T024) deferred for the same reason.
