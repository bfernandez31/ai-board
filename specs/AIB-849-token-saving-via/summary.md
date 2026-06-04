# Implementation Summary: Token saving via RTK + unified per-ticket Run settings

**Branch**: `AIB-849-token-saving-via` | **Date**: 2026-06-03
**Spec**: [spec.md](spec.md)

## Changes Summary

All 4 user stories implemented. Schema: `TokenSavingOutcome` enum + `Project.tokenSaving`, `Ticket.tokenSaving`, `Job.tokenSavingOutcome` (additive). Owner-only project toggle; three-state per-ticket override via a dedicated endpoint (no INBOX gate, active-run + version guards); effective value threaded into Claude dispatch inputs; non-blocking RTK activation in run-agent.sh reporting ACTIVE/INACTIVE/FELL_BACK; consolidated Run settings dialog (one kebab entry); header badge + per-job outcome indicator.

## Key Decisions

`resolveEffectiveTokenSaving` uses `??` so Force-OFF wins over a project default. Outcome reported via the existing status-PATCH channel (first-write-wins). RTK errors are swallowed by design (FR-006/SC-003) — recorded as FELL_BACK, never abort the run. Run settings reuses the existing Policy/Agent/Models dialogs as sections plus an inline token-saving control.

## Files Modified

schema.prisma + migration; lib/workflows/transition.ts; lib/db/{projects,tickets}.ts; app/lib/{schemas/clarification-policy,job-update-validator,utils/token-saving-icons}.ts; app/api/projects/[id]/route.ts + tickets/[id]/token-saving/route.ts; app/api/jobs/[id]/status/route.ts; components/settings/token-saving-card, tickets/run-settings-dialog, ui/token-saving-badge, ticket/jobs-timeline, board/ticket-detail-modal; 4 workflow YAMLs; .github/scripts/run-agent.sh; tests (unit/component + integration).

## ⚠️ Manual Requirements

Verify RTK_VERSION (`v0.5.0`) and installer URL in run-agent.sh against the real rtk-ai/rtk release. Integration tests (token-saving, transitions) and live SC-003/SC-007 checks must run in CI — the sandbox dev/build server fails to boot (Turbopack worker stack overflow loading Prisma); unit + component suites pass and type-check/lint are clean.
