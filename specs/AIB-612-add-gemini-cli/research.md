# Research: Add Gemini as AI Agent Under Google Provider

**Branch**: `AIB-612-add-gemini-cli`
**Created**: 2026-04-12

## Resolved Unknowns

### 1. Agent and provider modeling

- Decision: Add `GEMINI` as a new `Agent` enum value and `GOOGLE` as a new `CredentialProvider` enum value.
- Rationale: The current codebase already separates agent identity from credential provider identity and uses centralized `Agent -> CredentialProvider` mapping during dispatch. Gemini needs its own selectable identity and Google needs its own credential lifecycle.
- Alternatives considered:
  - Reuse `OPENAI`/`CODEX`-style provider mapping for Gemini. Rejected because Gemini credentials and runtime are Google-specific.
  - Treat Gemini as a label-only alias. Rejected because analytics, workflow compatibility, and icon metadata require a real agent value.

### 2. Google credential shapes

- Decision: Support two Google credential types under the existing enum pair:
  - `API_KEY`: Google AI Studio key, injected as `GEMINI_API_KEY`
  - `OAUTH_TOKEN`: serialized Gemini CLI cached-auth bundle restored into `~/.gemini` for headless reuse
- Rationale: The feature spec explicitly requires both Google AI credential and Gemini OAuth credential support. Gemini CLI official docs confirm API-key auth via `GEMINI_API_KEY`, and headless mode can reuse existing cached authentication credentials when they already exist.
- Alternatives considered:
  - Add a new `SERVICE_ACCOUNT_JSON` credential type. Rejected because it would expand the shared credential enum and is not required by the spec.
  - Support only API keys in workflows. Rejected because it would not satisfy FR-002.

### 3. Gemini workflow invocation mode

- Decision: Run Gemini CLI in headless mode and capture `--output-format stream-json` output during supported workflows.
- Rationale: Official headless-mode docs state Gemini CLI runs headlessly in non-TTY or `-p` mode and can emit structured JSON or streaming JSON events, including tool events and final aggregated statistics. That is a closer fit to the existing batch telemetry path than introducing another OTLP variant.
- Alternatives considered:
  - Introduce a new OTLP trace/log ingestion path for Gemini. Rejected because the current app already supports batch ingestion and stream-json provides tool and usage data directly.
  - Scrape session files after execution. Rejected as more brittle than consuming the documented structured stream.

### 4. Telemetry and cost handling

- Decision: Extend the existing batch telemetry path to ingest Gemini model, token, duration, and tool metrics, and store `costUsd` only when pricing metadata is recognized; otherwise mark cost as unavailable explicitly.
- Rationale: This preserves the current dashboard model while honoring FR-011. The existing telemetry endpoint already supports provider-specific estimation paths and batch processing for Mistral.
- Alternatives considered:
  - Default unknown Gemini prices to `0`. Rejected because it violates the spec and would mislead analytics.
  - Drop jobs with unknown pricing from analytics. Rejected because it would hide usage entirely.

### 5. Supported workflow scope

- Decision: Gemini is eligible only for `specify`, `plan`, `implement`, `quick-impl`, and `iterate`. It remains blocked for `verify`, `ai-board-assist`, `retro-spec`, `onboard`, and `health-scan`.
- Rationale: This matches the feature specification and the current codebase’s split between generic multi-agent flows and hardcoded agent workflows.
- Alternatives considered:
  - Allow Gemini everywhere and fail inside workflow scripts. Rejected because the spec requires earlier prevention.
  - Hide Gemini globally until all workflows support it. Rejected because it would miss the requested supported flows.

### 6. Shared supported-agent definitions

- Decision: Centralize supported-agent availability for setup, selectors, transition entry points, and analytics filters instead of continuing to hardcode separate agent lists.
- Rationale: Current gaps exist because setup and analytics are still hardcoded around partial sets. A shared definition is the only sustainable way to satisfy FR-015 and simultaneously fix Mistral omissions.
- Alternatives considered:
  - Patch each UI separately. Rejected because it repeats the failure mode that caused the current gaps.

### 7. Verified upstream Gemini CLI assumptions

- Decision: Treat the following as current upstream behavior, verified on 2026-04-12:
  - API-key auth uses `GEMINI_API_KEY`
  - Headless mode is activated by non-TTY or `-p`
  - Headless output supports `json` and `stream-json`
  - Headless mode can reuse cached auth if one already exists, otherwise env-var auth is required
- Rationale: These details are product-specific and unstable enough that the plan should not rely on memory alone.
- Alternatives considered:
  - Infer the runtime from current repo shell scripts alone. Rejected because Gemini CLI behavior is external and recently evolving.

## Existing Files

