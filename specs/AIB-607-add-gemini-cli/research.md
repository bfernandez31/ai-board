# Research: AIB-607 — Add Gemini CLI as AI Agent

## Resolved Unknowns

### 1. Google Credential Verification Endpoint

- **Decision**: Use `https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}` for API_KEY verification; for OAuth tokens, use the same endpoint with `Authorization: Bearer {token}` header
- **Rationale**: Google's Generative Language API `/v1beta/models` is a lightweight, read-only endpoint (lists available models) — ideal for credential verification without side effects. Same pattern as Mistral (`/v1/models`) and OpenAI (`/v1/models`).
- **Alternatives considered**: Using `/v1beta/models/gemini-2.5-pro:generateContent` with a test message (rejected: unnecessary cost and complexity for verification)

### 2. Gemini API Key Format

- **Decision**: Validate API keys with prefix `AIza` and minimum length 39 characters
- **Rationale**: Google AI Studio API keys follow the format `AIza[A-Za-z0-9_-]{35}` (39 chars total). This is the standard format for Google API keys used with Generative AI services.
- **Alternatives considered**: No prefix check (rejected: would accept unrelated Google API keys)

### 3. Gemini CLI Installation Method

- **Decision**: Install via `npm install -g @anthropic-ai/gemini-cli` (placeholder — actual package name TBD at implementation) or the official Gemini CLI installer
- **Rationale**: Follow the same npm global install pattern used for Claude Code. If Gemini CLI uses a different installer (like Mistral's curl-based approach), adapt accordingly.
- **Alternatives considered**: Docker-based installation (rejected: adds complexity, not consistent with other agents)

### 4. Gemini OTLP Event Schema

- **Decision**: Process `gemini_cli.api_response` and `gemini_cli.tool_call` events via native OTLP export (same endpoint as Claude/Codex)
- **Rationale**: Gemini CLI natively supports OTLP telemetry export. Expected attributes on `gemini_cli.api_response`: `input_tokens`, `output_tokens`, `thought_tokens` (maps to cacheReadTokens for consistency), `model`, `duration_ms`. Expected attributes on `gemini_cli.tool_call`: `tool_name`.
- **Alternatives considered**: Post-execution scraping like Mistral (rejected: Gemini CLI has native OTLP support, making scraping unnecessary)

### 5. Gemini Pricing Table (as of 2026-04)

- **Decision**: Static pricing table for cost estimation, matching the Codex/Mistral pattern
- **Rationale**: Gemini CLI does not report `cost_usd` directly. Prices per million tokens:
  - `gemini-2.5-pro`: input $1.25, output $10.00, cached $0.3125
  - `gemini-2.5-flash`: input $0.15, output $3.50, cached $0.0375
  - `gemini-2.0-flash`: input $0.10, output $0.40, cached $0.025
- **Alternatives considered**: Dynamic pricing API (rejected: Google doesn't expose a pricing API; static table is consistent with Codex/Mistral)

### 6. Workflow Eligibility Enforcement

- **Decision**: Enforce Gemini exclusion from verify, ai-board-assist, retro-spec, and onboard workflows at the backend level (transition.ts agent validation + setup jobs schema)
- **Rationale**: Backend enforcement prevents bypass via direct API calls. The UI will also hide Gemini from ineligible workflows, but the backend is the authoritative gate.
- **Alternatives considered**: UI-only enforcement (rejected: spec explicitly requires backend validation per Edge Case)

## Existing Files

### Source Files to Modify

| File | Purpose | Action |
|------|---------|--------|
| `prisma/schema.prisma:303-313` | Agent and CredentialProvider enums | **Extend**: Add `GEMINI` to Agent, `GOOGLE` to CredentialProvider |
| `lib/ai-credentials/types.ts:55-80` | AGENT_PROVIDER_MAP, PROVIDER_ALLOWED_TYPES, ENV_VAR_MAP | **Extend**: Add GEMINI→GOOGLE mapping, GOOGLE allowed types, env var entries |
| `lib/ai-credentials/providers/index.ts` | Provider module registry | **Extend**: Add `GOOGLE: google` entry |
| `app/lib/utils/agent-icons.ts:3-26` | AGENT_METADATA record | **Extend**: Add GEMINI entry with icon, label, description |
| `app/api/telemetry/v1/logs/route.ts` | OTLP telemetry processing | **Extend**: Add Gemini event parsing + GEMINI_PRICING table |
| `lib/analytics/types.ts:10` | NamedAgent type | **Extend**: Change to include all Agent enum values dynamically (FR-018) |
| `lib/analytics/queries.ts:213-232` | getAvailableAgents hardcoded agents | **Extend**: Make dynamic from Agent enum instead of hardcoded array |
| `components/setup/setup-page-client.tsx:19-30` | AGENTS array (CLAUDE/CODEX only) | **Extend**: Add GEMINI and MISTRAL entries (FR-008, FR-009) |
| `.github/scripts/run-agent.sh` | Agent CLI orchestration | **Extend**: Add GEMINI case with install, auth, telemetry, invoke functions |
| `.github/workflows/speckit.yml:234-266` | Credential fetch agent→provider mapping | **Extend**: Add GEMINI→GOOGLE mapping |
| `.github/workflows/quick-impl.yml` | Quick-impl credential fetch | **Extend**: Same GEMINI→GOOGLE mapping |
| `.github/workflows/iterate.yml` | Iterate credential fetch | **Extend**: Same GEMINI→GOOGLE mapping |
| `app/api/projects/[projectId]/setup/jobs/route.ts:22` | Agent validation schema | **Extend**: Add GEMINI to allowed agents (but only for eligible workflows) |
| `lib/workflows/transition.ts:164-175` | Credential check before dispatch | No change needed (already dynamic via AGENT_PROVIDER_MAP) |
| `app/api/internal/credentials/route.ts` | Workflow credential API | No change needed (already dynamic via provider param) |
| `app/api/projects/[projectId]/setup/credential-check/route.ts` | Credential check for setup | No change needed (already uses AGENT_PROVIDER_MAP) |

### New Files to Create

| File | Purpose |
|------|---------|
| `lib/ai-credentials/providers/google.ts` | Google credential format validation and live verification |
| `public/agents/gemini.svg` | Gemini agent icon SVG |

### Test Files to Extend

| File | Purpose | Action |
|------|---------|--------|
| `tests/unit/agent-icons.test.ts` | Agent metadata tests | **Extend**: Add GEMINI metadata assertions |
| `tests/unit/agent-schema.test.ts` | Agent Zod schema tests | **Extend**: Add GEMINI to valid agent values |
| `tests/unit/credential-dispatch-guard.test.ts` | Provider mapping tests | **Extend**: Add GEMINI→GOOGLE mapping test |
| `tests/unit/ai-credentials.test.ts` | Credential validation | **Extend**: Add Google provider format/verify tests |
| `tests/integration/telemetry/agent-agnostic.test.ts` | Telemetry processing | **Extend**: Add Gemini OTLP event test cases |
| `tests/integration/analytics/analytics-route.test.ts` | Analytics API | **Extend**: Add Gemini/Mistral filter tests |
| `tests/unit/components/analytics-dashboard.test.tsx` | Analytics UI | **Extend**: Verify Gemini/Mistral appear in agent filter |

### New Test Files

| File | Purpose |
|------|---------|
| `tests/integration/credentials/google-credential.test.ts` | Google credential validation and verification integration tests |

## Patterns to Follow

### Credential Provider Pattern (from `lib/ai-credentials/providers/mistral.ts`)

The Google provider module MUST follow the exact same structure:
- Export `validateFormat(credentialType, value): FormatValidationResult`
- Export `verifyWithProvider(credentialType, value): Promise<VerificationResult>`
- Use AbortController with 10s timeout (`VERIFICATION_TIMEOUT_MS = 10_000`)
- Handle HTTP status codes: 200 → READY/VALID, 401/403 → ACTION_REQUIRED/INVALID_KEY, 429 → ACTION_REQUIRED/RATE_LIMITED
- Catch AbortError for timeout → ACTION_REQUIRED/UNREACHABLE
- Catch all other errors → ACTION_REQUIRED/UNREACHABLE
- Always `clearTimeout` in `finally` block

### Telemetry Processing Pattern (from `app/api/telemetry/v1/logs/route.ts:139-175`)

Gemini OTLP events MUST be processed using the same accumulation pattern:
- Check event name to identify Gemini events (`gemini_cli.api_response`, `gemini_cli.tool_call`)
- Extract attributes via `parseIntAttribute(findAttribute(attrs, 'key'))` — never direct property access
- Accumulate metrics via `+=` on the shared `metrics` object
- Cost estimated via `estimateGeminiCost()` following the same `(tokens / 1_000_000) * price` formula
- Fallback pricing: use most expensive model as default (same pattern as Codex: `OPENAI_PRICING['gpt-5.4']`, Mistral: `MISTRAL_PRICING['mistral-large-latest']`)

### Run-Agent Shell Pattern (from `.github/scripts/run-agent.sh:227-396`)

The GEMINI case in run-agent.sh MUST follow the Mistral pattern structure:
- `install_gemini()`: Check `command -v gemini`, install if missing, verify after install
- `validate_auth()` case: Require `GEMINI_API_KEY` or `GEMINI_OAUTH_TOKEN`
- `setup_gemini_telemetry()`: Configure OTLP env vars (`GEMINI_TELEMETRY_ENABLED=1`, endpoint, protocol)
- `invoke_gemini()`: Resolve command file, read prompt, invoke in headless mode
- Main dispatch: `validate_auth → install → setup_telemetry → invoke`
- Unlike Mistral (post-execution scrape), Gemini uses native OTLP so no `collect_gemini_telemetry` needed

### Workflow Credential Fetch Pattern (from `.github/workflows/speckit.yml:234-266`)

The credential fetch step already uses a bash case statement mapping agent→provider. Add:
```
GEMINI) PROVIDER="GOOGLE" ;;
```
The env var name comes from the credential API response (`envVar` field), so no hardcoding needed in the workflow.

### Analytics Dynamic Agent Pattern

Currently `NamedAgent = 'CLAUDE' | 'CODEX'` is hardcoded. To satisfy FR-018 (dynamic agent filtering), change `getAvailableAgents()` at `lib/analytics/queries.ts:213-232` to iterate over all `Agent` enum values from Prisma instead of a hardcoded `['CLAUDE', 'CODEX']` array. The `NamedAgent` type should be derived from the Agent enum.
