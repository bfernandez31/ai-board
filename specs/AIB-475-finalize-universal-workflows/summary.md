# Implementation Summary: Finalize Universal Workflows

**Branch**: `AIB-475-finalize-universal-workflows` | **Date**: 2026-04-01
**Spec**: [spec.md](spec.md)

## Changes Summary

Created run-command.sh for centralized command dispatch with config parsing and fallback defaults. Extended setup-environment.sh with --mode lightweight|full parameter for phase-aware setup boundaries. Updated all 6 workflow files (speckit, quick-impl, verify, health-scan, ai-board-assist, iterate) to use universal scripts, conditional service containers (postgres/redis/mysql/mongo), and workspace-root-relative script paths.

## Key Decisions

- Used conditional image expressions for service containers (empty string skips container creation)
- Two-tier setup mode (lightweight/full) covers all workflow phases without over-engineering
- Fallback defaults in run-command.sh match .ai-board/config.yml exactly for backward compatibility
- Kept framework-specific test reporter flags inline in verify.yml rather than routing through run-command.sh

## Files Modified

- `.github/scripts/run-command.sh` (new)
- `.github/scripts/setup-environment.sh` (modified: --mode parameter)
- `.github/workflows/speckit.yml` (service inputs, setup-environment.sh, path fixes)
- `.github/workflows/quick-impl.yml` (same)
- `.github/workflows/verify.yml` (same)
- `.github/workflows/health-scan.yml` (same + TESTS-only service logic)
- `.github/workflows/ai-board-assist.yml` (conditional mode, path fixes)
- `.github/workflows/iterate.yml` (lightweight mode, path fixes)
- `tests/unit/scripts/run-command.test.ts` (new: 8 unit tests)

## Manual Requirements

None
