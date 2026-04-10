# Data Model: Add Mistral (vibe CLI) as Third AI Agent Provider

**Branch**: `AIB-593-add-mistral-vibe`
**Created**: 2026-04-10

## Entity Changes

### 1. Agent Enum (Prisma)

**Current**:
```prisma
enum Agent {
  CLAUDE
  CODEX
}
```

**Updated**:
```prisma
enum Agent {
  CLAUDE
  CODEX
  MISTRAL
}
```

**Impact**: All `Record<Agent, ...>` TypeScript maps will fail compilation until MISTRAL is added. Used in:
- `Project.defaultAgent` (default: CLAUDE)
- `Ticket.agent` (nullable override)
- `ProjectSetupJob.agent`
- `AGENT_PROVIDER_MAP` in `lib/ai-credentials/types.ts`
- `AGENT_METADATA` in `app/lib/utils/agent-icons.ts`

### 2. CredentialProvider Enum (Prisma)

**Current**:
```prisma
enum CredentialProvider {
  ANTHROPIC
  OPENAI
}
```

**Updated**:
```prisma
enum CredentialProvider {
  ANTHROPIC
  OPENAI
  MISTRAL
}
```

**Impact**: All `Record<CredentialProvider, ...>` maps will fail until MISTRAL is added. Used in:
- `UserCredential.provider` (unique with userId)
- `PROVIDER_MODULES` in `lib/ai-credentials/providers/index.ts`
- `PROVIDER_ALLOWED_TYPES` in `lib/ai-credentials/types.ts`
- `ENV_VAR_MAP` in `lib/ai-credentials/types.ts`
- `getMissingCredentialError` in `lib/ai-credentials/workflow.ts`

### 3. UserCredential (No schema change — reuses existing model)

The existing `UserCredential` model supports the Mistral credential without schema changes:
- `provider: MISTRAL` (new enum value)
- `credentialType: API_KEY` (only allowed type per spec Decision 1)
- `encryptedValue`: AES-256-GCM encrypted Mistral API key
- `preview`: Last 4 characters for display
- Unique constraint `[userId, provider]` ensures one Mistral key per user

### 4. Job (No schema change — reuses existing telemetry fields)

The existing `Job` model already stores all needed telemetry:
- `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens`: Token counts
- `costUsd`: Estimated cost from pricing table
- `durationMs`: Accumulated from trace span durations
- `model`: e.g., `mistral-large-latest`
- `toolsUsed`: Array of tool names from trace spans

No new columns needed. Trace data is processed into the same fields as log data.

## Mapping Tables (Application-Level, Not Database)

### AGENT_PROVIDER_MAP

```typescript
export const AGENT_PROVIDER_MAP: Record<Agent, CredentialProvider> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
  MISTRAL: 'MISTRAL',  // NEW
};
```

### PROVIDER_ALLOWED_TYPES

```typescript
export const PROVIDER_ALLOWED_TYPES: Record<CredentialProvider, CredentialType[]> = {
  ANTHROPIC: ['API_KEY', 'OAUTH_TOKEN'],
  OPENAI: ['API_KEY', 'OAUTH_TOKEN'],
  MISTRAL: ['API_KEY'],  // NEW — no OAuth per Decision 1
};
```

### ENV_VAR_MAP

```typescript
export const ENV_VAR_MAP: Record<string, string> = {
  'ANTHROPIC:API_KEY': 'ANTHROPIC_API_KEY',
  'ANTHROPIC:OAUTH_TOKEN': 'CLAUDE_CODE_OAUTH_TOKEN',
  'OPENAI:API_KEY': 'OPENAI_API_KEY',
  'OPENAI:OAUTH_TOKEN': 'CODEX_OAUTH_JSON',
  'MISTRAL:API_KEY': 'MISTRAL_API_KEY',  // NEW
};
```

### MISTRAL_PRICING (Telemetry Cost Estimation)

```typescript
const MISTRAL_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'mistral-large-latest':  { input: 2.00, output: 6.00, cached: 1.00 },
  'mistral-medium-latest': { input: 0.70, output: 2.10, cached: 0.35 },
  'mistral-small-latest':  { input: 0.10, output: 0.30, cached: 0.05 },
  'codestral-latest':      { input: 0.30, output: 0.90, cached: 0.15 },
};
```

## State Transitions

No new state transitions are introduced. The Mistral agent follows the same ticket lifecycle:
- **Normal**: INBOX → SPECIFY → PLAN → BUILD → VERIFY → SHIP
- **Quick**: INBOX → BUILD

The `resolveEffectiveAgent` function (ticket.agent ?? project.defaultAgent ?? CLAUDE) already supports any Agent enum value — MISTRAL will be resolved naturally once added to the enum.

## Validation Rules

### Mistral API Key Format
- Minimum 32 characters
- No whitespace characters
- Alphanumeric with hyphens and underscores allowed
- No required prefix (format not publicly documented with stable prefix)

### Credential Type Restriction
- Mistral only supports `API_KEY` credential type
- Attempting to create a Mistral credential with `OAUTH_TOKEN` type must be rejected at the API level via `PROVIDER_ALLOWED_TYPES` check

## Migration

Single Prisma migration adding two enum values:
```sql
ALTER TYPE "Agent" ADD VALUE 'MISTRAL';
ALTER TYPE "CredentialProvider" ADD VALUE 'MISTRAL';
```

No data migration needed — existing records are unaffected. The new enum values are additive.
