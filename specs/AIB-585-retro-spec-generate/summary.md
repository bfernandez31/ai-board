# Implementation Summary: Retro-Spec — Generate Project Specifications for Existing Codebases

**Branch**: `AIB-585-retro-spec-generate` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md)

## Changes Summary

Added retro-spec feature allowing project owners to generate specifications for existing codebases after onboarding. Includes: Prisma schema migration (SetupJobCommand enum, depth/docUrl/context fields), extended setup jobs API (POST/GET/PATCH) with command discriminator, dispatch function for retro-spec workflow, board banner with localStorage dismissal, modal with depth picker and URL validation, status badge with auto-fade, polling hook, GitHub Actions workflow (retro-spec.yml), and agent command.

## Key Decisions

Used command discriminator pattern on existing ProjectSetupJob model (ONBOARD/RETRO_SPEC) instead of separate table — maintains backward compatibility and scoped concurrency. Banner uses useSyncExternalStore for localStorage. Badge fade uses pure effect with setTimeout. RETRO_SPEC requires configSyncedAt (project must be onboarded first). Jobs are independent per command type.

## Files Modified

New: `lib/workflows/dispatch-retro-spec.ts`, `app/lib/hooks/useRetroSpecPolling.ts`, `components/board/retro-spec-modal.tsx`, `components/board/retro-spec-banner.tsx`, `components/board/retro-spec-badge.tsx`, `.github/workflows/retro-spec.yml`, `.claude-plugin/commands/ai-board.retro-spec.md`, `tests/integration/projects/retro-spec-job.test.ts`, `tests/unit/components/board/retro-spec-{modal,banner,badge}.test.tsx`. Modified: `prisma/schema.prisma`, `app/api/.../setup/jobs/route.ts`, `app/api/.../status/route.ts`, `app/lib/query-keys.ts`, `components/board/board.tsx`, `app/projects/[projectId]/board/page.tsx`.

## Manual Requirements

Add `.github/workflows/retro-spec.yml` manually (requires `workflow` OAuth scope). File exists locally but cannot be pushed via OAuth App.
