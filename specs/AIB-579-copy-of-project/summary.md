# Implementation Summary: Project onboarding hybrid workflow with stack detection and generated AI Board guidance

**Branch**: `AIB-579-copy-of-project` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented the real onboarding surface end to end: new deterministic stack detection/config generation/artifact assembly modules, richer setup-job persistence and callback validation, setup UI support for partial/failure states, onboarding workflow helper scripts and command contract, a non-stub `onboard.yml`, and focused unit/integration coverage for setup-job callbacks, config compatibility, artifact preservation, and onboarding credential guards.

## Key Decisions

Kept the existing setup API and dispatch contract additive, persisted partial onboarding state directly on `ProjectSetupJob`, expanded config validation for Ruby/PHP plus Bundler/Composer, and updated the integration harness to `prisma db push` before targeted integration runs so the new setup-job columns are present in the test database.

## Files Modified

`prisma/schema.prisma`, `prisma/migrations/20260409090000_extend_project_setup_job_onboarding/migration.sql`, `app/api/projects/[projectId]/setup/jobs/*.ts`, `lib/onboarding/*`, `.github/scripts/onboard/*`, `.github/workflows/onboard.yml`, `.claude-plugin/commands/ai-board.onboard.md`, `components/setup/setup-page-client.tsx`, `app/projects/[projectId]/setup/page.tsx`, `app/lib/hooks/useSetupJobPolling.ts`, focused unit/integration tests, `scripts/run-integration-tests.sh`, and `tasks.md`.

## ⚠️ Manual Requirements

None
