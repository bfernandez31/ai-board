# Research: Add Mistral (vibe CLI) as Third AI Agent Provider

**Branch**: `AIB-593-add-mistral-vibe`
**Created**: 2026-04-10

## Resolved Unknowns

### 1. vibe CLI Installation & Invocation

- **Decision**: Install via `pip install vibe-cli` (Python package) in the workflow runner
- **Rationale**: vibe is a Python-based CLI (unlike Claude/Codex which are Node/bun packages). The GitHub Actions runners have Python 3.12+ pre-installed. Installation follows the same pattern as Codex: check if binary exists → install → verify.
- **Alternatives considered**:
  - pipx install (adds isolation but unnecessary in ephemeral CI runners)
  - Pre-built binary download (not available from Mistral)

### 2. vibe CLI Auto-Approve Mode

- **Decision**: Use `vibe --profile agent` which enables fully autonomous execution (auto-approves all tool calls)
- **Rationale**: Matches the permission model of `claude --dangerously-skip-permissions` and `codex exec --dangerously-bypass-approvals-and-sandbox`. Required for unattended CI execution.
- **Alternatives considered**: `--yolo` flag (deprecated alias for agent profile)

### 3. vibe Telemetry Configuration

- **Decision**: vibe supports OTLP trace export natively. Configure via environment variables:
  - `VIBE_TELEMETRY=false` — disable Mistral datalake telemetry
  - Standard `OTEL_EXPORTER_OTLP_ENDPOINT` + `OTEL_EXPORTER_OTLP_HEADERS` for trace export
  - `OTEL_TRACES_EXPORTER=otlp` to enable OTLP trace output
- **Rationale**: vibe uses OpenTelemetry SDK internally and emits traces (not logs like Claude/Codex). The telemetry endpoint must accept trace payloads in addition to log payloads.
- **Alternatives considered**: Post-processing vibe output logs (fragile, loses span structure)

### 4. vibe Command Invocation Pattern

- **Decision**: File-based prompt delivery via pipe, similar to Codex: `cat command_file.md | vibe --profile agent --model mistral-large-latest -`
- **Rationale**: vibe reads from stdin when `-` is passed. This matches the Codex pattern and allows the same command file resolution logic.
- **Alternatives considered**: Direct string argument (length limits on some shells)

### 5. Mistral API Key Format

- **Decision**: Permissive validation — minimum 32 characters, no whitespace, alphanumeric with possible hyphens/underscores
- **Rationale**: Mistral's key format is not publicly documented with a stable prefix. A permissive check avoids false rejections. Live verification against `https://api.mistral.ai/v1/models` provides real validation.
- **Alternatives considered**: Strict regex (risk of false negatives if format changes)

### 6. Mistral Token Pricing

- **Decision**: Configurable pricing table following the OpenAI pattern in the telemetry route
- **Rationale**: Matches proven pattern. Mistral published pricing used at launch.
- **Pricing table** (per million tokens, source: Mistral API pricing):
  - `mistral-large-latest`: input $2.00, output $6.00, cached $1.00
  - `mistral-medium-latest`: input $0.70, output $2.10, cached $0.35
  - `mistral-small-latest`: input $0.10, output $0.30, cached $0.05
  - `codestral-latest`: input $0.30, output $0.90, cached $0.15

### 7. OTLP Trace vs Log Signal Handling

- **Decision**: Extend the existing `/api/telemetry/v1/logs` endpoint to also handle trace payloads (detect via `resourceSpans` key), OR add a new `/api/telemetry/v1/traces` route. The current endpoint already silently accepts and ignores trace payloads (line 71 in route.ts). We will process them instead.
- **Rationale**: The existing endpoint already receives both signal types. Processing traces at the same endpoint avoids reconfiguring OTLP exporters. Trace spans contain the same token/cost data but in span attributes instead of log record attributes.
- **Alternatives considered**: Separate `/v1/traces` endpoint (cleaner separation but requires workflow OTEL config changes)

## Existing Files

### Source Files to Modify

| File | What it covers | Action |
|------|---------------|--------|
| `prisma/schema.prisma` | Agent, CredentialProvider enums | **Extend** — add MISTRAL to Agent enum, MISTRAL to CredentialProvider enum |
| `lib/ai-credentials/types.ts` | AGENT_PROVIDER_MAP, ENV_VAR_MAP, PROVIDER_ALLOWED_TYPES | **Extend** — add MISTRAL mappings |
| `lib/ai-credentials/providers/index.ts` | Provider module registry | **Extend** — add MISTRAL provider module |
| `lib/ai-credentials/workflow.ts` | getMissingCredentialError | **Extend** — add Mistral provider name |
| `app/lib/utils/agent-icons.ts` | AGENT_METADATA, inferAgentFromIdentifier | **Extend** — add Mistral metadata and identifier inference |
| `app/api/telemetry/v1/logs/route.ts` | OTLP log processing, cost estimation | **Extend** — add Mistral trace processing, pricing table |
| `.github/scripts/run-agent.sh` | Agent CLI dispatch | **Extend** — add MISTRAL case for install/auth/invoke |
| `.github/workflows/speckit.yml` | Workflow env vars | **Extend** — add MISTRAL_API_KEY secret reference |
| `.github/workflows/quick-impl.yml` | Workflow env vars | **Extend** — same as speckit.yml |
| `.github/workflows/verify.yml` | Workflow env vars | **Extend** — same as speckit.yml |
| `.github/workflows/iterate.yml` | Workflow env vars | **Extend** — same as speckit.yml |
| `.github/workflows/ai-board-assist.yml` | Workflow env vars | **Extend** — same as speckit.yml |
| `components/credentials/credential-form.tsx` | Credential form UI | **Extend** — add Mistral provider option and format hints |
| `lib/schemas/otlp.ts` | OTLP Zod schema | **May extend** — if trace schema differs from log schema |

