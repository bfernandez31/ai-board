# Implementation Summary: Retro-Spec — Generate Project Specifications for Existing Codebases

**Branch**: `AIB-585-retro-spec-generate` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md)

## Changes Summary

Added retro-spec feature: project owners can generate specifications from the board after onboarding. Includes Prisma schema migration (SetupJobCommand enum, depth/docUrl/context fields), extended API routes for RETRO_SPEC job lifecycle, dismissible banner with modal (depth picker, optional doc URL/context), real-time polling badge, GitHub Actions workflow, and agent command for LLM-powered spec generation. 28 tests pass (19 unit + 9 integration).

## Key Decisions

Used `command` discriminator on existing `ProjectSetupJob` model instead of a separate table. ONBOARD and RETRO_SPEC jobs have independent active-job checks (scoped by command). Banner dismissal uses `useSyncExternalStore` + localStorage. Badge auto-fades 30s after completion. "Generate Specs" button provides alternate access after banner dismissal (FR-013).

## Files Modified

- `prisma/schema.prisma` — SetupJobCommand enum, new fields, composite index
- `app/api/projects/[projectId]/setup/jobs/route.ts` — Extended POST/GET for RETRO_SPEC
- `app/api/projects/[projectId]/setup/jobs/[jobId]/status/route.ts` — Skip config sync for RETRO_SPEC
- `lib/workflows/dispatch-retro-spec.ts` — New dispatch function
- `app/lib/hooks/useRetroSpecPolling.ts`, `app/lib/query-keys.ts` — Polling hook + query key
- `components/board/retro-spec-{banner,modal,badge}.tsx` — UI components
- `components/board/board.tsx`, `app/projects/[projectId]/board/page.tsx` — Board integration
- `.github/workflows/retro-spec.yml`, `.claude-plugin/commands/ai-board.retro-spec.md` — Workflow + command

## ⚠️ Manual Requirements

None
