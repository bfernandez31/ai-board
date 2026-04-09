# Implementation Summary: Retro-Spec — Generate Project Specifications for Existing Codebases

**Branch**: `AIB-587-copy-of-retro` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented full retro-spec feature: database schema (SpecGenerationJob model, SpecDepth enum, specsGeneratedAt on Project), POST/GET/PATCH API endpoints for spec generation jobs, workflow dispatch utility, setup page Step 2 with depth picker and Generate/Skip flow, board SpecGenBadge (progress indicator), SpecGenBanner (dismissable prompt for skipped specs), SpecGenModal, and retro-spec GitHub Actions workflow with agent command.

## Key Decisions

Separate SpecGenerationJob model from ProjectSetupJob to keep lifecycles independent. Reused SetupJobStatus enum for consistent state machine. Setup page redirect only when both configSyncedAt AND specsGeneratedAt are set. Banner uses sessionStorage for dismiss scope. Badge auto-fades after 30s on completion.

## Files Modified

- `prisma/schema.prisma` — SpecDepth enum, SpecGenerationJob model, specsGeneratedAt field
- `app/api/projects/[projectId]/spec-generation/jobs/route.ts` — POST + GET
- `app/api/projects/[projectId]/spec-generation/jobs/[jobId]/status/route.ts` — PATCH
- `lib/workflows/dispatch-spec-generation.ts` — Workflow dispatch
- `app/lib/hooks/useSpecGenPolling.ts` — Polling hook
- `app/projects/[projectId]/setup/page.tsx` — Step 2 redirect logic
- `components/setup/setup-page-client.tsx` — Step 2 UI
- `components/board/{spec-gen-badge,spec-gen-banner,spec-gen-modal,board}.tsx`
- `.github/workflows/retro-spec.yml` — GitHub Actions workflow
- `.claude-plugin/commands/ai-board.retro-spec.md` — Agent command

## ⚠️ Manual Requirements

The `.github/workflows/retro-spec.yml` file requires a push with `workflow` scope OAuth token. PATCH integration tests have pre-existing WORKFLOW_API_TOKEN env mismatch (affects all workflow auth tests, not specific to this feature).
