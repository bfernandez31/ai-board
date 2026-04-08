# Implementation Summary: Project Onboarding Setup Page, API, and Job Tracking

**Branch**: `AIB-577-project-onboarding-setup` | **Date**: 2026-04-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented full project onboarding flow: ProjectSetupJob Prisma model with PENDING/RUNNING/COMPLETED/FAILED lifecycle, POST/GET/PATCH API endpoints for job management and workflow callbacks, credential-check endpoint, setup page with agent selection (Claude/Codex), credential validation, polling hook, board redirect for unconfigured projects, and stub onboard GitHub Actions workflow.

## Key Decisions

Followed HealthScan dispatch pattern for workflow dispatch function. Used single `handleDispatch` callback for both initialize and retry to satisfy React hooks rules. Board page queries configSyncedAt to redirect unconfigured projects to setup. PATCH handler triggers syncProjectConfig non-blocking on COMPLETED status.

## Files Modified

- `prisma/schema.prisma` — Added SetupJobStatus enum and ProjectSetupJob model
- `app/api/projects/[projectId]/setup/jobs/route.ts` — POST + GET handlers
- `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` — PATCH handler
- `app/api/projects/[projectId]/setup/credential-check/route.ts` — GET handler
- `app/projects/[projectId]/setup/page.tsx` — Server component
- `components/setup/setup-page-client.tsx` — Client component
- `app/lib/hooks/useSetupJobPolling.ts` — Polling hook
- `lib/workflows/dispatch-onboard.ts` — Dispatch function
- `app/projects/[projectId]/board/page.tsx` — Added redirect
- `.github/workflows/onboard.yml` — Stub workflow

## Manual Requirements

None