### Source Files to Create

| File | Purpose |
|------|---------|
| `lib/ai-credentials/providers/mistral.ts` | Mistral API key format validation and live verification |
| `public/agents/mistral.svg` | Mistral agent icon for UI display |

### Test Files to Extend

| File | What to add |
|------|-------------|
| `tests/unit/agent-schema.test.ts` | MISTRAL enum validation |
| `tests/unit/agent-resolution.test.ts` | MISTRAL resolution tests |
| `tests/unit/agent-icons.test.ts` | Mistral icon, label, description, identifier inference |
| `tests/unit/credential-dispatch-guard.test.ts` | MISTRAL provider dispatch checks |
| `tests/unit/ai-credentials.test.ts` | Mistral format validation |
| `tests/integration/credentials/credentials-api.test.ts` | Mistral credential CRUD |
| `tests/integration/credentials/credential-validation.test.ts` | Mistral key format validation |
| `tests/integration/credentials/workflow-credential.test.ts` | Mistral provider parameter |
| `tests/integration/telemetry/agent-agnostic.test.ts` | Mistral trace event processing |
| `tests/unit/components/agent-edit-dialog.test.tsx` | MISTRAL option rendering |
| `tests/unit/components/default-agent-card.test.tsx` | MISTRAL option rendering |

## Patterns to Follow

### 1. Provider Module Pattern (from `lib/ai-credentials/providers/openai.ts`)

New `mistral.ts` must implement the `ProviderModule` interface:
- `validateFormat(credentialType, value)` → `FormatValidationResult`
- `verifyWithProvider(credentialType, value)` → `Promise<VerificationResult>`

**Error handling pattern** (openai.ts:32-98):
- Use `AbortController` with 10s timeout for API verification
- Map HTTP status codes: 200→READY, 401/403→ACTION_REQUIRED/INVALID_KEY, 429→ACTION_REQUIRED/RATE_LIMITED
- Catch `AbortError` → UNREACHABLE with retry message
- Always `clearTimeout` in finally block

**Mistral verification endpoint**: `GET https://api.mistral.ai/v1/models` with `Authorization: Bearer <key>`

### 2. Agent CLI Dispatch Pattern (from `.github/scripts/run-agent.sh`)

The run-agent.sh script uses a case-dispatch pattern (line 220-238):
```bash
case "$AGENT_TYPE" in
  CLAUDE) validate_auth; install_claude; invoke_claude ;;
  CODEX)  validate_auth; install_codex; auth_codex; setup_codex_telemetry; invoke_codex; persist_codex_token ;;
esac
```

New MISTRAL case must follow the same structure:
1. `validate_auth` — check `MISTRAL_API_KEY` env var
2. `install_mistral` — `pip install vibe-cli` with existence check
3. `setup_mistral_telemetry` — configure OTEL trace export, disable datalake
4. `invoke_mistral` — resolve command file, pipe to `vibe --profile agent -m <model> -`

**Key difference from Codex**: No OAuth flow, no token persistence. Simpler auth (API key only via env var).

### 3. Telemetry Processing Pattern (from `app/api/telemetry/v1/logs/route.ts`)

Current pattern (lines 131-167):
- Detect event type by `eventName` string matching
- Extract tokens from attributes using `parseIntAttribute`/`parseFloatAttribute` helpers
- Accumulate metrics via summation (delta batches)
- Estimate cost from pricing table when provider doesn't report `cost_usd`

For Mistral traces:
- Detect via `resourceSpans` key (currently ignored at line 71)
- Parse span attributes instead of log record attributes
- Use same `findAttribute`, `parseIntAttribute` helpers
- Add `MISTRAL_PRICING` table following `OPENAI_PRICING` pattern (line 284)
- Event detection: look for span names like `mistral.chat_completion` or similar

### 4. Enum Extension Pattern (from Prisma schema)

When adding enum values:
1. Add value to Prisma enum
2. Create migration: `bunx prisma migrate dev --name add-mistral-agent`
3. Run `bunx prisma generate` to regenerate client
4. All `Record<Agent, ...>` and `Record<CredentialProvider, ...>` maps will get TypeScript errors until updated — use these as a checklist

### 5. Credential Mapping Pattern (from `lib/ai-credentials/types.ts:55-70`)

Three maps must be extended in lockstep:
- `AGENT_PROVIDER_MAP`: `MISTRAL → 'MISTRAL'`
- `PROVIDER_ALLOWED_TYPES`: `MISTRAL → ['API_KEY']` (no OAuth per Decision 1)
- `ENV_VAR_MAP`: `'MISTRAL:API_KEY' → 'MISTRAL_API_KEY'`

### 6. Missing Credential Error Pattern (from `lib/ai-credentials/workflow.ts:6-9`)

```typescript
export function getMissingCredentialError(provider: CredentialProvider = 'ANTHROPIC'): string {
  const providerName = provider === 'OPENAI' ? 'OpenAI' : 'Anthropic';
  return `No ${providerName} credential configured...`;
}
```
Must be extended with: `provider === 'MISTRAL' ? 'Mistral' : ...`

### 7. Agent Icon/Metadata Pattern (from `app/lib/utils/agent-icons.ts`)

Add to `AGENT_METADATA`:
```typescript
[Agent.MISTRAL]: {
  description: 'Mistral vibe',
  iconPath: '/agents/mistral.svg',
  label: 'Mistral',
}
```

Add to `inferAgentFromIdentifier`:
- Match `mistral` or `vibe` in normalized identifier string
