# Implementation Plan: Support OpenAI Credentials for Codex Agent

**Feature Branch**: `AIB-536-support-openai-credentials`
**Date**: 2026-04-04
**Status**: Ready for task generation

## Technical Context

| Aspect | Detail |
|--------|--------|
| Database | PostgreSQL 14+ via Prisma 6.x. `CredentialProvider` enum needs `OPENAI` value. |
| Encryption | AES-256-GCM (`lib/ai-credentials/crypto.ts`). Reused as-is for OpenAI keys. |
| Existing providers | `lib/ai-credentials/providers/anthropic.ts` — pattern to replicate. |
| Credential flow | Form → API route → format validation → live verification → encrypt → upsert |
| Workflow injection | `getOwnerCredential()` → `buildWorkflowPayload()` → env var in workflow |
| Agent resolution | `resolveEffectiveAgent()` in `lib/workflows/transition.ts` returns CLAUDE or CODEX |
| UI framework | shadcn/ui Select, Input, Button. Client component with `"use client"`. |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven | PASS | Extends existing shadcn/ui credential form component |
| III. Test-Driven | PASS | Extends 6 existing test files; no duplicate test files created |
| IV. Security-First | PASS | Zod validation, format checks, live verification, AES-256-GCM encryption |
| V. Database Integrity | PASS | Prisma migration for enum addition; upsert respects unique constraint |
| V. Spec Guardrails | PASS | All 5 auto-resolved decisions documented with trade-offs |

## Implementation Phases

### Phase 1: Schema & Provider Module (Foundation)

**Goal**: Add OPENAI to the database and create the verification module.

#### Task 1.1: Prisma Schema Migration

**File**: `prisma/schema.prisma`

Add `OPENAI` to `CredentialProvider` enum:
```prisma
enum CredentialProvider {
  ANTHROPIC
  OPENAI
}
```

Run: `bunx prisma migrate dev --name add-openai-credential-provider`
Then: `bunx prisma generate`

**Risk**: None — adding an enum value is backward-compatible. Existing ANTHROPIC credentials unaffected.

#### Task 1.2: OpenAI Provider Module

**New file**: `lib/ai-credentials/providers/openai.ts`

Implements same interface as `anthropic.ts`:
- `validateFormat(credentialType, value)`: Checks `sk-` prefix + min 20 chars. Rejects `OAUTH_TOKEN`.
- `verifyWithProvider(credentialType, value)`: GET `https://api.openai.com/v1/models` with Bearer token. 10s timeout. Same result codes (VALID, INVALID_KEY, RATE_LIMITED, UNREACHABLE).

#### Task 1.3: Provider Registry

**New file**: `lib/ai-credentials/providers/index.ts`

Exports a `getProviderModule(provider)` function that returns `{ validateFormat, verifyWithProvider }` for the given provider. Replaces direct imports of `anthropic` module in service.ts and route.ts.

#### Task 1.4: Type Updates

**File**: `lib/ai-credentials/types.ts`

1. Add `AGENT_PROVIDER_MAP`:
   ```typescript
   import { Agent, CredentialProvider } from '@prisma/client';
   export const AGENT_PROVIDER_MAP: Record<Agent, CredentialProvider> = {
     CLAUDE: 'ANTHROPIC',
     CODEX: 'OPENAI',
   };
   ```

2. Add `PROVIDER_ALLOWED_TYPES`:
   ```typescript
   export const PROVIDER_ALLOWED_TYPES: Record<CredentialProvider, CredentialType[]> = {
     ANTHROPIC: ['API_KEY', 'OAUTH_TOKEN'],
     OPENAI: ['API_KEY'],
   };
   ```

3. Update `ENV_VAR_MAP` to provider-aware:
   ```typescript
   export const ENV_VAR_MAP: Record<string, string> = {
     'ANTHROPIC:API_KEY': 'ANTHROPIC_API_KEY',
     'ANTHROPIC:OAUTH_TOKEN': 'CLAUDE_CODE_OAUTH_TOKEN',
     'OPENAI:API_KEY': 'OPENAI_API_KEY',
   };
   export function getEnvVar(provider: CredentialProvider, credentialType: CredentialType): string {
     const key = `${provider}:${credentialType}`;
     const envVar = ENV_VAR_MAP[key];
     if (!envVar) throw new Error(`No env var mapping for ${key}`);
     return envVar;
   }
   ```

4. Widen `WorkflowCredentialRequest.provider` and `WorkflowResolvedCredential.provider` from `'ANTHROPIC'` to `CredentialProvider`.

