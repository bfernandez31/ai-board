# Implementation Summary: Support OpenAI Credentials for Codex Agent

**Branch**: `AIB-536-support-openai-credentials` | **Date**: 2026-04-04
**Spec**: [spec.md](spec.md)

## Changes Summary

Added OPENAI to CredentialProvider enum with Prisma migration. Created OpenAI provider module (sk- prefix validation, /v1/models live verification) and provider registry. Updated credential API route, form UI, service layer, and workflow dispatch to be provider-aware. Agent-to-provider mapping (CLAUDE→ANTHROPIC, CODEX→OPENAI) drives credential resolution at dispatch time. Hardcoded CLAUDE commands always resolve ANTHROPIC credentials.

## Key Decisions

- Loose `sk-` prefix validation for OpenAI (format changes frequently) vs strict regex for Anthropic
- Provider-aware ENV_VAR_MAP with composite keys (`PROVIDER:TYPE`) replaces type-only keying
- `getMissingCredentialError(provider)` replaces static `MISSING_CREDENTIAL_ERROR` for provider-specific messages (backward-compatible export retained)
- OAuth skip scoped to ANTHROPIC+OAUTH_TOKEN only

## Files Modified

- `prisma/schema.prisma` + migration: OPENAI enum value
- `lib/ai-credentials/providers/openai.ts` (new): OpenAI validation + verification
- `lib/ai-credentials/providers/index.ts` (new): Provider registry
- `lib/ai-credentials/types.ts`: AGENT_PROVIDER_MAP, PROVIDER_ALLOWED_TYPES, provider-aware ENV_VAR_MAP
- `lib/ai-credentials/workflow.ts`: Provider-parameterized getOwnerCredential + buildWorkflowPayload
- `lib/ai-credentials/service.ts`: Provider-routed testCredential
- `app/api/credentials/route.ts`: OPENAI in Zod schema + provider-type constraint
- `components/credentials/credential-form.tsx`: Provider selector + OpenAI type lock
- `lib/workflows/transition.ts`: Agent→provider credential resolution
- 6 test files extended (47 unit + 36 integration tests pass)

## ⚠️ Manual Requirements

None
