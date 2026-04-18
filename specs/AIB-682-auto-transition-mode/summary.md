# Implementation Summary: Auto-transition mode on full-workflow tickets (AIB-682)

**Branch**: `AIB-682-auto-transition-mode` | **Date**: 2026-04-18
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a per-ticket auto-mode toggle on FULL-workflow tickets in INBOX/SPECIFY/PLAN that automatically chains SPECIFY → PLAN → BUILD. Enabling dispatches the next stage immediately when no job is running, or waits for the current running job to complete. Failures disengage auto-mode. VERIFY→PLAN rollbacks disengage auto-mode atomically.

## Key Decisions

- Reused existing `Ticket.autoMode` column (no migration).
- Fire-and-log `.catch` pattern for the job-status hook so hook failures never fail the outer PATCH.
- Dispatch-then-rollback for optimistic concurrency in `enableAutoMode`.
- Rollback disengage added to existing `$transaction` in `rollbackToPlanWithReset` (no second query).

## Files Modified

- New: `app/lib/tickets/auto-mode-eligibility.ts`, `app/lib/tickets/auto-mode.ts`, `lib/utils/auto-mode-stage-preview.ts`, `app/lib/hooks/mutations/useAutoMode.ts`, `app/api/projects/[projectId]/tickets/[id]/auto-mode/route.ts`, `components/board/auto-mode-icon.tsx`, `components/board/auto-mode-confirmation-modal.tsx`.
- Modified: `app/api/jobs/[id]/status/route.ts`, `components/board/ticket-card.tsx`, `lib/tickets/transition.ts`.
- Tests: 4 unit files, `tests/integration/tickets/auto-mode.test.ts`, `tests/integration/jobs/auto-mode-hook.test.ts`, `tests/integration/tickets/transitions.test.ts`, `tests/e2e/board/auto-mode.spec.ts`.

## ⚠️ Manual Requirements

None. Type-check, lint, 27 unit tests, and 44 impacted integration tests all pass. Playwright E2E at `tests/e2e/board/auto-mode.spec.ts` requires a running dev server to execute.
