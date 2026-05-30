# Implementation Summary: Per-Stage Model Selection for Codex Agent

**Branch**: `AIB-830-add-the-change` | **Date**: 2026-05-30
**Spec**: [spec.md](spec.md)

## Changes Summary

Added per-stage Codex model selection to mirror AIB-678's Claude feature. 10 new nullable `codex*Model` columns on Project + Ticket; new `lib/models/codex-models.ts` (whitelist of 5 IDs, smart defaults, command-key map); `resolveStageModel()` branches on agent; PATCH project + apply-smart-defaults + ticket model-config endpoints branch by `defaultAgent`; `MIXED_AGENT_PAYLOAD` and `UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS` error codes added; AI Models card and override dialog render Codex dropdowns when active. Dormancy contract preserved symmetrically.

## Key Decisions

Dedicated `codex*Model` columns (not JSON, not column reuse) preserve cross-agent dormancy. Single resolver entry point with widened return type `ClaudeModelId | CodexModelId | null` avoids dispatch-site changes. `resetAll: true` clears BOTH agent column sets (agent-agnostic intent). Cost-table gains pricing for `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2`; `DEFAULT_MODEL_BY_AGENT.CODEX` stays at `gpt-5.4` (Decision D9 — divergence from resolver fallback `gpt-5.5` is intentional).

## Files Modified

`prisma/schema.prisma` + new migration; new `lib/models/codex-models.ts`; `lib/workflows/model-resolution.ts`; `lib/db/projects.ts`; `lib/analysis/cost-table.ts`; `app/lib/schemas/{model-config,clarification-policy}.ts`; `app/api/projects/route.ts` + 3 `[projectId]` route files; `app/projects/[projectId]/settings/page.tsx`; `components/settings/ai-models-card.tsx`; `components/tickets/model-override-dialog.tsx`; `components/board/ticket-detail-modal.tsx`; tests extended in `model-resolution.test.ts`, `ai-models-card.test.tsx`, `model-override-dialog.test.tsx`, `model-config.test.ts`, `model-override.test.ts`.

## ⚠️ Manual Requirements

Manual smoke verification deferred to Vercel preview — local dev server fails to load Prisma client due to a pre-existing Next.js 16 + Prisma 6 stack-overflow issue unrelated to this change. Integration tests will execute in CI.
