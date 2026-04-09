# Implementation Summary: Generic Health Tests: Make TESTS Scan Work on Any Project

**Branch**: `AIB-588-generic-health-tests` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented platform-owned, config-driven TESTS scans for external repos. Added `testCapabilities` validation and loader helpers, normalized stack-detected test/lint/type-check commands into `.ai-board/config.yml`, moved TESTS orchestration to ai-board-owned scripts with explicit target-repo paths, added skipped-result handling with `skipReason`, and updated workflow routing, persistence, docs, and targeted test coverage.

## Key Decisions

Used `testCapabilities.primaryCommandKey` as the execution gate for TESTS scans, but kept suite-specific summary output in the shared runner. TESTS scans now skip cleanly when no runnable command exists, preserve first-run scoring across retries, dedupe repeated fix results by issue id, and keep `HealthScore.testsScore` unchanged on skipped runs.

## Files Modified

`.github/scripts/detect-stack.sh`, `.github/scripts/run-command.sh`, `.github/workflows/health-scan.yml`, `scripts/run-health-tests.sh`, `scripts/run-tests-with-reports.sh`, `lib/validations/config.ts`, `lib/config-loader.ts`, `lib/config-sync.ts`, `lib/health/scan-dispatch.ts`, `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`, targeted tests, and workflow docs under `specs/AIB-588-generic-health-tests/`.

## ⚠️ Manual Requirements

None
