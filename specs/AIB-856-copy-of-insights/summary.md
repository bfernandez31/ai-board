# Implementation Summary: Insights Analysis Covers All Agent Sessions of Every Ticket

**Branch**: `AIB-856-copy-of-insights` | **Date**: 2026-06-07
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced the earliest-per-shipped-ticket time-cursor selection with marker-driven, any-outcome, no-dedup enumeration of every eligible Claude session across all projects. Added a per-session `InsightsAnalyzedSession` marker (unique jobId) + `InsightsReport.expectedSessionsCount`. Status PATCH writes markers atomically on COMPLETED (skipDuplicates), derives sessionsCount from the eligible marked set, filters caller jobIds (poisoning defense); FAILED marks nothing. UI shows analyzed-of-expected, a gap badge, and a scope note. Workflow does 404-tolerant downloads.

## Key Decisions

Per-session marker table (insert-only, `@unique(jobId)`) gives once-and-only-once coverage without a global cursor (D-2). Eligibility decoupled from `TicketOutcome` (D-3). No backfill — first run re-covers the full corpus bounded by retention (D-6). Marker write + status transition wrapped in one `$transaction` (P-1); job cascade best-effort (P-4). Refusal codes renamed to session terms (D-7).

## Files Modified

prisma/schema.prisma (+model, +column) + migration; app/lib/insights/{predicate,preflight,repository}.ts; app/api/admin/insights/{jobs,jobs/[jobId]/raw-native,reports/[id]/status,trigger}/route.ts; components/admin/insights/{insights-report-view,run-analysis-button}.tsx; app/lib/hooks/queries/use-insights-preflight.ts; .github/workflows/insights-analyze.yml; 6 test files + 1 new (insights-session-coverage.test.ts).

## ⚠️ Manual Requirements

Run `prisma migrate deploy` on each environment (migration `20260607140000_insights_analyzed_session`). Integration tests are written + type-check but were not executed in-sandbox (dev server blocked by a pre-existing `.env` parse recursion); they run in CI.
