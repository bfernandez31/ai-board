# Implementation Summary: Generic Health Tests — Make TESTS Scan Work on Any Project

**Branch**: `AIB-586-generic-health-tests` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md)

## Changes Summary

Replaced hardcoded vitest/Playwright TESTS health scan with config-driven generic system. Created generic test runner and orchestrator in `.claude-plugin/scripts/bash/` supporting 8 frameworks (vitest, jest, pytest, cargo-test, go-test, rspec, phpunit, exit-code fallback). Extended detect-stack.sh with test command, E2E, lint, and type-check auto-detection. Added SKIPPED support for unconfigured projects. Updated health-scan.yml workflow to use plugin scripts with config-driven Playwright install.

## Key Decisions

Used `yq` for YAML parsing (available in CI). Placed scripts in `.claude-plugin/scripts/bash/` for cross-repo sparse checkout. Made `MAX_ITERATIONS` env-configurable for testing without LLM agent. Used exit-code fallback for unknown frameworks. Granular mode: weighted scoring (-1/-3/-5). Single-command: flat -2.

## Files Modified

- `.claude-plugin/scripts/bash/run-tests-with-reports.sh` (NEW — generic test runner, 535 lines)
- `.claude-plugin/scripts/bash/run-health-tests.sh` (NEW — generic orchestrator, 430 lines)
- `.github/scripts/detect-stack.sh` (3 new detection functions + config/analysis output)
- `.github/workflows/health-scan.yml` (TESTS path, Playwright condition, SKIPPED support)
- `.claude-plugin/commands/ai-board.health-tests-fix.md` (framework-aware parsing)
- `.ai-board/config.yml` (added testing section + test/dev_server commands)
- 8 new test files in `tests/unit/scripts/` (66 tests)

## Manual Requirements

None
