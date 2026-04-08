# Implementation Summary: Project Onboarding — Setup Page + Hybrid Workflow

**Branch**: `AIB-572-project-onboarding-setup` | **Date**: 2026-04-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented complete project onboarding flow: SetupJob model with Prisma migration, setup API (POST dispatch + GET status), credential-check endpoint, setup page with agent selector (Claude Code/Codex), credential validation, progress polling (2s TanStack Query), and two-phase onboard workflow (deterministic stack detection + LLM content generation). Includes error recovery with retry, partial completion handling, and running-state recovery on page refresh.

## Key Decisions

- Dedicated SetupJob model (not reusing Job/HealthScan) due to different lifecycle and scope (project-scoped, one-time, tracks partial completion). Followed health-scan dispatch pattern for workflow dispatch. Extended PATCH /api/jobs/[id]/status with setupJobId field rather than creating a separate callback endpoint. Config sync triggers automatically on COMPLETED status.

## Files Modified

- `prisma/schema.prisma` — SetupJob model + SetupJobStatus enum
- `lib/setup/service.ts`, `lib/setup/dispatch.ts` — backend services
- `app/api/projects/[projectId]/setup/route.ts` — POST/GET setup API
- `app/api/projects/[projectId]/setup/credential-check/route.ts` — credential check
- `app/hooks/use-setup-job.ts` — polling hook
- `components/setup/` — agent-selector, credential-status, setup-progress, setup-file-list, setup-wizard
- `app/projects/[projectId]/setup/page.tsx` — setup page
- `.github/workflows/onboard.yml` — two-phase workflow
- `.specify/scripts/bash/detect-stack.sh` — stack detection (7+ ecosystems)
- `lib/validations/config.ts` — ruby, php, rails, laravel, bundler, composer

## ⚠️ Manual Requirements

None