---

### Phase 2: API & Service Layer

**Goal**: Make the credential API and service layer provider-aware.

#### Task 2.1: Credential Service Updates

**File**: `lib/ai-credentials/service.ts`

- Replace direct `import { validateFormat, verifyWithProvider } from './providers/anthropic'` with `import { getProviderModule } from './providers'`.
- In `testCredential()`: Use `getProviderModule(credential.provider)` to get the correct validation/verification functions.
- OAuth skip logic: Only skip for `ANTHROPIC` + `OAUTH_TOKEN`. (OpenAI has no OAuth.)

#### Task 2.2: Credential API Route Updates

**File**: `app/api/credentials/route.ts`

- Update Zod schema: `provider: z.enum(['ANTHROPIC', 'OPENAI'])`
- Add provider-type constraint validation: If provider is OPENAI and type is OAUTH_TOKEN, return 400.
- Use `getProviderModule(validated.provider)` for format validation and live verification.
- OAuth skip logic: Only skip verification for `ANTHROPIC` + `OAUTH_TOKEN`.

#### Task 2.3: Internal Credential Endpoint Updates

**File**: `app/api/internal/credentials/route.ts`

- Add optional `provider` query param (defaults to `'ANTHROPIC'` for backward compatibility).
- Pass provider to `getOwnerCredential(projectId, provider)`.
- Update 404 error message to be provider-aware: `No ${provider} credential configured...`

---

### Phase 3: Workflow Credential Resolution

**Goal**: Resolve the correct credential at dispatch time based on agent-to-provider mapping.

#### Task 3.1: Workflow Credential Functions

**File**: `lib/ai-credentials/workflow.ts`

- `getOwnerCredential(projectId, provider?)`: Add optional `provider` parameter (defaults to `'ANTHROPIC'`). Query `prisma.userCredential.findFirst({ where: { userId, provider } })`.
- `buildWorkflowPayload(credential)`: Use `getEnvVar(credential.provider, credential.credentialType)` instead of the old `ENV_VAR_MAP[credential.credentialType]`.
- `MISSING_CREDENTIAL_ERROR` → `getMissingCredentialError(provider)`: Returns provider-specific error message.

#### Task 3.2: Transition Dispatch Updates

**File**: `lib/workflows/transition.ts`

- After `resolveEffectiveAgent(ticket)`, compute `const provider = AGENT_PROVIDER_MAP[effectiveAgent]`.
- Pass `provider` to `getOwnerCredential(projectId, provider)`.
- Use `getMissingCredentialError(provider)` for error messages.

#### Task 3.3: AI-Board Assist Dispatch (Hardcoded CLAUDE)

**File**: `app/lib/workflows/dispatch-ai-board.ts`

- Always pass `provider: 'ANTHROPIC'` to `getOwnerCredential()` regardless of ticket agent.
- This ensures ai-board-assist commands (which run Claude Code) always use the Anthropic credential.

#### Task 3.4: Rollback Reset Dispatch

**File**: `app/lib/workflows/dispatch-rollback-reset.ts`

- Resolve provider from agent via `AGENT_PROVIDER_MAP[resolveEffectiveAgent(ticket)]`.
- Pass provider to `getOwnerCredential()`.

#### Task 3.5: Health Scan Dispatch

**File**: `lib/health/scan-dispatch.ts`

- Resolve provider from project context (health scans use ANTHROPIC by default since they run Claude).
- Pass `'ANTHROPIC'` to `getOwnerCredential()` — health scans always use Claude.

#### Task 3.6: Internal Credential Endpoint — Workflow Side

The GitHub workflow YAML files (`ai-board-assist.yml`, `speckit.yml`, `quick-impl.yml`, `verify.yml`) currently call `GET /api/internal/credentials?projectId=X`. They need to pass the `provider` query param based on the agent input.

**Note**: Workflow YAML changes are out of scope for this PR if the assumption holds that workflows already handle `OPENAI_API_KEY`. If not, a follow-up is needed. The internal API defaults to ANTHROPIC for backward compatibility, so existing workflows continue to work without changes.

---

### Phase 4: UI Updates

**Goal**: Enable provider selection in the credential form.

#### Task 4.1: Credential Form — Provider Selection

**File**: `components/credentials/credential-form.tsx`

