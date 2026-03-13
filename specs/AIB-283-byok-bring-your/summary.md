# Implementation Summary: BYOK - Bring Your Own API Key

**Branch**: `AIB-283-byok-bring-your` | **Date**: 2026-03-13
**Spec**: [spec.md](spec.md)

## Changes Summary

Implemented project-scoped BYOK for Anthropic/OpenAI: Prisma models and migration, encrypted credential storage, validation and masking services, owner/member settings UI and APIs, workflow launch gating with job-scoped credential snapshots, workflow runtime credential fetch/export wiring, and targeted unit/component/integration test coverage for the new paths.

## Key Decisions

Stored decryptable encrypted provider keys with masked suffix metadata, blocked workflow dispatch before job launch when required provider credentials are missing or invalid, and snapshotted credentials per job so key rotation only affects future workflows. Workflow runners now fetch provider keys at runtime through the workflow-authenticated API instead of workflow inputs.

## Files Modified

`prisma/schema.prisma`, `prisma/migrations/20260313120000_add_project_ai_credentials/migration.sql`, `lib/security/project-ai-credentials.ts`, `lib/services/ai-credential-service.ts`, `lib/services/ai-provider-validation.ts`, `lib/workflows/transition.ts`, `app/api/projects/[projectId]/ai-credentials/*`, `components/settings/ai-credentials-card.tsx`, `.github/scripts/run-agent.sh`, `.github/workflows/*.yml`, targeted tests and `tasks.md`.

## ⚠️ Manual Requirements

Set `PROJECT_CREDENTIAL_ENCRYPTION_KEY` in runtime environments and rerun the targeted integration suites in an environment that allows binding a local test server port. Push from this workspace may still require repository credentials outside the sandbox.
