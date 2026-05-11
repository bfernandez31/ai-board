# Implementation Summary: Copy of Admin Section with Claude Code Insights Report

**Branch**: `AIB-791-copy-of-admin` | **Date**: 2026-05-11
**Spec**: [spec.md](spec.md)

## Changes Summary

Added /admin shell gated by ADMIN_ALLOWLIST, with /admin/insights rendering Claude Code /insights reports inline via a sandboxed iframe. Trigger flow with atomic single-flight runs, dispatch-failure rollback to FAILED (D-5), orphan reconciliation, server-side output validation, byte-equivalent 404 parity for non-admins (FR-003), and a workflow-only enumeration + raw-native streaming endpoint feeding the analyzer.

## Key Decisions

New InsightsReport model + InsightsRunStatus enum; Job.ticketId made nullable. All status transitions use atomic updateMany WHERE status='RUNNING' (P-1). Shared predicate in app/lib/insights/predicate.ts is the only source of truth for "is this a Claude job?" (FR-025, D-6). Iframe uses sandbox="allow-scripts" without allow-same-origin (FR-018). Insights jobs short-circuit notifications and auto-mode (FR-022).

## Files Modified

prisma/schema.prisma + migration; app/admin/{layout,page,insights/page}.tsx; app/api/admin/insights/{trigger,preflight,reports/[id]/{html,status,finalize}/route,reports/route,jobs/{route,[jobId]/raw-native/route}}.ts; app/lib/{auth/admin,insights/*,blob/client,hooks/queries/use-insights-reports}.ts; components/admin/insights/*; next.config.ts; .github/workflows/insights-analyze.yml; 13 new test files (53 unit, 8 integration files, 1 e2e).

## ⚠️ Manual Requirements

Set `ADMIN_ALLOWLIST=email1,email2` in production and preview environments. `INSIGHTS_RUN_TIMEOUT_MINUTES` defaults to 60 if unset. Confirm `WORKFLOW_API_TOKEN`, `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN` provisioned. T059 + T067 smoke tests deferred to /ai-board.verify.
