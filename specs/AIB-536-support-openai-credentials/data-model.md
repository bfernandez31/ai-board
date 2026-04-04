# Data Model: Support OpenAI Credentials

**Feature Branch**: `AIB-536-support-openai-credentials`

## Schema Changes

### Enum: CredentialProvider

**Change**: Add `OPENAI` value

```prisma
enum CredentialProvider {
  ANTHROPIC
  OPENAI      // NEW
}
```

**Migration**: `ALTER TYPE "CredentialProvider" ADD VALUE 'OPENAI';`

**Impact**: The existing `@@unique([userId, provider])` constraint on `UserCredential` already supports multiple providers per user — no structural change needed. A user can have one ANTHROPIC and one OPENAI credential simultaneously.

### Model: UserCredential (unchanged structure)

No field additions or removals. The existing model already supports multiple providers via the `provider` enum field and `@@unique([userId, provider])` constraint.

| Field | Type | Notes |
|-------|------|-------|
| provider | CredentialProvider | Now accepts ANTHROPIC or OPENAI |
| credentialType | CredentialType | OPENAI restricts to API_KEY only (enforced in application layer) |
| All other fields | Unchanged | Encryption, preview, readiness, verification — all reused as-is |

### Enum: Agent (unchanged)

```prisma
enum Agent {
  CLAUDE
  CODEX
}
```

No schema change. The Agent enum already includes CODEX. The agent-to-provider mapping is a runtime constant, not a database relationship.

## Application-Layer Data Structures

### AGENT_PROVIDER_MAP (new constant)

```typescript
// lib/ai-credentials/types.ts
export const AGENT_PROVIDER_MAP: Record<Agent, CredentialProvider> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
};
```

**Purpose**: Centralizes the mapping from AI agent to credential provider. Used by credential resolution at workflow dispatch time.

### ENV_VAR_MAP (updated)

```typescript
// Before: keyed on CredentialType only
export const ENV_VAR_MAP: Record<CredentialType, string> = {
  API_KEY: 'ANTHROPIC_API_KEY',
  OAUTH_TOKEN: 'CLAUDE_CODE_OAUTH_TOKEN',
};

// After: keyed on CredentialProvider + CredentialType
export const ENV_VAR_MAP: Record<string, string> = {
  'ANTHROPIC:API_KEY': 'ANTHROPIC_API_KEY',
  'ANTHROPIC:OAUTH_TOKEN': 'CLAUDE_CODE_OAUTH_TOKEN',
  'OPENAI:API_KEY': 'OPENAI_API_KEY',
};
```

**Purpose**: Maps provider+type combination to the correct environment variable name for workflow injection.

### Provider-Type Constraints (new)

```typescript
// lib/ai-credentials/types.ts
export const PROVIDER_ALLOWED_TYPES: Record<CredentialProvider, CredentialType[]> = {
  ANTHROPIC: ['API_KEY', 'OAUTH_TOKEN'],
  OPENAI: ['API_KEY'],
};
```

**Purpose**: Enforces which credential types are valid for each provider. Used by the credential form (UI) and API validation.

## Validation Rules

| Provider | Type | Format | Live Verification |
|----------|------|--------|-------------------|
| ANTHROPIC | API_KEY | `/^sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}$/` | POST /v1/messages |
| ANTHROPIC | OAUTH_TOKEN | min 20 chars | GET /v1/models |
| OPENAI | API_KEY | `sk-` prefix + min 20 chars | GET /v1/models |

## State Transitions

No new state transitions. The existing `CredentialReadiness` states (PENDING_VERIFICATION, READY, ACTION_REQUIRED) apply identically to OpenAI credentials.

## Relationships

```
User ──1:N──> UserCredential (one per provider via @@unique)
  └── provider: ANTHROPIC | OPENAI

Agent ──maps to──> CredentialProvider (runtime constant, not FK)
  CLAUDE  → ANTHROPIC
  CODEX   → OPENAI

Ticket ──has──> agent (nullable, falls back to project.defaultAgent)
  └── resolved via resolveEffectiveAgent() → Agent → CredentialProvider
```
