# Implementation Summary: [Feature Specification: Project Onboarding Setup Page and Hybrid Initialization Workflow]

**Branch**: `AIB-573-copy-of-project` | **Date**: 2026-04-08
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented the onboarding foundation and MVP path: new `ProjectSetupJob` persistence, setup schemas/query keys, setup access/service/artifact helpers, owner-only setup APIs and page, setup-aware project entry routing, a minimal onboarding workflow/script, settings artifact review APIs/UI, and targeted setup/settings integration coverage. Remaining later-phase hardening tasks are still open.

## Key Decisions

Used a dedicated project-scoped setup job model, centralized setup access resolution, reused config sync on successful callback, kept workflow dispatch lightweight in test mode, and treated repository artifacts as the editable source of truth while persisting only job summaries in the database.

## Files Modified

`prisma/schema.prisma`, `prisma/migrations/20260408160000_add_project_setup_job/migration.sql`, `app/api/projects/[projectId]/setup/*`, `app/projects/[projectId]/{page.tsx,board/page.tsx,settings/page.tsx,setup/page.tsx}`, `components/projects/setup/setup-page-client.tsx`, `components/settings/onboarding-artifacts-card.tsx`, `lib/onboarding/*`, `tests/integration/projects/{setup,settings}.test.ts`, `specs/AIB-573-copy-of-project/tasks.md`

## ⚠️ Manual Requirements

Resume from task T009: extend provider credential lookup and workflow secret mapping in `lib/ai-credentials/workflow.ts` and `app/api/internal/credentials/route.ts`