### Credential and provider domain

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` | `Agent`, `CredentialProvider`, `UserCredential`, `ProjectSetupJob` enums/models | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/types.ts` | Provider/agent/env-var maps and workflow credential types | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/service.ts` | Encrypted create/replace/list/test credential flows | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/workflow.ts` | Workflow credential resolution and provider display names | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/index.ts` | Provider registry | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/openai.ts` | Provider verification pattern reference | Reuse as pattern reference |
| `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/mistral.ts` | Provider verification pattern reference | Reuse as pattern reference |
| `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/google.ts` | Google provider validation and verification | Create |
| `/home/runner/work/ai-board/ai-board/target/app/api/credentials/route.ts` | Credential create/list API | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/api/credentials/[id]/test/route.ts` | Manual credential retest API | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts` | Workflow credential fetch/update API | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/credentials/credential-form.tsx` | Provider/type selection UI | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/credentials/credential-item.tsx` | Provider label/readiness display | Extend |

### Workflow dispatch and runtime domain

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/lib/workflows/transition.ts` | Ticket transition guard, job creation, workflow dispatch | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-onboard.ts` | Setup workflow dispatch | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/workflows/dispatch-retro-spec.ts` | Retro-spec workflow dispatch | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-ai-board.ts` | AI-assist dispatch pinned to Claude | Reuse as blocking pattern |
| `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-rollback-reset.ts` | Rollback dispatch error recovery | Reuse as pattern reference |
| `/home/runner/work/ai-board/ai-board/target/lib/health/scan-dispatch.ts` | Health-scan dispatch pinned to Claude | Reuse as blocking pattern |
| `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` | Agent-specific CLI install/auth/invoke logic | Extend |
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/speckit.yml` | Specify/plan/build workflow env injection | Extend |
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/quick-impl.yml` | Quick build workflow env injection | Extend |
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/iterate.yml` | Iterate workflow env injection | Extend |
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/verify.yml` | Unsupported Gemini workflow; keep blocked | Reference only |
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/ai-board-assist.yml` | Unsupported Gemini workflow; keep blocked | Reference only |
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/onboard.yml` | Setup workflow currently hardcoded to Claude/Codex | Extend for selector consistency, keep Gemini blocked |
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/retro-spec.yml` | Unsupported Gemini workflow; keep blocked | Reference only |
| `/home/runner/work/ai-board/ai-board/target/.github/workflows/health-scan.yml` | Unsupported Gemini workflow; keep blocked | Reference only |

### Selection, setup, and analytics domain

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/app/lib/schemas/agent.ts` | Zod wrappers over Prisma agent enum | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-icons.ts` | Agent label, description, icon, identifier inference | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/settings/default-agent-card.tsx` | Project default-agent selector | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/tickets/agent-edit-dialog.tsx` | Ticket-level agent override selector | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/board/new-ticket-modal.tsx` | Ticket creation agent selection | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/board/ticket-card.tsx` | Ticket badge/icon rendering | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx` | Setup/onboarding agent cards and credential hinting | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/credential-check/route.ts` | Setup credential availability API | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts` | Setup job guard and dispatch API | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts` | Analytics filter and agent option types | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts` | Effective-agent filtering and available-agent calculation | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/analytics/aggregations.ts` | Default filter helpers and labels | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts` | Analytics filter validation | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/analytics/page.tsx` | Search-param validation and initial data fetch | Extend |
| `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx` | Agent filter UI and chart consumers | Extend |

### Telemetry and usage domain

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` | OTLP and batch telemetry ingestion | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` | Existing cross-agent telemetry integration tests | Extend |

### Existing test files to extend first

| File | Coverage today | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/tests/unit/ai-credentials.test.ts` | Shared credential validation/service utilities | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/credential-dispatch-guard.test.ts` | Missing-credential and provider resolution guards | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts` | Prisma/Zod agent enum coverage | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-icons.test.ts` | Agent label/icon/inference helpers | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-resolution.test.ts` | Effective-agent resolution | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/credential-form.test.tsx` | Credential form provider/type interaction | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/default-agent-card.test.tsx` | Default-agent selector rendering | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/agent-edit-dialog.test.tsx` | Ticket override selector rendering | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/new-ticket-modal.test.tsx` | Ticket creation selector behavior | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/setup/setup-page.test.tsx` | Setup flow agent choices and button guards | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx` | Analytics filter rendering and chart empty states | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credentials-api.test.ts` | Credential CRUD API | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/credential-validation.test.ts` | Provider validation API | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/credentials/workflow-credential.test.ts` | Internal workflow credential resolution | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-job.test.ts` | Setup-job POST/GET/PATCH flows | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/projects/setup-redirect.test.ts` | Setup page redirect semantics | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts` | Filter normalization and aggregate agent counts | Extend |

