# Research: Support OpenAI Credentials for Codex Agent

**Feature Branch**: `AIB-536-support-openai-credentials`
**Date**: 2026-04-04

## Resolved Unknowns

### 1. OpenAI API Key Format Validation

- **Decision**: Validate with `sk-` prefix and minimum 20 characters
- **Rationale**: OpenAI uses multiple key formats (`sk-proj-...`, `sk-svcacct-...`, `sk-...`). A strict regex would break when formats change. The Anthropic provider uses a strict regex (`/^sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}$/`) because that format is stable, but OpenAI's is not.
- **Alternatives considered**: Strict regex per key type — rejected due to format instability; no validation — rejected as it would send garbage to the API.

### 2. OpenAI Live Verification Endpoint

- **Decision**: `GET https://api.openai.com/v1/models` with `Authorization: Bearer ${key}`
- **Rationale**: Lightweight, read-only, no token consumption. Returns 200 for valid keys, 401 for invalid. Mirrors the pattern used for Anthropic OAuth token verification.
- **Alternatives considered**: `POST /v1/chat/completions` with minimal payload — rejected because it consumes tokens; `/v1/organization` — rejected as it requires org-level permissions.

### 3. Environment Variable Mapping Strategy

- **Decision**: Replace the current `ENV_VAR_MAP` (keyed on `CredentialType`) with a provider-aware mapping. `OPENAI` + `API_KEY` → `OPENAI_API_KEY`. `ANTHROPIC` + `API_KEY` → `ANTHROPIC_API_KEY`. `ANTHROPIC` + `OAUTH_TOKEN` → `CLAUDE_CODE_OAUTH_TOKEN`.
- **Rationale**: Current `ENV_VAR_MAP` is keyed only on `CredentialType`, which breaks when two providers both use `API_KEY`. The mapping must incorporate both provider and type.
- **Alternatives considered**: Separate map per provider — rejected as more complex with no benefit over a single composite-key map.

### 4. Credential Type Restriction for OpenAI

- **Decision**: Only `API_KEY` is valid for `OPENAI` provider. `OAUTH_TOKEN` is not supported.
- **Rationale**: OpenAI does not offer an OAuth token flow for API access.
- **Alternatives considered**: None — this is a hard constraint of the OpenAI API.

### 5. Provider-Aware Verification Routing

- **Decision**: Create `lib/ai-credentials/providers/openai.ts` following the same interface as `anthropic.ts` (`validateFormat` + `verifyWithProvider`). The credential API route and service will dispatch to the correct provider module based on `credential.provider`.
- **Rationale**: Clean separation of concerns; each provider module is self-contained and testable.
- **Alternatives considered**: Single file with switch statements — rejected for maintainability.

### 6. Agent-to-Provider Mapping

- **Decision**: Centralized constant in `lib/ai-credentials/types.ts`: `AGENT_PROVIDER_MAP: Record<Agent, CredentialProvider>` = `{ CLAUDE: 'ANTHROPIC', CODEX: 'OPENAI' }`.
- **Rationale**: Single source of truth for the mapping. Used by `getOwnerCredential()` and error messages.
- **Alternatives considered**: Inline mapping in each dispatch function — rejected for DRY violations.

### 7. Hardcoded CLAUDE Commands

- **Decision**: `code-review` (verify.yml) and `ai-board-assist` always resolve ANTHROPIC credentials regardless of ticket agent. The internal credential endpoint and dispatch functions accept an optional `provider` override for these cases.
- **Rationale**: These commands run Claude Code, not Codex, so they must always use the Anthropic credential.

## Existing Files Inventory

### Source Files to Modify

| File | What it covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` | CredentialProvider enum (only ANTHROPIC) | Add `OPENAI` to enum |
| `lib/ai-credentials/types.ts` | Type interfaces, `ENV_VAR_MAP` | Add `AGENT_PROVIDER_MAP`, update `ENV_VAR_MAP` to provider-aware, widen type literals |
| `lib/ai-credentials/workflow.ts` | `getOwnerCredential()`, `buildWorkflowPayload()`, `MISSING_CREDENTIAL_ERROR` | Accept provider param, use `AGENT_PROVIDER_MAP`, provider-aware error messages |
| `lib/ai-credentials/service.ts` | CRUD operations, imports `anthropic` provider directly | Route to correct provider module based on `provider` field |
| `lib/ai-credentials/providers/anthropic.ts` | Anthropic format validation + verification | No changes needed |
| `app/api/credentials/route.ts` | POST/GET endpoints, hardcoded `z.enum(['ANTHROPIC'])` | Add `'OPENAI'` to Zod enum, route verification to correct provider |
| `app/api/internal/credentials/route.ts` | Workflow credential fetch (hardcoded ANTHROPIC) | Accept `provider` query param, pass to `getOwnerCredential()` |
| `components/credentials/credential-form.tsx` | UI form (provider locked to ANTHROPIC) | Enable provider selection, restrict type for OPENAI |
| `lib/workflows/transition.ts` | Stage transitions + workflow dispatch | Pass agent-resolved provider to credential check |
| `app/lib/workflows/dispatch-ai-board.ts` | ai-board-assist dispatch | Always resolve ANTHROPIC (hardcoded CLAUDE command) |
| `app/lib/workflows/dispatch-rollback-reset.ts` | Rollback dispatch | Pass agent-resolved provider to credential check |
| `lib/health/scan-dispatch.ts` | Health scan dispatch | Pass appropriate provider to credential check |

### New Files to Create

| File | Purpose |
|------|---------|
| `lib/ai-credentials/providers/openai.ts` | OpenAI format validation + live verification |
| `lib/ai-credentials/providers/index.ts` | Provider registry exporting `validateFormat` / `verifyWithProvider` by provider |

### Test Files to Extend

| File | What it tests | Extension needed |
|------|--------------|-----------------|
| `tests/unit/ai-credentials.test.ts` | Crypto + Anthropic format validation | Add OpenAI format validation tests |
| `tests/unit/components/credential-form.test.tsx` | CredentialForm component | Add provider selection tests, OpenAI type restriction |
| `tests/unit/credential-dispatch-guard.test.ts` | Dispatch credential guards | Add tests for provider-aware resolution |
| `tests/integration/credentials/credential-validation.test.ts` | API format validation | Add OpenAI key format tests |
| `tests/integration/credentials/credentials-api.test.ts` | Credential CRUD API | Add OpenAI credential lifecycle tests |
| `tests/integration/credentials/workflow-credential.test.ts` | Workflow credential fetch | Add OpenAI envVar mapping tests |

### Test Files — No Changes Needed

| File | Reason |
|------|--------|
| `tests/unit/lib/workflow-auth.test.ts` | Auth is provider-agnostic |
| `tests/unit/agent-resolution.test.ts` | Agent resolution logic unchanged |
| `tests/unit/agent-schema.test.ts` | No new Agent enum value being added |
| `tests/unit/agent-icons.test.ts` | No new Agent enum value being added |
