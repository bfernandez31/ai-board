# Data Model: AIB-607 — Add Gemini CLI as AI Agent

## Schema Changes

### Enum Extensions

#### Agent Enum (`prisma/schema.prisma:303`)

```prisma
enum Agent {
  CLAUDE
  CODEX
  MISTRAL
  GEMINI    # NEW — Google Gemini CLI agent
}
```

- **Migration**: `ALTER TYPE "Agent" ADD VALUE 'GEMINI';`
- **Impact**: All existing `Agent` fields (`Project.defaultAgent`, `Ticket.agent`, `ComparisonParticipant.agentAtComparison`, `ProjectSetupJob.agent`) automatically support GEMINI
- **Default unchanged**: `Project.defaultAgent` remains `@default(CLAUDE)`

#### CredentialProvider Enum (`prisma/schema.prisma:309`)

```prisma
enum CredentialProvider {
  ANTHROPIC
  OPENAI
  MISTRAL
  GOOGLE    # NEW — Google as credential provider
}
```

- **Migration**: `ALTER TYPE "CredentialProvider" ADD VALUE 'GOOGLE';`
- **Impact**: `UserCredential.provider` can now store Google credentials

### No New Tables Required

The existing `UserCredential` model already supports the needed structure:
- `provider: CredentialProvider` → will use `GOOGLE`
- `credentialType: CredentialType` → supports both `API_KEY` and `OAUTH_TOKEN`
- `encryptedValue`, `iv`, `authTag` → AES-256-GCM encryption (unchanged)
- `readinessStatus: CredentialReadiness` → PENDING_VERIFICATION / READY / ACTION_REQUIRED

## Application-Level Mappings

### AGENT_PROVIDER_MAP Extension (`lib/ai-credentials/types.ts`)

```typescript
export const AGENT_PROVIDER_MAP: Record<Agent, CredentialProvider> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
  MISTRAL: 'MISTRAL',
  GEMINI: 'GOOGLE',     // NEW
};
```

### PROVIDER_ALLOWED_TYPES Extension

```typescript
export const PROVIDER_ALLOWED_TYPES: Record<CredentialProvider, CredentialType[]> = {
  ANTHROPIC: ['API_KEY', 'OAUTH_TOKEN'],
  OPENAI: ['API_KEY', 'OAUTH_TOKEN'],
  MISTRAL: ['API_KEY'],
  GOOGLE: ['API_KEY', 'OAUTH_TOKEN'],  // NEW — API_KEY for AI Studio, OAUTH_TOKEN for CLI refresh token
};
```

### ENV_VAR_MAP Extension

```typescript
export const ENV_VAR_MAP: Record<string, string> = {
  'ANTHROPIC:API_KEY': 'ANTHROPIC_API_KEY',
  'ANTHROPIC:OAUTH_TOKEN': 'CLAUDE_CODE_OAUTH_TOKEN',
  'OPENAI:API_KEY': 'OPENAI_API_KEY',
  'OPENAI:OAUTH_TOKEN': 'CODEX_OAUTH_JSON',
  'MISTRAL:API_KEY': 'MISTRAL_API_KEY',
  'GOOGLE:API_KEY': 'GEMINI_API_KEY',          // NEW
  'GOOGLE:OAUTH_TOKEN': 'GEMINI_OAUTH_TOKEN',  // NEW
};
```

## Validation Rules

### Google API_KEY Format
- Prefix: `AIza`
- Minimum length: 39 characters
- Character set: `[A-Za-z0-9_-]`
- No whitespace

### Google OAUTH_TOKEN Format
- Minimum length: 20 characters (refresh tokens vary in length)
- No whitespace
- No format prefix requirement (refresh tokens don't have a standard prefix)

### Live Verification
- **API_KEY**: `GET https://generativelanguage.googleapis.com/v1beta/models?key={value}`
- **OAUTH_TOKEN**: `GET https://generativelanguage.googleapis.com/v1beta/models` with `Authorization: Bearer {value}`
- **200**: READY
- **401/403**: ACTION_REQUIRED / INVALID_KEY
- **429**: ACTION_REQUIRED / RATE_LIMITED
- **Timeout (10s)**: ACTION_REQUIRED / UNREACHABLE

## Telemetry Data Flow

### Gemini OTLP Events (native export)

No schema changes to `Job` model — all existing telemetry fields are reused:

| OTLP Event | Attribute | Job Field |
|------------|-----------|-----------|
| `gemini_cli.api_response` | `input_tokens` | `inputTokens` (accumulated) |
| `gemini_cli.api_response` | `output_tokens` | `outputTokens` (accumulated) |
| `gemini_cli.api_response` | `thought_tokens` | `cacheReadTokens` (accumulated, repurposed) |
| `gemini_cli.api_response` | `model` | `model` (latest overwrites) |
| `gemini_cli.api_response` | `duration_ms` | `durationMs` (accumulated) |
| `gemini_cli.tool_call` | `tool_name` | `toolsUsed` (merged Set) |
| Estimated server-side | — | `costUsd` (accumulated via pricing table) |

### Gemini Pricing Table

```typescript
const GEMINI_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'gemini-2.5-pro':   { input: 1.25, output: 10.00, cached: 0.3125 },
  'gemini-2.5-flash': { input: 0.15, output: 3.50,  cached: 0.0375 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40,  cached: 0.025 },
};
// Fallback: 'gemini-2.5-pro' (most expensive, conservative estimate)
```

## State Transitions

No new state transitions. Gemini follows existing patterns:
- **Eligible workflows**: SPECIFY → PLAN → BUILD (speckit), INBOX → BUILD (quick-impl), VERIFY iterate
- **Ineligible workflows**: verify, ai-board-assist, retro-spec, onboard — blocked at backend with descriptive error
