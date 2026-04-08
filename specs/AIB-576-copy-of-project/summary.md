# Implementation Summary: Project Onboarding Setup Flow

**Branch**: `AIB-576-copy-of-project` | **Date**: 2026-04-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented the imported-project setup flow end to end: persistent setup attempts, setup read/start/callback APIs, canonical `/projects/[projectId]` and `/board` gating, owner credential readiness checks, onboarding workflow callbacks, completion-driven config sync, setup UI, and targeted regression coverage for setup lifecycle, redirects, and copy.

## Key Decisions

Setup state is derived from `Project.config` plus the latest `ProjectSetupAttempt`, not duplicated on `Project`. Workflow callbacks reuse existing bearer-token auth, retries create new attempt rows, and `COMPLETED` only persists after config sync succeeds so the board is never opened from a false-success state.

## Files Modified

`prisma/schema.prisma`, `prisma/migrations/20260408120000_add_project_setup_attempts/migration.sql`, `lib/project-setup/*`, `lib/ai-credentials/workflow.ts`, `lib/config-sync.ts`, `lib/db/projects.ts`, `app/api/projects/[projectId]/**`, `app/projects/[projectId]/**`, `components/projects/*`, `.github/workflows/project-onboarding.yml`, targeted integration/unit tests, `tasks.md`.

## ⚠️ Manual Requirements

Import-route integration redirect coverage in `tests/integration/projects/import.test.ts` is still pending a repo-scope/GitHub-backed harness path. Resume from task T010: extend import redirect coverage for config-missing imports.
