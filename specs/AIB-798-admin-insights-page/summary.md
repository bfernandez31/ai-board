# Implementation Summary: Admin Insights page cosmetic refresh and failed report diagnostics

**Branch**: `AIB-798-admin-insights-page` | **Date**: 2026-05-14
**Spec**: [spec.md](spec.md)

## Changes Summary

Refreshed `/admin/insights` to live inside the admin shell with no internal H1 and tab title `Insights LLM`. Replaced the single-column past-reports list with a dense 280px PastReportsTable (date / period / status / duration, aria-pressed selection). Wrapped the view in a `md:grid-cols-[280px_minmax(0,1fr)]` two-column grid that stacks below `md:`. Swapped the FAILED placeholder for a new FailureDiagnosticsPanel that surfaces inline `errorReason`, a GH Actions link, and a "Reessayer" retry. All 34 insights unit tests + RunAnalysisButton regression pass.

## Key Decisions

Additive `ReportListEntry.workflowRunId: string | null` joined from `Job.workflowRunId` (BigInt → string) — no new endpoint. Pure helper `buildInsightsRunUrl` composes the GH URL from env vars with strict numeric validation. FailureDiagnosticsPanel reuses RunAnalysisButton with new optional `label` prop ("Reessayer") so refusal/optimistic-update behavior cannot drift between the two call sites.

## Files Modified

New: `lib/admin/insights-github-url.ts`, `components/admin/insights/{past-reports-table,failure-diagnostics-panel}.tsx`, plus 3 new test files. Modified: `app/lib/insights/repository.ts` (workflowRunId join), `app/admin/insights/page.tsx` (metadata), `components/admin/insights/{insights-report-view,run-analysis-button}.tsx`, `app/api/admin/insights/trigger/route.ts` (inline createdAt), plus extended tests for view + list-selection + e2e.

## ⚠️ Manual Requirements

T026 (E2E run) requires `E2E_ADMIN_HEADER` — CI environment will exercise the added title + no-H1 + iframe assertions. T027 manual browser verification requires an interactive admin session, skipped in this automated run.
