# Implementation Summary: Track Per-Turn Context Size on Jobs (AIB-725)

**Branch**: `AIB-725-track-per-turn` | **Date**: 2026-04-25
**Spec**: [spec.md](spec.md)

## Changes Summary

Added 3 nullable Job columns (`peakContextTokens`, `avgContextTokens`, `turnCount`) populated from per-event OTLP telemetry. Surfaced peak as a threshold-styled pill in the ticket jobs timeline, added avg + turn-count rows to the expandable breakdown, and added a peak-context distribution histogram to project analytics with command / workflow / quality client-side filters. Mistral and Gemini avg/turnCount stay null per FR-004.

## Key Decisions

- Reused existing OTLP DELTA/CUMULATIVE merge pattern; Gemini cumulative snapshots track only peak.
- Centralized model→context-window registry in `lib/telemetry/context-window.ts` with conservative thresholds (60% / 80%).
- Reconstructed avg via `(prevAvg * prevCount + batchSum) / newCount` to avoid a 4th column.
- Static-only Tailwind class strings; pill stays inline in `JobRow` (single use, <40 lines).

## Files Modified

Created: `prisma/migrations/20260425061714_add_job_context_metrics/migration.sql`, `lib/telemetry/context-window.ts`, `components/analytics/peak-context-distribution-chart.tsx`, `tests/unit/telemetry/context-window.test.ts`, `tests/unit/components/jobs-timeline.test.tsx`. Extended: `prisma/schema.prisma`, `lib/telemetry/otlp-processor.ts`, `lib/types/job-types.ts`, `lib/utils/job-snapshots.ts`, `lib/analytics/{queries,types}.ts`, `components/{ticket/jobs-timeline,analytics/analytics-dashboard,board/board}.tsx`, `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`, plus 2 integration tests + 1 component test extension.

## Manual Requirements

None. Type-check, lint, unit tests (41), and integration tests (telemetry: 26, analytics: 8) all pass locally.
