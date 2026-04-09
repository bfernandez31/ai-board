# Implementation Summary: Retro-Spec — Generate Project Specifications for Existing Codebases

**Branch**: `AIB-587-copy-of-retro` | **Date**: 2026-04-09
**Spec**: [spec.md](spec.md)

## Changes Summary

Full implementation of retro-spec feature across 8 phases (31 tasks): SpecGenerationJob model with SpecDepth enum, POST/GET/PATCH API endpoints with Zod validation and state machine transitions, workflow dispatch utility, TanStack Query polling hook, setup page Step 2 with depth picker and generate/skip flow, board spec-gen badge (real-time status with 30s fade), board banner (session-dismissible) with generate modal, retro-spec GitHub Actions workflow, and ai-board.retro-spec agent command.

## Key Decisions

Separate SpecGenerationJob model (not extending ProjectSetupJob) for clean lifecycle separation. specsGeneratedAt cached on Project to avoid GitHub API calls. Setup page redirect only when BOTH configSyncedAt AND specsGeneratedAt set. Banner uses sessionStorage for dismiss (reappears next session per spec). PATCH tests share pre-existing workflow-token auth env issue with setup-job tests.

## Files Modified

prisma/schema.prisma, app/api/projects/[projectId]/spec-generation/jobs/route.ts, app/api/projects/[projectId]/spec-generation/jobs/[jobId]/status/route.ts, lib/workflows/dispatch-spec-generation.ts, app/lib/query-keys.ts, app/lib/hooks/useSpecGenPolling.ts, app/projects/[projectId]/setup/page.tsx, components/setup/setup-page-client.tsx, app/projects/[projectId]/board/page.tsx, components/board/board.tsx, components/board/spec-gen-badge.tsx, components/board/spec-gen-banner.tsx, components/board/spec-gen-modal.tsx, .github/workflows/retro-spec.yml, .claude-plugin/commands/ai-board.retro-spec.md

## ⚠️ Manual Requirements

None
