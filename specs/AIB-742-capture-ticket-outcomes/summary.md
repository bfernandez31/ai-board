# Implementation Summary: Capture Ticket Outcomes at SHIP for Analytics and Prediction Grounding

**Branch**: `AIB-742-capture-ticket-outcomes` | **Date**: 2026-04-26
**Spec**: [spec.md](spec.md)

## Changes Summary

Persist one immutable `TicketOutcome` row per shipped ticket — job-aggregate telemetry, pipeline/friction job classification, last-verify quality score, change-shape (files/lines/test ratio), structural domains, semantic tags (db/tests/ci), and a derived `frictionFree` flag. Capture is fire-and-forget after the SHIP optimistic update; never blocks the response. Per-project backfill workflow + script + REST endpoints populate historical SHIP tickets idempotently with rate-limit-aware Octokit usage.

## Key Decisions

- Single Prisma migration adds `TicketOutcome`, `BackfillProgress`, `BackfillStatus` enum.
- Idempotency via `@@unique(ticketId)` + P2002 catch — no `upsert` (preserves immutability).
- In-code `STACK_INDICATORS` keyed by language/framework/services from `Project.config` JSON; `picomatch` for glob matching; unknown stacks fall through to false (FR-009).
- Live capture and backfill share `lib/outcomes/capture.ts`; backfill resumes from `BackfillProgress.lastProcessedTicketId` with optimistic locking.

## Files Modified

prisma/schema.prisma + new migration; new `lib/outcomes/{types,classification,derivation,stack-indicator-lookup,github-files,persist,capture,serialize}.ts`; modified `lib/tickets/transition.ts` (fire-and-forget hook on SHIP); additive `lib/analytics/queries.ts::getOutcomeAggregates`; new routes `/tickets/[id]/outcome`, `/outcomes`, `/backfill-outcomes`, `/backfill-outcomes/status`; new `lib/workflows/dispatch-backfill-outcomes.ts`; new `scripts/backfill-outcomes.ts`; new `.github/workflows/backfill-outcomes.yml`; new tests under `tests/unit/outcomes/` and `tests/integration/outcomes/`.

## ⚠️ Manual Requirements

Run `bunx prisma migrate deploy` in non-test environments to apply the `ticket_outcomes` migration. Set `DATABASE_URL` in `backfill-outcomes.yml` workflow secrets. SC-007 latency smoke check (T049) deferred — pre-existing dev-server module-loading recursion (Prisma 6.19 + Next.js 16) blocks local server startup.
