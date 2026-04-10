# Implementation Summary: Add Mistral (vibe CLI) as Third AI Agent Provider

**Branch**: `AIB-593-add-mistral-vibe` | **Date**: 2026-04-10
**Spec**: [spec.md](spec.md)

## Changes Summary

Added Mistral as a third AI agent provider alongside Claude and Codex. Implemented 5 user stories: credential storage with format validation (API_KEY only, 32+ chars, no whitespace), agent selection in project/ticket dropdowns, workflow execution via vibe CLI with OTLP trace telemetry, and OTLP trace processing with Mistral-specific cost estimation. Extended Prisma enums, all TypeScript mapping tables, and 11 existing test files.

## Key Decisions

- Permissive API key validation (min 32 chars, no prefix) since Mistral key format is not publicly documented with a stable prefix. Live verification against api.mistral.ai/v1/models provides real validation.
- OTLP trace processing reuses the existing /api/telemetry/v1/logs endpoint (detects resourceSpans key) rather than creating a separate /v1/traces route, avoiding OTEL exporter reconfiguration.
- Hardcoded `'CLAUDE' | 'CODEX'` type unions in 4 board components replaced with `import('@prisma/client').Agent` for extensibility.

## Files Modified

- `prisma/schema.prisma` + migration (Agent, CredentialProvider enums)
- `lib/ai-credentials/types.ts`, `workflow.ts`, `providers/index.ts`, `providers/mistral.ts` (new)
- `app/lib/utils/agent-icons.ts`, `lib/schemas/otlp.ts`, `app/api/telemetry/v1/logs/route.ts`
- `components/credentials/credential-form.tsx`, `components/board/{board,retro-spec-*}.tsx`
- `.github/scripts/run-agent.sh`, 5 workflow YAML files (speckit, quick-impl, verify, iterate, ai-board-assist)
- `public/agents/mistral.svg` (new)
- 11 test files extended (7 unit, 4 integration)

## ⚠️ Manual Requirements

- Add `MISTRAL_API_KEY` to GitHub repository secrets for fallback workflow execution.
- T032: Run `bun run test:integration` to validate integration tests (requires running server).
