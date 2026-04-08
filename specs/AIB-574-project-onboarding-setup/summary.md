# Implementation Summary: Project Onboarding — Setup Page, API, and Job Tracking

**Branch**: `AIB-574-project-onboarding-setup` | **Date**: 2026-04-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented the full project onboarding flow: ProjectSetupJob Prisma model with migration, REST API (GET status, POST dispatch, PATCH callback), useSetupPolling hook with 2s auto-stop polling, server page with auth/redirect guards, client component with agent selection, credential validation, progress/success/error states, and elapsed time counter. Added onboard.yml stub workflow. All 27 tasks completed across 10 phases.

## Key Decisions

Used separate `createWorkflowClient()` pattern for workflow-authenticated test endpoints (matching existing job status test pattern). Credential validation fetches via existing GET /api/credentials endpoint with client-side provider filtering. Setup state derived from latest ProjectSetupJob + configSyncedAt (no new DB field). Post-import redirect to /setup already existed in import route.

## Files Modified

- `prisma/schema.prisma` — Added ProjectSetupJob model
- `app/api/projects/[projectId]/setup/route.ts` — GET + POST handlers
- `app/api/projects/[projectId]/setup/status/route.ts` — PATCH callback
- `app/lib/hooks/useSetupPolling.ts` — Polling hook
- `app/lib/query-keys.ts` — setupStatus key
- `app/projects/[projectId]/setup/page.tsx` — Server page
- `components/setup/setup-page-client.tsx` — Client component
- `.github/workflows/onboard.yml` — Stub workflow
- `tests/integration/projects/setup.test.ts` — 16 integration tests
- `tests/unit/components/setup-page.test.tsx` — 13 component tests
- `tests/unit/useSetupPolling.test.ts` — 4 unit tests

## ⚠️ Manual Requirements

None
