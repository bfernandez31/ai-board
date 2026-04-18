# Implementation Summary: Per-stage model configuration for Claude workflows

**Branch**: `AIB-678-per-stage-model` | **Date**: 2026-04-18
**Spec**: [spec.md](spec.md)

## Changes Summary

Added 5 nullable model columns on Project and Ticket (specifyModel/planModel/implementModel/quickImplModel/verifyModel), pure resolver (ticket → project → claude-opus-4-7 fallback, short-circuits on non-Claude), AIModelsCard settings UI, per-ticket ModelOverrideDialog, "Custom models" badge, apply-smart-defaults endpoint, SMART_DEFAULTS seeding on project creation, and `model` workflow_dispatch input wired to ANTHROPIC_MODEL in speckit/quick-impl/verify.

## Key Decisions

Pure additive migration (nullable, no backfill) to avoid touching existing dispatch behavior. Resolver silently treats stale non-whitelisted values as "not set" and falls through. Auth on updateProject broadened from owner-only to owner-or-member (FR-018). Dispatch-time resolution populates Job.model and only emits `model` in workflowInputs when resolved value is non-null.

## Files Modified

schema.prisma + migration 20260418172728; lib/models/claude-models.ts, lib/workflows/model-resolution.ts; lib/db/projects.ts, lib/db/tickets.ts, lib/types.ts; app/lib/schemas/model-config.ts; app/api/projects/route.ts + [projectId]/route.ts + [projectId]/model-config/apply-smart-defaults/route.ts + [projectId]/tickets/[id]/model-config/route.ts; components/settings/ai-models-card.tsx; components/tickets/model-override-dialog.tsx; components/board/ticket-card.tsx; lib/workflows/transition.ts; 3 workflow YAMLs; 7 test files.

## ⚠️ Manual Requirements

T030 manual smoke pass (dispatch SPECIFY + VERIFY on a test project for each resolution layer and confirm Job.model) requires a live workflow environment; deferred.
