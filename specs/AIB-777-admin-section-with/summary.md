# Implementation Summary: Admin section with Claude Code Insights report

**Branch**: `AIB-777-admin-section-with` | **Date**: 2026-05-10
**Spec**: [spec.md](spec.md)

## Changes Summary

Built /admin/insights gated by ADMIN_ALLOWLIST_EMAILS: server-rendered shell, sandboxed iframe loading `/insights` HTML through an authenticated proxy, trigger flow with pre-flight + concurrency gate + 502 rollback, workflow-token PATCH/PUT callbacks, lazy reconciliation, past-reports list with selection, `.github/workflows/insights-analyze.yml`. Non-admin = byte-identical 404. All Phase 1–6 tasks completed; T054/T055 require a live dev server (skipped).

## Key Decisions

Followed research.md verbatim (D1–D7, P1–P7): per-request env allowlist, dispatch-then-rollback pattern (P1), atomic conditional terminal writes (P2), lazy reconciliation (D2), sandbox="allow-scripts" (no allow-same-origin, D1), private blob key `insights/reports/<id>.html` (D4). Admin-auth supports the test-user-id override for integration tests via `getCurrentUserOrNull`.

## Files Modified

prisma/schema.prisma + migration; .env(.example|.test); lib/admin/{admin-auth,insights/*}; app/lib/admin/insights/status-update-validator.ts; app/lib/workflows/dispatch-insights-analyze.ts; app/lib/blob/client.ts; app/lib/query-keys.ts; app/admin/{layout,page,insights/page}.tsx; app/api/admin/insights/* + app/api/internal/admin-insights/raw-artifacts; app/components/admin/insights/* (5 files); app/hooks/admin/* (2); .github/workflows/insights-analyze.yml; tests/{unit,integration,e2e}/admin/* (12 files) + tests/helpers/admin-insights-fixtures.ts.

## ⚠️ Manual Requirements

Set ADMIN_ALLOWLIST_EMAILS in production env. Run `bunx prisma migrate deploy` on prod DB. Configure `CLAUDE_CODE_OAUTH_TOKEN` repo secret for the new workflow. Run integration (T054) + E2E (T055) against a live dev server before merge.