## Patterns to Follow

### 1. Provider verification pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/openai.ts:32-97`, `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/providers/mistral.ts:30-95`
- Error handling pattern:
  - Use `AbortController` with a 10-second timeout.
  - Map `401/403` to `INVALID_KEY`.
  - Map `429` to `RATE_LIMITED`.
  - Map timeout/network failures to `UNREACHABLE`.
  - Always `clearTimeout()` in `finally`.
- Security pattern:
  - Verification is read-only and uses bearer auth headers.
  - No secret value is logged or echoed back.
- State-management pattern:
  - Format validation happens before remote verification.

### 2. Credential-state persistence pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/service.ts:98-153`, `/home/runner/work/ai-board/ai-board/target/app/api/credentials/route.ts:55-102`
- Error handling pattern:
  - Reject invalid provider/type combinations at the route boundary with `400`.
  - Convert provider reachability failures to `422` without storing a ready credential.
- Security pattern:
  - Encrypt before upsert; never persist plaintext.
  - Internal credential responses are `no-store` and base64-encoded.
- State-management pattern:
  - Skip live verification only for credential types that intentionally rely on local cached auth.
  - Preserve `lastVerifiedAt` when the provider is unreachable instead of falsely refreshing it.

### 3. Dispatch-before-cleanup recovery pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/lib/workflows/transition.ts:164-185`, `/home/runner/work/ai-board/ai-board/target/lib/workflows/transition.ts:188-218`, `/home/runner/work/ai-board/ai-board/target/app/lib/workflows/dispatch-rollback-reset.ts:27-103`, `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/setup/jobs/route.ts:75-169`
- Error handling pattern:
  - Validate credential eligibility before dispatch.
  - Create the pending job record first.
  - On dispatch failure, either delete or mark the job failed immediately.
- Security pattern:
  - Provider resolution must stay centralized in `AGENT_PROVIDER_MAP`.
  - Hardcoded non-Gemini workflows must keep their explicit provider selection.
- State-management pattern:
  - Multi-step setup guards belong in a transaction so “already configured” and “active job” checks do not race.

### 4. Setup polling and completion pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/app/lib/hooks/useSetupJobPolling.ts:33-77`, `/home/runner/work/ai-board/ai-board/target/components/setup/setup-page-client.tsx:38-99`
- Error handling pattern:
  - Stop polling only on terminal failure or once `configSyncedAt` confirms setup completion.
- Security pattern:
  - Setup endpoints remain owner-only.
- State-management pattern:
  - UI disables actions when credentials are missing or a job is active.
  - Redirect is driven by server-confirmed configuration state, not by optimistic client assumptions.

### 5. Analytics effective-agent normalization pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts:50-68`, `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts:189-244`, `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts:600-678`, `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/analytics/page.tsx:14-69`
- Error handling pattern:
  - Invalid requested agents fall back to `all`.
- Security pattern:
  - Analytics access remains behind `verifyProjectAccess`.
- State-management pattern:
  - Effective agent is `ticket.agent ?? project.defaultAgent`.
  - Available agent options must be derived from actual job-backed ticket history, not a hardcoded enum subset.

### 6. Secret handling and workflow auth pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/lib/ai-credentials/crypto.ts:7-54`, `/home/runner/work/ai-board/ai-board/target/app/lib/workflow-auth.ts:9-35`, `/home/runner/work/ai-board/ai-board/target/app/api/internal/credentials/route.ts:18-72`
- Error handling pattern:
  - Fail fast when encryption key or workflow auth token is missing.
- Security pattern:
  - Use timing-safe token comparison.
  - Use AES-256-GCM with per-secret IVs.
  - Disable caching on workflow credential fetch/update endpoints.
- State-management pattern:
  - Workflow fetch returns only the env-var contract needed by the runner, never the stored credential record.

### 7. Runner auth and telemetry materialization pattern

- Reference: `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh:114-153`, `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh:156-223`, `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh:225-420`
- Error handling pattern:
  - CLI install/auth failures exit the job immediately.
  - Telemetry collection should be non-blocking after the main command completes.
- Security pattern:
  - Persist refreshed auth only through the internal credentials API.
  - Never log raw token JSON or API keys.
- State-management pattern:
  - Each agent keeps a dedicated install/auth/invoke branch under the shared dispatcher.
  - Provider-specific runtime files live under the tool’s home directory and are restored before invocation.

## Source Notes

- Gemini CLI authentication docs verified on 2026-04-12: https://geminicli.com/docs/get-started/authentication/
- Gemini CLI headless mode docs verified on 2026-04-12: https://geminicli.com/docs/cli/headless/
- Gemini CLI telemetry docs verified on 2026-04-12: https://geminicli.com/docs/cli/telemetry/

