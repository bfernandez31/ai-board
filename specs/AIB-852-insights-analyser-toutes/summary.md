# Implementation Summary: Insights — Analyze Every Agent Session of a Ticket, Not Just One

**Branch**: `AIB-852-insights-analyser-toutes` | **Date**: 2026-06-07
**Spec**: [spec.md](spec.md)

## Changes Summary

Reworked Insights selection + coverage. Selection now enumerates EVERY captured Claude session of each ticket (all stages, all projects), decoupled from SHIP. Added `InsightsSessionCoverage` per-session marker (source of truth for "already analyzed"); coverage advances only on COMPLETED, in-transaction, keyed on the workflow's `analyzedJobIds`. Pre-flight switched to sessions (`analyzableSessions`/`expectedSessions`, refusals `NO_CLAUDE_SESSIONS`/`NO_NEW_SESSIONS`). Report view surfaces analyzed-vs-expected counts + gap badge. Unshipped sessions now downloadable.

## Key Decisions

Single inner query (`querySessionRows`) backs count + enumeration (no drift, FR-016). Correctness from coverage marker + half-open `completion < periodEnd`; periodStart derived (max covered ?? oldest ?? now) and descriptive only. Gap reason set iff expected > analyzed. `createMany({skipDuplicates})` makes coverage idempotent.

## Files Modified

Schema + migration (`InsightsSessionCoverage`, enum, `InsightsReport` cols); `predicate.ts` (rewrite), `repository.ts`, `preflight.ts`; routes `jobs`, `preflight`, `trigger`, `reports/[id]/status`, `raw-native`; `insights-report-view.tsx`, `use-insights-preflight.ts`, `run-analysis-button.tsx`; `insights-analyze.yml`; 9 test files extended + new `coverage.test.ts`.

## ⚠️ Manual Requirements

None. Migration `20260607120000_insights_session_coverage` auto-applies via `prisma migrate deploy`. Tests: 49 unit + 50 integration pass; type-check + lint clean.
