# Implementation Summary: Generic Health Tests — Make TESTS Scan Work on Any Project

**Branch**: `AIB-586-generic-health-tests` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented generic TESTS health scan that works on any project via config.yml. Stack detection now auto-generates testing section (framework, e2e, type_check, lint commands). Generic runner supports 8 framework parsers (vitest, jest, pytest, cargo-test, go-test, rspec, phpunit, exit-code fallback). Orchestrator supports SKIPPED result for unconfigured projects, weighted scoring (granular and single-command modes), and fix loop with degradation guard. 27 new tests across 6 test files all passing.

## Key Decisions

Used bash -c subshell for test command isolation to prevent eval/exit leakage. Kept old scripts in scripts/ for backward compat during transition. Tests written as vitest TypeScript files (matching existing pattern in tests/unit/scripts/) rather than pure bash test scripts. Workflow file (.github/workflows/health-scan.yml) changes committed locally but require workflow token scope to push.

## Files Modified

- `.github/scripts/detect-stack.sh` — added detect_test_commands(), detect_e2e_framework(), detect_lint_typecheck(), updated config/analysis output
- `.claude-plugin/scripts/bash/run-tests-with-reports.sh` — new generic test runner
- `.claude-plugin/scripts/bash/run-health-tests.sh` — new generic orchestrator
- `.claude-plugin/commands/ai-board.health-tests-fix.md` — framework-aware report parsing
- `.ai-board/config.yml` — added testing section
- `tests/unit/scripts/*.test.ts` — 6 new test files (27 tests)

## ⚠️ Manual Requirements

Push .github/workflows/health-scan.yml changes with a token that has `workflow` scope (OAuth App token lacks this scope). The commit exists locally (4dc30da6).