- Change `const [provider] = useState("ANTHROPIC")` to `const [provider, setProvider] = useState<CredentialProvider>("ANTHROPIC")`.
- Enable the provider `<Select>` (remove `disabled`).
- Add `<SelectItem value="OPENAI">OpenAI</SelectItem>`.
- When provider changes to OPENAI:
  - Force `credentialType` to `"API_KEY"`.
  - Disable the credential type selector (or hide OAUTH_TOKEN option).
  - Update placeholder text to `"sk-proj-..."`.
- Update `validateFormat()` to check for `sk-` prefix (not `sk-ant-api`) when provider is OPENAI.

#### Task 4.2: Credential Item — Provider Display

**File**: `components/credentials/credential-item.tsx`

- Ensure provider name displays correctly for OPENAI (likely already works since it displays `credential.provider`).
- Verify verification messages reference the correct provider name.

---

### Phase 5: Testing

**Goal**: Extend existing test files to cover OpenAI credential support.

#### Task 5.1: Unit Tests — OpenAI Format Validation

**File**: `tests/unit/ai-credentials.test.ts`

Add test cases:
- OpenAI API key with `sk-` prefix passes format validation
- OpenAI API key without `sk-` prefix fails
- OpenAI API key too short fails
- OpenAI OAUTH_TOKEN is rejected
- Provider registry returns correct module for each provider

#### Task 5.2: Unit Tests — Credential Form Component

**File**: `tests/unit/components/credential-form.test.tsx`

Add test cases:
- Provider selector is enabled and shows ANTHROPIC + OPENAI options
- Selecting OPENAI locks credential type to API_KEY
- OpenAI format validation in form (sk- prefix check)
- Selecting OPENAI then back to ANTHROPIC re-enables OAUTH_TOKEN option

#### Task 5.3: Unit Tests — Dispatch Guards

**File**: `tests/unit/credential-dispatch-guard.test.ts`

Add test cases:
- Codex-agent ticket resolves OPENAI provider for credential check
- Missing OPENAI credential blocks dispatch with provider-specific error
- Hardcoded CLAUDE commands always check ANTHROPIC credential

#### Task 5.4: Integration Tests — Credential Validation

**File**: `tests/integration/credentials/credential-validation.test.ts`

Add test cases:
- POST `/api/credentials` with OPENAI provider and valid format succeeds
- POST with OPENAI + OAUTH_TOKEN returns 400
- POST with OPENAI + invalid key format returns 400

#### Task 5.5: Integration Tests — Credential API

**File**: `tests/integration/credentials/credentials-api.test.ts`

Add test cases:
- Full CRUD lifecycle for OPENAI credential
- User can have both ANTHROPIC and OPENAI credentials simultaneously
- Replacing OPENAI credential (upsert behavior)

#### Task 5.6: Integration Tests — Workflow Credential Fetch

**File**: `tests/integration/credentials/workflow-credential.test.ts`

Add test cases:
- GET `/api/internal/credentials?projectId=1&provider=OPENAI` returns OPENAI_API_KEY envVar
- Default (no provider param) returns ANTHROPIC credential (backward compat)
- Provider-specific 404 error message

## Testing Strategy

Per constitution III (Test-Driven Development), all tests extend existing files. No new test files are created. Test selection follows the decision tree:
- Format validation: Unit tests (pure functions, no side effects)
- Form component: Vitest + RTL component tests (user interactions)
- API endpoints: Vitest integration tests (API calls + database)
- Dispatch guards: Unit tests (mocked dependencies)

## Dependency Order

```
Phase 1 (Schema + Provider) → Phase 2 (API + Service) → Phase 3 (Workflow) → Phase 4 (UI)
                                                                                    ↓
                                                                              Phase 5 (Tests)
```

Phase 5 tests can be written alongside each phase but should validate against the completed implementation.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenAI changes key format | Low | Low | Loose `sk-` prefix check; live verification is authoritative |
| ENV_VAR_MAP refactor breaks existing flows | Medium | High | Backward-compatible default; integration tests verify both providers |
| Workflow YAML needs provider param | Low | Medium | Internal API defaults to ANTHROPIC; existing workflows unchanged |
| Migration fails on existing data | Very Low | Medium | Enum addition is append-only; no data transformation needed |

## Generated Artifacts

- `specs/AIB-536-support-openai-credentials/research.md` — Research findings and existing file inventory
- `specs/AIB-536-support-openai-credentials/data-model.md` — Entity and schema changes
- `specs/AIB-536-support-openai-credentials/contracts/credentials-api.md` — Updated API contracts
- `specs/AIB-536-support-openai-credentials/plan.md` — This file
