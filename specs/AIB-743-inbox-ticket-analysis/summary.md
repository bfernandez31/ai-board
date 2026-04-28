# Implementation Summary: Inbox Ticket Analysis — Friction Risk, Recommendation, and Grounded Estimates

**Branch**: `AIB-743-inbox-ticket-analysis` | **Date**: 2026-04-28
**Spec**: [spec.md](spec.md)

## Changes Summary

Adds an INBOX-only analysis panel that surfaces friction-risk, quality-gate range, QUICK/FULL recommendation with confidence + justification, decomposed cost range, scope warnings, and ≤5 anchor citations grounded on AIB-742 outcomes. Append-only `TicketAnalysis` table, 2-stage LLM pipeline dispatched via a minimal new GH Actions workflow, TanStack-Query polling hook, accessible Aurora-styled panel, and a description-changed banner with re-analyze.

## Key Decisions

Reused HealthScan dispatch pattern (P1 dispatch-then-rollback, BYOK credential handoff). Rate limit (10/h/user) derived from indexed query — no new budget table. Anchors inlined as `AnalysisOutputSchema.anchors[]` JSON, validated against `anchorIdsAttempted` on PATCH. Stale-check uses whitespace-tolerant title+description normalisation. Static USD cost table; measured cost recorded on row from workflow telemetry.

## Files Modified

`prisma/schema.prisma` (+TicketAnalysis); `lib/analysis/{types,output-schema,input-schema,cost-table,stack-extract,stale-check,anchor-retrieval,persist,serialize,dispatch-analysis,prompts/*}`; `app/api/projects/[projectId]/tickets/[id]/analysis/{route,[analysisId]/status/route}.ts`; `app/api/internal/analysis-context/route.ts`; `app/lib/hooks/queries/useTicketAnalysis.ts`; `components/ticket/{inbox-analysis-panel,inbox-analysis-button,anchor-citation-list,description-changed-banner}.tsx`; `.github/workflows/inbox-analysis.yml`; `.claude-plugin/{commands/ai-board.inbox-analysis.md,skills/inbox-analysis/SKILL.md}`; tests under `tests/{unit,integration}/analysis/` and `tests/e2e/inbox-analysis.spec.ts`.

## ⚠️ Manual Requirements

Set `WORKFLOW_API_TOKEN` and `APP_URL` env on GH Actions for the new `inbox-analysis.yml`. Integration tests require dev server (skipped here due to a pre-existing Turbopack/Prisma module-load issue unrelated to this branch); they will run in CI. Manual UI smoke-test recommended before release.
