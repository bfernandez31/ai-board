# Data Model: Gemini Agent and Google Credential Provider

## Enum Changes

### `Agent`

- Existing: `CLAUDE`, `CODEX`, `MISTRAL`
- Add: `GEMINI`
- Used by:
  - `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` `Project.defaultAgent`
  - `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` `Ticket.agent`
  - `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` `ProjectSetupJob.agent`
  - All `Record<Agent, ...>` selector, icon, and analytics helpers

### `CredentialProvider`

- Existing: `ANTHROPIC`, `OPENAI`, `MISTRAL`
- Add: `GOOGLE`
- Used by:
  - `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` `UserCredential.provider`
  - `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/types.ts` provider and env-var mapping

### `CredentialType`

- No enum change
- `GOOGLE` provider allowed types:
  - `API_KEY`
  - `OAUTH_TOKEN`

## Entity Impacts

### Supported Agent

- Backed by Prisma `Agent`
- New value: `GEMINI`
- Required metadata:
  - Label: `Gemini`
  - Description: `Google Gemini CLI`
  - Icon asset path: `/agents/gemini.svg`
  - Identifier inference aliases:
    - `gemini`
    - `google`
- Workflow compatibility:
  - Allowed: `specify`, `plan`, `implement`, `quick-impl`, `iterate`
  - Blocked: `verify`, `ai-board-assist`, `retro-spec`, `onboard`, `health-scan`

### Google Credential

- Backed by existing `UserCredential`
- Provider: `GOOGLE`
- Validation rules:
  - `label`: existing max 100 chars
  - `preview`: last 4 chars or stable masked suffix of stored bundle identifier
  - `API_KEY`:
    - must be non-empty
    - validated by Google provider module
    - readiness only becomes `READY` after successful provider verification
  - `OAUTH_TOKEN`:
    - stores serialized Gemini cached-auth bundle
    - readiness depends on successful structural validation
    - invalid or unparsable bundles remain `ACTION_REQUIRED`
- Relationships:
  - unchanged `User 1 -> many UserCredential`
  - uniqueness remains `@@unique([userId, provider])`

### Job Usage Record

- Backed by existing `Job`
- No new table required for baseline Gemini rollout
- Existing reused fields:
  - `model`
  - `inputTokens`
  - `outputTokens`
  - `cacheReadTokens`
  - `cacheCreationTokens`
  - `toolsUsed`
  - `durationMs`
  - `costUsd`
- Design addition:
  - preserve an explicit in-memory / API-level `costStatus` contract with values:
    - `ESTIMATED`
    - `UNAVAILABLE`
  - If implementation later requires persistence for `costStatus`, add a nullable enum/string column in a follow-up migration. The initial design can compute status from `costUsd === null` and recognized pricing presence.

### Agent Analytics View

- Backed by existing `AnalyticsData` payload, not a Prisma model
- Type changes:
  - `NamedAgent` expands to `CLAUDE | CODEX | MISTRAL | GEMINI`
  - `AgentFilter` expands to `all | NamedAgent`
  - `availableAgents` options must include Mistral and Gemini when job history exists

### Project Setup Job

- Backed by existing `ProjectSetupJob`
- Existing `agent` field automatically widens with `Agent.GEMINI`
- Validation rule:
  - `agent=GEMINI` may be visible in setup agent-selection UI for consistency, but `command=ONBOARD` must reject Gemini until onboarding automation supports it

## Relationships

- `Project.defaultAgent` -> `Agent.GEMINI` allowed
- `Ticket.agent` -> `Agent.GEMINI` allowed
- `ProjectSetupJob.agent` -> can record `GEMINI` only if the setup flow later supports it; otherwise guard before row creation
- `Agent.GEMINI` -> `CredentialProvider.GOOGLE`
- `CredentialProvider.GOOGLE` -> `CredentialType.API_KEY | CredentialType.OAUTH_TOKEN`

## Validation Matrix

| Agent | Provider | Allowed credential types | Supported workflow commands |
|-------|----------|--------------------------|-----------------------------|
| `CLAUDE` | `ANTHROPIC` | `API_KEY`, `OAUTH_TOKEN` | Existing Claude-supported flows |
| `CODEX` | `OPENAI` | `API_KEY`, `OAUTH_TOKEN` | Existing Codex-supported flows |
| `MISTRAL` | `MISTRAL` | `API_KEY` | Existing Mistral-supported flows |
| `GEMINI` | `GOOGLE` | `API_KEY`, `OAUTH_TOKEN` | `specify`, `plan`, `implement`, `quick-impl`, `iterate` |

## State Transitions

### Google credential verification

1. Submission received with `provider=GOOGLE`
2. Provider/type compatibility checked before persistence
3. Format or bundle validation runs
4. If `API_KEY`, live verification runs against Google provider
5. Credential stored encrypted with:
   - `READY` on success
   - `ACTION_REQUIRED` on invalid or unreachable verification
6. Workflow eligibility depends on:
   - matching `GOOGLE` credential existing for the project owner
   - readiness not being invalid or stale per provider rules

### Gemini workflow dispatch

1. Resolve effective agent from ticket override or project default
2. Map `GEMINI -> GOOGLE`
3. Confirm selected command is in the Gemini-supported workflow set
4. Confirm a usable Google credential exists
5. Create job row in `PENDING`
6. Dispatch GitHub Actions workflow with Gemini runtime inputs
7. On dispatch failure, delete or fail the job using the existing recovery pattern

### Gemini telemetry ingestion

1. Gemini CLI emits stream-json events during headless execution
2. Workflow script aggregates model, token, tool, and duration data
3. Workflow posts batch JSON to `/api/telemetry/v1/logs`
4. Server updates existing `Job` fields
5. If price lookup is unknown:
   - persist usage metrics
   - leave `costUsd` empty or unchanged per final implementation
   - expose `costStatus=UNAVAILABLE` in contract responses

